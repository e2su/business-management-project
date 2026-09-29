from pathlib import Path

import pandas as pd
import pytest

from salesdw.etl.extract import ExtractError, detect_entity, normalise_header, read_file
from salesdw.etl.transform import parse_decimal, transform

FX = {"USD": 1.0, "EUR": 1.08}


@pytest.mark.parametrize("raw,expected", [
    ("1,234.50", 1234.5), ("$ 99", 99.0), ("12.5%", 0.125), ("1.234,50", 1234.5),
    ("(20)", -20.0), ("3,5", 3.5), ("1,000", 1000.0), ("-4", -4.0), (None, None), ("", None),
])
def test_parse_decimal(raw, expected):
    assert parse_decimal(raw) == expected


def test_parse_decimal_rejects_text():
    with pytest.raises(ValueError):
        parse_decimal("abc")


def test_normalise_header():
    assert normalise_header(" Order No. ") == "order_no"
    assert normalise_header("Unit Price (USD)") == "unit_price_usd"


def _frame(rows):
    return pd.DataFrame(rows).astype(object).where(lambda d: d.notna(), None)


def test_aliases_values_and_extras(mappings):
    df = _frame([{"invoice_no": "A1", "sale_date": "05 Jan 2026", "sku": "P1", "qty": "2",
                  "selling_price": "10", "disc": "15%", "status": "Delivered", "tender": "visa",
                  "loyalty_points": "7"}])
    r = transform(df, "orders", mappings, fx_rates=FX)
    row = r.data.iloc[0]
    assert not r.rejects
    assert row.order_id == "A1" and row.product_id == "P1" and row.quantity == 2
    assert str(row.order_date) == "2026-01-05"
    assert row.discount == pytest.approx(0.15)
    assert row.order_status == "completed" and row.payment_method == "Card"
    assert row.customer_id == "GUEST" and row.store_id == "ONLINE" and row.currency == "USD"
    assert r.unmapped_columns == ["loyalty_points"]
    assert '"loyalty_points": "7"' in row.extra_attributes


def test_business_rules_reject_bad_rows(mappings):
    base = {"order_date": "2026-01-01", "product_id": "P1", "quantity": "1", "unit_price": "5"}
    df = _frame([
        {**base, "order_id": "ok"},
        {**base, "order_id": None},
        {**base, "order_id": "x2", "order_date": "not a date"},
        {**base, "order_id": "x3", "quantity": "0"},
        {**base, "order_id": "x4", "currency": "XYZ"},
        {**base, "order_id": "x5", "order_date": "2026-01-05", "ship_date": "2026-01-01"},
    ])
    r = transform(df, "orders", mappings, fx_rates=FX)
    assert list(r.data.order_id) == ["ok"]
    reasons = [x["reason"] for x in r.rejects]
    assert any("missing required field 'order_id'" in x for x in reasons)
    assert any("invalid date in 'order_date'" in x for x in reasons)
    assert any("quantity is zero" in x for x in reasons)
    assert any("unknown currency" in x for x in reasons)
    assert any("ship_date before order_date" in x for x in reasons)
    assert [x["row_number"] for x in r.rejects] == [3, 4, 5, 6, 7]


def test_negative_quantity_is_a_return(mappings):
    df = _frame([{"order_id": "R1", "order_date": "2026-01-01", "product_id": "P1", "quantity": "-2",
                  "unit_price": "5", "currency": "eur"}])
    row = transform(df, "orders", mappings, fx_rates=FX).data.iloc[0]
    assert row.order_status == "returned" and row.quantity == 2
    assert row.currency == "EUR" and row.fx_rate == 1.08


def test_duplicates_keep_last(mappings):
    df = _frame([{"customer_id": "C1", "segment": "b2c"}, {"customer_id": "C1", "segment": "enterprise"}])
    r = transform(df, "customers", mappings)
    assert len(r.data) == 1 and r.data.iloc[0].segment == "Corporate"


def test_target_months(mappings):
    df = _frame([{"month": "2026-03", "target": "1000"}, {"month": "Apr 2026", "target": "5"}])
    r = transform(df, "targets", mappings)
    assert [str(d) for d in r.data.target_month] == ["2026-03-01", "2026-04-01"]
    assert set(r.data.store_id) == {"ALL"}


def test_detect_entity(mappings):
    cols = ["invoice_no", "date", "sku", "qty", "price"]
    assert detect_entity(Path("pos_export.csv"), cols, mappings) == "orders"
    assert detect_entity(Path("x/export.csv"), cols, mappings) == "orders"          # by content
    assert detect_entity(Path("customers/export.csv"), [], mappings) == "customers"  # by folder
    with pytest.raises(ExtractError):
        detect_entity(Path("random.csv"), ["foo", "bar"], mappings)


def test_read_file_sniffs_delimiter_and_json(tmp_path):
    p = tmp_path / "a.csv"
    p.write_text("Order No;Qty\nA1;2\n;\n")
    df = read_file(p)
    assert list(df.columns) == ["order_no", "qty"] and len(df) == 1
    j = tmp_path / "b.json"
    j.write_text('{"data": [{"SKU": "P1", "Price": 2.5}]}')
    assert read_file(j).to_dict("records") == [{"sku": "P1", "price": "2.5"}]
