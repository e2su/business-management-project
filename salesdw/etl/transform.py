"""Transform: map raw columns to the canonical model, cast types, normalise
values and apply data-quality rules. Bad rows are returned as rejects instead
of failing the whole file."""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field

import pandas as pd

from .extract import _alias_index, normalise_header


@dataclass
class TransformResult:
    entity: str
    data: pd.DataFrame
    rejects: list[dict] = field(default_factory=list)
    unmapped_columns: list[str] = field(default_factory=list)
    rows_read: int = 0


# ---------------------------------------------------------------- parsers ---

_NUM_CLEAN = re.compile(r"[^0-9,.\-]")


def parse_decimal(value: str | None) -> float | None:
    """Accepts '1,234.50', '$ 99', '12.5%', '1.234,50', '(20)' (accounting negative)."""
    if value is None:
        return None
    s = str(value).strip()
    if not s:
        return None
    negative = s.startswith("(") and s.endswith(")")
    percent = s.endswith("%")
    s = _NUM_CLEAN.sub("", s)
    if not s or s in {"-", ".", ","}:
        raise ValueError(f"not a number: {value!r}")
    if "," in s and "." in s:
        # whichever separator comes last is the decimal separator
        s = s.replace(".", "").replace(",", ".") if s.rfind(",") > s.rfind(".") else s.replace(",", "")
    elif "," in s:
        s = s.replace(",", ".") if re.search(r",\d{1,2}$", s) else s.replace(",", "")
    n = float(s)
    if negative:
        n = -abs(n)
    if percent:
        n = n / 100
    return n


def _parse_dates(series: pd.Series) -> pd.Series:
    iso = pd.to_datetime(series, errors="coerce", format="ISO8601")
    rest = series.notna() & iso.isna()
    if rest.any():
        iso[rest] = pd.to_datetime(series[rest], errors="coerce", format="mixed")
    return iso.dt.normalize()


def _parse_months(series: pd.Series) -> pd.Series:
    s = series.map(lambda v: f"{v}-01" if v and re.fullmatch(r"\d{4}[-/]\d{1,2}", v) else v)
    s = s.map(lambda v: v.replace("/", "-") if isinstance(v, str) else v)
    return _parse_dates(s).dt.to_period("M").dt.to_timestamp()


def _value_lookup(mappings: dict, name: str) -> dict[str, str]:
    table = (mappings.get("value_mappings") or {}).get(name) or {}
    lookup = {}
    for canonical, variants in table.items():
        lookup[normalise_header(canonical)] = canonical
        for v in variants or []:
            lookup[normalise_header(v)] = canonical
    return lookup


# -------------------------------------------------------------- transform ---

