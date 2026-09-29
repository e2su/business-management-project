"""Extract: read any supported file into a DataFrame of raw strings and work out
which business entity (orders, customers, ...) it contains."""
from __future__ import annotations

import fnmatch
import hashlib
import json
import re
from pathlib import Path

import pandas as pd

SUPPORTED_EXTENSIONS = {".csv", ".txt", ".tsv", ".xlsx", ".xls", ".json", ".jsonl", ".parquet"}


class ExtractError(Exception):
    pass


def normalise_header(name: object) -> str:
    """'Order No.' -> 'order_no', 'Unit Price (USD)' -> 'unit_price_usd'."""
    s = re.sub(r"[^0-9a-zA-Z]+", "_", str(name).strip().lower())
    return s.strip("_")


def file_checksum(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def read_file(path: Path) -> pd.DataFrame:
    """Read a file with every value as string; types are applied in transform."""
    ext = path.suffix.lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise ExtractError(f"unsupported file type '{ext}'")
    try:
        if ext in {".csv", ".txt", ".tsv"}:
            # sep=None sniffs the delimiter (comma, semicolon, tab, pipe).
            df = pd.read_csv(path, dtype=str, sep=None, engine="python", encoding="utf-8-sig",
                             keep_default_na=False, skipinitialspace=True)
        elif ext in {".xlsx", ".xls"}:
            df = pd.read_excel(path, dtype=str, keep_default_na=False)
        elif ext == ".jsonl":
            df = pd.read_json(path, lines=True, dtype=False)
        elif ext == ".json":
            payload = json.loads(path.read_text(encoding="utf-8-sig"))
            if isinstance(payload, dict):
                # accept {"records": [...]} / {"data": [...]} / {"orders": [...]} envelopes
                lists = [v for v in payload.values() if isinstance(v, list)]
                payload = lists[0] if lists else [payload]
            df = pd.json_normalize(payload)
        else:
            df = pd.read_parquet(path)
    except Exception as exc:  # noqa: BLE001 - surface any parser error as an extract error
        raise ExtractError(f"could not parse file: {exc}") from exc

    df = df.astype(object).where(pd.notna(df), None)
    df = df.apply(lambda col: col.map(lambda v: None if v is None else str(v).strip()))
    df = df.replace({"": None})
    df.columns = [normalise_header(c) for c in df.columns]
    df = df.loc[:, [c for c in df.columns if c and not c.startswith("unnamed")]]
    return df.dropna(how="all").reset_index(drop=True)


def _alias_index(entity_cfg: dict) -> dict[str, str]:
    idx = {}
    for field, spec in entity_cfg["fields"].items():
        idx[normalise_header(field)] = field
        for alias in spec.get("aliases", []) or []:
            idx.setdefault(normalise_header(alias), field)
    return idx


def detect_entity(path: Path, columns: list[str], mappings: dict, hint: str | None = None) -> str:
    """Pick the entity by (1) explicit hint, (2) folder or file-name pattern,
    (3) best match of the file's columns against each entity's required fields."""
    entities = mappings["entities"]
    if hint:
        if hint not in entities:
            raise ExtractError(f"unknown entity '{hint}'")
        return hint

    # A sub-folder named after the entity, e.g. incoming/orders/export.csv
    if path.parent.name in entities:
        return path.parent.name

    name = path.name.lower()
    by_name = [e for e, cfg in entities.items()
               if any(fnmatch.fnmatch(name, pat.lower()) for pat in cfg.get("file_patterns", []))]
    if len(by_name) == 1:
        return by_name[0]

    best, best_score = None, 0.0
    for entity, cfg in entities.items():
        if by_name and entity not in by_name:
            continue
        idx = _alias_index(cfg)
        mapped = {idx[c] for c in columns if c in idx}
        required = {f for f, s in cfg["fields"].items() if s.get("required")}
        if not required <= mapped:
            continue
        score = len(mapped) / len(cfg["fields"])
        if score > best_score:
            best, best_score = entity, score
    if best is None:
        raise ExtractError(
            "could not determine what this file contains - name it like 'orders_*.csv', "
            "put it in a sub-folder named after the entity, or add column aliases in "
            "config/schema_mappings.yaml")
    return best
