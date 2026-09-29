"""End-to-end tests: files in the landing zone -> warehouse -> marts."""
from datetime import date

from salesdw.etl.pipeline import run_pipeline
from salesdw.generator import generate_history, generate_increment
from tests.conftest import requires_db, scalar

pytestmark = requires_db


def _write(settings, name, content):
    p = settings.incoming / name
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content)
    return p


def test_history_load_is_complete_and_idempotent(env):
    settings, engine = env
    files = generate_history(settings.incoming, date(2025, 1, 1), date(2025, 3, 31), customers=80, daily_orders=5)
    orders_in_files = sum(sum(1 for _ in open(f)) - 1 for f in files if f.name.startswith("orders_"))

    s = run_pipeline(engine=engine, settings=settings)
    assert s.status == "success" and s.rows_rejected == 0
    assert scalar(engine, "SELECT count(*) FROM dw.fact_sales") == orders_in_files
    assert scalar(engine, "SELECT count(*) FROM dw.dim_customer WHERE is_inferred") == 0
    assert not list(settings.incoming.glob("*.csv"))                     # files archived
    # Net sales in the mart equals the fact table total for revenue lines.
    assert scalar(engine, 'SELECT round(sum("Net Sales")) FROM mart.monthly_kpis') == \
        scalar(engine, "SELECT round(sum(net_amount)) FROM dw.fact_sales WHERE is_revenue")
    assert scalar(engine, 'SELECT count(*) FROM mart.target_vs_actual WHERE "Actual" > 0') > 0

    # Dropping the very same files again loads nothing twice.
    generate_history(settings.incoming, date(2025, 1, 1), date(2025, 3, 31), customers=80, daily_orders=5)
    s2 = run_pipeline(engine=engine, settings=settings)
    assert {f.status for f in s2.files} == {"skipped"}
    assert scalar(engine, "SELECT count(*) FROM dw.fact_sales") == orders_in_files


def test_messy_increment_scd2_and_drift(env):
    settings, engine = env
    generate_history(settings.incoming, date(2025, 1, 1), date(2025, 1, 31), customers=80, daily_orders=5)
    run_pipeline(engine=engine, settings=settings)
    before = scalar(engine, "SELECT count(*) FROM dw.fact_sales")

    generate_increment(settings.incoming, date(2025, 2, 1), customers=80, daily_orders=5)
    s = run_pipeline(engine=engine, settings=settings)
    assert s.status == "success", s.to_dict()
    pos = next(f for f in s.files if f.file.startswith("pos_export"))
    assert pos.entity == "orders" and pos.rows_loaded > 0 and pos.new_columns == ["loyalty_points"]
    assert scalar(engine, "SELECT count(*) FROM dw.fact_sales") == before + pos.rows_loaded
    assert scalar(engine, "SELECT count(*) FROM meta.schema_drift WHERE column_name = 'loyalty_points'") == 1
    assert scalar(engine, "SELECT count(*) FROM dw.fact_sales WHERE extra_attributes ? 'loyalty_points'") > 0
    # one brand-new customer arrived before the CRM knew it -> inferred member
    assert scalar(engine, "SELECT count(*) FROM dw.dim_customer WHERE is_inferred") == 1
    # every customer has exactly one current version
    assert scalar(engine, "SELECT count(*) FROM (SELECT customer_id FROM dw.dim_customer "
                          "WHERE is_current GROUP BY 1 HAVING count(*) > 1) x") == 0