def transform(df: pd.DataFrame, entity: str, mappings: dict, *,
              fx_rates: dict[str, float] | None = None) -> TransformResult:
    cfg = mappings["entities"][entity]
    fields: dict = cfg["fields"]
    alias_idx = _alias_index(cfg)
    rows_read = len(df)

    # 1) map columns: first source column wins for each canonical field
    rename, unmapped = {}, []
    for col in df.columns:
        target = alias_idx.get(col)
        if target and target not in rename.values():
            rename[col] = target
        else:
            unmapped.append(col)
    out = df.rename(columns=rename)
    extras = df[unmapped] if unmapped else None

    errors = pd.Series([[] for _ in range(len(out))], index=out.index, dtype=object)

    def flag(mask: pd.Series, reason: str) -> None:
        for i in mask[mask].index:
            errors.at[i] = errors.at[i] + [reason]

    # 2) cast each canonical field
    result = pd.DataFrame(index=out.index)
    for name, spec in fields.items():
        ftype = spec.get("type", "string")
        raw = out[name] if name in out.columns else pd.Series([None] * len(out), index=out.index, dtype=object)
        present = raw.notna()

        if ftype in ("decimal", "int"):
            def safe(v):
                try:
                    return parse_decimal(v)
                except ValueError:
                    return float("nan")
            parsed = raw.map(safe).astype(float)
            bad = present & parsed.isna()
            if ftype == "int":
                bad |= parsed.notna() & (parsed % 1 != 0)
        elif ftype == "date":
            parsed = _parse_dates(raw)
            bad = present & parsed.isna()
        elif ftype == "month":
            parsed = _parse_months(raw)
            bad = present & parsed.isna()
        else:
            parsed = raw.astype(object)
            if spec.get("values"):
                lookup = _value_lookup(mappings, spec["values"])
                parsed = parsed.map(lambda v: lookup.get(normalise_header(v), v) if v is not None else None)
            bad = pd.Series(False, index=out.index)

        if spec.get("required"):
            flag(~present, f"missing required field '{name}'")
            flag(bad, f"invalid {ftype} in '{name}'")
        # optional + invalid -> treat as empty (falls back to default below)
        parsed = parsed.where(~bad, None) if ftype not in ("date", "month") else parsed.where(~bad)

        default = spec.get("default")
        if default is not None:
            if ftype in ("decimal", "int"):
                parsed = parsed.fillna(float(default))
            else:
                parsed = parsed.where(parsed.notna(), default)
        result[name] = parsed

    # 3) entity-specific business rules
    if entity == "orders":
        result, errors = _order_rules(result, errors, fx_rates or {"USD": 1.0})
    elif entity == "targets":
        flag(result["target_amount"] < 0, "negative target_amount")
    elif entity == "products":
        flag((result["unit_cost"] < 0) | (result["list_price"] < 0), "negative price or cost")

    # 4) keep unknown columns as JSON so no information is lost
    if extras is not None:
        result["extra_attributes"] = [
            json.dumps({k: v for k, v in rec.items() if v is not None}) or None
            for rec in extras.to_dict("records")
        ]
        result["extra_attributes"] = result["extra_attributes"].replace("{}", None)
    else:
        result["extra_attributes"] = None

    # 5) split good rows / rejects
    is_bad = errors.map(bool)
    rejects = [
        {"row_number": int(i) + 2,  # +2 = header line + 1-based numbering, matches spreadsheet rows
         "reason": "; ".join(errors.at[i]),
         "payload": {k: v for k, v in df.loc[i].to_dict().items() if v is not None}}
        for i in is_bad[is_bad].index
    ]
    good = result[~is_bad].copy()

    # 6) de-duplicate on the business key (last occurrence in the file wins)
    good = good.drop_duplicates(subset=cfg["business_key"], keep="last").reset_index(drop=True)

    for name, spec in fields.items():
        if spec.get("type") == "int":
            good[name] = good[name].astype("int64")
        elif spec.get("type") in ("date", "month"):
            good[name] = good[name].dt.date.where(good[name].notna(), None)

    return TransformResult(entity, good, rejects, unmapped, rows_read)


def _order_rules(df: pd.DataFrame, errors: pd.Series, fx_rates: dict[str, float]):
    def flag(mask, reason):
        for i in mask[mask.fillna(False)].index:
            errors.at[i] = errors.at[i] + [reason]

    # Negative quantity = a return line from a POS system.
    neg = df["quantity"] < 0
    df.loc[neg, "order_status"] = "returned"
    df.loc[neg, "quantity"] = df.loc[neg, "quantity"].abs()
    flag(df["quantity"] == 0, "quantity is zero")
    flag(df["unit_price"] < 0, "negative unit_price")

    # Discount given as percent (15) instead of rate (0.15).
    df.loc[df["discount"] > 1, "discount"] = df["discount"] / 100
    flag((df["discount"] < 0) | (df["discount"] > 1), "discount out of range")

    flag(df["ship_date"].notna() & df["order_date"].notna() & (df["ship_date"] < df["order_date"]),
         "ship_date before order_date")

    df["currency"] = df["currency"].map(lambda c: str(c).upper() if c else c)
    df["fx_rate"] = df["currency"].map(fx_rates)
    flag(df["fx_rate"].isna(), "unknown currency (add it to fx_rates in config/settings.yaml)")

    df["order_status"] = df["order_status"].map(lambda s: str(s).lower() if s else s)
    return df, errors
