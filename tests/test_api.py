from fastapi.testclient import TestClient

from salesdw import config
from salesdw.api import app
from tests.conftest import requires_db, scalar

pytestmark = requires_db


def test_upload_push_and_monitor(env):
    _, engine = env
    client = TestClient(app)
    assert client.get("/health").json()["database"] == "ok"

    csv = b"Invoice No,Sale Date,SKU,Qty,Price\nINV1,2025-06-01,P9,3,20\n"
    r = client.post("/files", files={"file": ("pos.csv", csv, "text/csv")})
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "success" and r.json()["rows_loaded"] == 1

    r = client.post("/records/orders", json=[
        {"Order No": "W1", "Date": "2025-06-02", "SKU": "P9", "Qty": 1, "Price": 20, "Status": "paid"}])
    assert r.status_code == 200 and r.json()["rows_loaded"] == 1
    assert scalar(engine, "SELECT count(*) FROM dw.fact_sales") == 2

    runs = client.get("/runs").json()
    assert len(runs) == 2
    assert client.get(f"/runs/{runs[0]['run_id']}").json()["files"][0]["entity"] == "orders"
    assert client.get("/kpis?days=30").json()["current"]["orders"] == 2
    assert client.post("/records/nonsense", json=[{"a": 1}]).status_code == 422


def test_api_key(env, monkeypatch):
    monkeypatch.setenv("SALESDW_API_KEY", "secret")
    config.get_settings.cache_clear()
    client = TestClient(app)
    assert client.get("/runs").status_code == 401
    assert client.get("/runs", headers={"X-API-Key": "secret"}).status_code == 200
    assert client.get("/health").status_code == 200