def test_scd2_keeps_history_for_old_sales(env):
    settings, engine = env
    _write(settings, "products.csv", "sku,name,category,cost,price\nP1,Chair,Furniture,40,100\n")
    _write(settings, "customers.csv", "customer_id,name,segment\nC1,Acme,Consumer\n")
    _write(settings, "orders_1.csv", "order_id,order_date,customer_id,product_id,qty,price\nO1,2025-01-10,C1,P1,1,100\n")
    run_pipeline(engine=engine, settings=settings)

    # customer moves segment, product cost rises
    _write(settings, "customers.csv", "customer_id,name,segment\nC1,Acme,Corporate\n")
    _write(settings, "products.csv", "sku,name,category,cost,price\nP1,Chair,Furniture,60,100\n")
    _write(settings, "orders_2.csv", "order_id,order_date,customer_id,product_id,qty,price\nO2,2099-01-10,C1,P1,1,100\n")
    run_pipeline(engine=engine, settings=settings)

    assert scalar(engine, "SELECT count(*) FROM dw.dim_customer WHERE customer_id = 'C1'") == 2
    seg = "SELECT c.segment FROM dw.fact_sales f JOIN dw.dim_customer c USING (customer_key) WHERE order_id = :o"
    assert scalar(engine, seg, o="O1") == "Consumer"      # history preserved
    assert scalar(engine, seg, o="O2") == "Corporate"
    assert scalar(engine, "SELECT cost_amount FROM dw.fact_sales WHERE order_id = 'O1'") == 40
    assert scalar(engine, "SELECT cost_amount FROM dw.fact_sales WHERE order_id = 'O2'") == 60


def test_late_arriving_product_and_status_update(env):
    settings, engine = env
    _write(settings, "orders_a.csv",
           "order_id,order_date,product_id,qty,price,status\nO1,2025-05-01,NEW1,2,50,pending\n")
    run_pipeline(engine=engine, settings=settings)
    assert scalar(engine, "SELECT is_inferred FROM dw.dim_product WHERE product_id = 'NEW1'") is True
    assert scalar(engine, "SELECT profit_amount FROM dw.fact_sales") == 100

    # product master data arrives later -> completed in place and margin fixed
    _write(settings, "products.csv", "product_id,product_name,unit_cost,list_price\nNEW1,Lamp,30,50\n")
    # the same order line is re-sent with a new status -> updated, not duplicated
    _write(settings, "orders_b.csv",
           "order_id,order_date,product_id,qty,price,status\nO1,2025-05-01,NEW1,2,50,refunded\n")
    run_pipeline(engine=engine, settings=settings)
    assert scalar(engine, "SELECT count(*) FROM dw.dim_product WHERE product_id = 'NEW1'") == 1
    assert scalar(engine, "SELECT product_name FROM dw.dim_product WHERE product_id = 'NEW1'") == "Lamp"
    assert scalar(engine, "SELECT count(*) FROM dw.fact_sales") == 1
    assert scalar(engine, "SELECT profit_amount FROM dw.fact_sales") == 40
    assert scalar(engine, "SELECT is_returned AND NOT is_revenue FROM dw.fact_sales") is True


def test_bad_rows_and_bad_files(env):
    settings, engine = env
    _write(settings, "orders_ok.csv",
           "order_id,order_date,product_id,qty,price\nO1,2025-01-01,P1,1,10\nO2,garbage,P1,1,10\n"
           "O3,2025-01-02,P1,1,10\n")
    _write(settings, "orders_broken.csv", "order_id,order_date,product_id,qty,price\nX,bad,P1,1,1\nY,bad,P1,1,1\n")
    _write(settings, "mystery.csv", "foo,bar\n1,2\n")
    s = run_pipeline(engine=engine, settings=settings)
    by_file = {f.file: f for f in s.files}
    assert s.status == "partial"
    assert by_file["orders_ok.csv"].status == "loaded" and by_file["orders_ok.csv"].rows_rejected == 1
    assert by_file["orders_broken.csv"].status == "failed"       # over max_reject_ratio
    assert by_file["mystery.csv"].status == "failed"             # entity unknown
    assert scalar(engine, "SELECT count(*) FROM dw.fact_sales") == 2
    assert scalar(engine, "SELECT row_number FROM meta.rejected_rows WHERE file_name = 'orders_ok.csv'") == 3
    assert len(list(settings.failed.rglob("*.csv"))) == 2
