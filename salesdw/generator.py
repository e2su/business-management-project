"""Synthetic data for a fictional company, "Horizon Retail Co." - a multi-channel
retailer of electronics, furniture and office supplies with stores in several
countries. Use it to demo the platform or to load-test it.

* `generate_history` writes a full set of master data + monthly order files.
* `generate_increment` writes one day of new activity using *different* column
  names and value spellings (as a second source system would), plus a customer
  update, to demonstrate schema flexibility and SCD2 history.
"""
from __future__ import annotations

import math
import random
from datetime import date, timedelta
from pathlib import Path

import pandas as pd

CATALOG = {
    "Electronics": {
        "Laptops": ["Nova", "Orbit", "Pulse"], "Phones": ["Nova", "Zenit"], "Accessories": ["Pulse", "Keystone"],
        "Monitors": ["Orbit", "Vista"],
    },
    "Furniture": {"Chairs": ["ErgoMax", "Comfort+"], "Desks": ["ErgoMax", "Oakline"], "Storage": ["Oakline", "Boxit"]},
    "Office Supplies": {"Paper": ["Papyra", "WhiteLeaf"], "Writing": ["InkWell", "Papyra"],
                        "Binders": ["Boxit", "WhiteLeaf"], "Printers Ink": ["InkWell", "Vista"]},
}
PRICE_RANGE = {
    "Laptops": (650, 2200), "Phones": (250, 1300), "Accessories": (12, 120), "Monitors": (140, 700),
    "Chairs": (90, 650), "Desks": (180, 1200), "Storage": (40, 400),
    "Paper": (4, 35), "Writing": (2, 25), "Binders": (3, 20), "Printers Ink": (15, 90),
}
STORES = [
    # id, name, channel, city, region, country, currency, weight
    ("S001", "Horizon Downtown", "Retail", "New York", "North America", "United States", "USD", 1.4),
    ("S002", "Horizon Westfield", "Retail", "Los Angeles", "North America", "United States", "USD", 1.1),
    ("S003", "Horizon Lakeshore", "Retail", "Chicago", "North America", "United States", "USD", 0.9),
    ("S004", "Horizon Oxford St", "Retail", "London", "Europe", "United Kingdom", "GBP", 1.0),
    ("S005", "Horizon Berlin Mitte", "Retail", "Berlin", "Europe", "Germany", "EUR", 0.8),
    ("S006", "Horizon Dubai Mall", "Retail", "Dubai", "Middle East", "United Arab Emirates", "AED", 1.0),
    ("S007", "Horizon Riyadh Park", "Retail", "Riyadh", "Middle East", "Saudi Arabia", "SAR", 0.9),
    ("S008", "Horizon Cairo Festival", "Retail", "Cairo", "Africa", "Egypt", "EGP", 0.6),
    ("ONLINE", "Horizon Online Store", "Online", "Online", "Global", "Global", "USD", 2.2),
    ("W001", "Horizon B2B Wholesale", "Wholesale", "Newark", "North America", "United States", "USD", 0.7),
]
FX = {"USD": 1.0, "EUR": 1.08, "GBP": 1.27, "SAR": 0.2667, "AED": 0.2723, "EGP": 0.0206}
FIRST = ["James", "Mary", "Ahmed", "Fatima", "Liam", "Olivia", "Omar", "Sara", "Noah", "Emma", "Youssef",
         "Layla", "Lucas", "Mia", "Khalid", "Nour", "Ethan", "Ava", "Hassan", "Hana", "Leon", "Sofia"]
LAST = ["Smith", "Johnson", "Hassan", "Ali", "Brown", "Garcia", "Mansour", "Khan", "Miller", "Schmidt",
        "Taylor", "Haddad", "Wilson", "Nasser", "Clark", "Farouk", "Weber", "Lopez"]
COMPANY = ["Apex", "Bright", "Cedar", "Delta", "Evergreen", "Falcon", "Granite", "Harbor", "Ionic", "Juniper"]
SUFFIX = ["Holdings", "Consulting", "Logistics", "Partners", "Labs", "Trading", "Group"]
REPS = {"S001": ["Anna Lee", "Mark Ortiz"], "S002": ["Chris Young"], "S003": ["Dana White"],
        "S004": ["Oliver Grant"], "S005": ["Jonas Keller"], "S006": ["Rania Saleh", "Imran Qureshi"],
        "S007": ["Faisal Otaibi"], "S008": ["Mona Adel"], "ONLINE": ["E-commerce"], "W001": ["Victor Hale"]}
SEASON = {1: 0.8, 2: 0.78, 3: 0.92, 4: 0.9, 5: 0.95, 6: 0.97, 7: 0.93, 8: 1.05, 9: 1.02, 10: 1.0, 11: 1.35, 12: 1.55}
PAYMENT = {"Retail": ["Card", "Card", "Cash", "Wallet"], "Online": ["Card", "Card", "Wallet"],
           "Wholesale": ["Bank Transfer", "Invoice"]}


def _customers(rng: random.Random, n: int) -> pd.DataFrame:
    rows = []
    countries = [(s[3], s[5]) for s in STORES if s[5] != "Global"]
    for i in range(1, n + 1):
        segment = rng.choices(["Consumer", "Corporate", "Small Business"], [0.62, 0.23, 0.15])[0]
        city, country = rng.choice(countries)
        if segment == "Consumer":
            f, l = rng.choice(FIRST), rng.choice(LAST)
            name, email = f"{f} {l}", f"{f}.{l}{i}@example.com".lower()
        else:
            name = f"{rng.choice(COMPANY)} {rng.choice(SUFFIX)}"
            email = f"purchasing{i}@{name.split()[0].lower()}.example.com"
        rows.append({"customer_id": f"C{i:05d}", "customer_name": name, "email": email, "segment": segment,
                     "city": city, "state": "", "country": country,
                     "signup_date": date(2021, 1, 1) + timedelta(days=rng.randint(0, 900))})
    return pd.DataFrame(rows)


def _products(rng: random.Random) -> pd.DataFrame:
    rows, i = [], 1
    for cat, subs in CATALOG.items():
        for sub, brands in subs.items():
            for brand in brands:
                for model in range(rng.randint(2, 4)):
                    lo, hi = PRICE_RANGE[sub]
                    price = round(math.exp(rng.uniform(math.log(lo), math.log(hi))), 2)
                    margin = rng.uniform(0.18, 0.45) if cat != "Electronics" else rng.uniform(0.1, 0.28)
                    rows.append({"product_id": f"P{i:04d}", "product_name": f"{brand} {sub[:-1] if sub.endswith('s') else sub} {100 + model * 10 + rng.randint(0, 9)}",
                                 "category": cat, "subcategory": sub, "brand": brand,
                                 "unit_cost": round(price * (1 - margin), 2), "list_price": price})
                    i += 1
    return pd.DataFrame(rows)


def _stores() -> pd.DataFrame:
    return pd.DataFrame([{"store_id": s[0], "store_name": s[1], "channel": s[2], "city": s[3], "region": s[4],
                          "country": s[5], "opened_date": date(2019, 1, 1) + timedelta(days=97 * k)}
                         for k, s in enumerate(STORES)])


def _orders_for_day(rng, day, products, customers, start, order_seq, daily_orders, pop_weights):
    growth = 1 + 0.18 * ((day - start).days / 365)            # ~18% yearly growth
    weekend = 1.25 if day.weekday() >= 5 else 1.0
    n = max(0, int(rng.gauss(daily_orders * SEASON[day.month] * growth * weekend, daily_orders * 0.15)))
    lines = []
    for _ in range(n):
        store = rng.choices(STORES, [s[7] for s in STORES])[0]
        sid, channel, currency = store[0], store[2], store[6]
        guest = channel == "Retail" and rng.random() < 0.25
        cust = "GUEST" if guest else customers[rng.randrange(len(customers))]
        order_seq[0] += 1
        oid = f"SO-{day:%Y%m%d}-{order_seq[0]:06d}"
        status = rng.choices(["completed", "returned", "cancelled", "pending"], [0.93, 0.04, 0.02, 0.01])[0]
        if (date.today() - day).days < 3:
            status = rng.choice(["pending", "completed"])
        n_lines = rng.choices([1, 2, 3, 4], [0.55, 0.25, 0.12, 0.08])[0] * (3 if channel == "Wholesale" else 1)
        promo = day.month in (11, 12) or rng.random() < 0.12
        for ln in range(1, n_lines + 1):
            p = products[rng.choices(range(len(products)), pop_weights)[0]]
            qty = rng.choices([1, 2, 3, 5], [0.7, 0.18, 0.08, 0.04])[0] * (rng.randint(5, 20) if channel == "Wholesale" else 1)
            local_price = round(p["list_price"] * rng.uniform(0.97, 1.03) / FX[currency], 2)
            disc = rng.choice([0.05, 0.1, 0.15, 0.2]) if promo else (0.08 if channel == "Wholesale" else 0.0)
            ship = day + timedelta(days=rng.randint(1, 6)) if channel != "Retail" else day
            lines.append({"order_id": oid, "line_number": ln, "order_date": day, "ship_date": ship,
                          "customer_id": cust, "product_id": p["product_id"], "store_id": sid,
                          "sales_rep": rng.choice(REPS[sid]), "quantity": qty, "unit_price": local_price,
                          "discount": disc, "shipping_cost": round(rng.uniform(4, 25), 2) if channel == "Online" and ln == 1 else 0,
                          "payment_method": rng.choice(PAYMENT[channel]), "order_status": status, "currency": currency})
    return lines


def generate_history(out_dir: Path, start: date, end: date, *, customers: int = 1500,
                     daily_orders: int = 40, seed: int = 42) -> list[Path]:
    rng = random.Random(seed)
    out_dir.mkdir(parents=True, exist_ok=True)
    # Master data uses its own seeded RNGs so increments can reproduce it exactly.
    cust = _customers(random.Random(seed + 1), customers)
    prod = _products(random.Random(seed + 2))
    written = []
    for name, df in (("stores.csv", _stores()), ("customers.csv", cust), ("products.csv", prod)):
        df.to_csv(out_dir / name, index=False)
        written.append(out_dir / name)

    products = prod.to_dict("records")
    pop = [rng.paretovariate(1.3) for _ in products]           # a few best-sellers, long tail
    cust_ids = cust["customer_id"].tolist()
    order_seq = [0]
    months: dict[str, list] = {}
    day = start
    while day <= end:
        months.setdefault(f"{day:%Y_%m}", []).extend(
            _orders_for_day(rng, day, products, cust_ids, start, order_seq, daily_orders, pop))
        day += timedelta(days=1)
    for ym, lines in months.items():
        p = out_dir / f"orders_{ym}.csv"
        pd.DataFrame(lines).to_csv(p, index=False)
        written.append(p)

    # Monthly targets per store: last year's pattern + 10% stretch, and a company-wide target.
    orders = pd.concat(pd.read_csv(p) for p in written if p.name.startswith("orders_"))
    orders["net"] = orders.quantity * orders.unit_price * (1 - orders.discount) * orders.currency.map(FX)
    orders["month"] = pd.to_datetime(orders.order_date).dt.to_period("M")
    by_store = orders[orders.order_status.isin(["completed", "pending"])].groupby(["month", "store_id"]).net.sum()
    targets = []
    last_month = pd.Period(end, "M")
    for (month, sid), actual in by_store.items():
        noise = rng.uniform(0.95, 1.12)
        targets.append({"month": str(month), "store_id": sid, "category": "ALL", "target": round(actual * noise, -2)})
    for k in range(1, 4):  # targets for the next 3 months so the plan is visible ahead of actuals
        for sid, month_actual in by_store.xs(last_month, level="month").items():
            targets.append({"month": str(last_month + k), "store_id": sid, "category": "ALL",
                            "target": round(month_actual * 1.1, -2)})
    tdf = pd.DataFrame(targets)
    company = tdf.groupby("month", as_index=False).target.sum().assign(store_id="ALL", category="ALL")
    tdf = pd.concat([tdf, company[tdf.columns]])
    p = out_dir / "targets.csv"
    tdf.to_csv(p, index=False)
    written.append(p)
    return written


def generate_increment(out_dir: Path, day: date, *, daily_orders: int = 40, seed: int | None = None,
                       customers: int = 1500, history_seed: int = 42) -> list[Path]:
    """One day of new activity from a *different* source system (POS export)."""
    rng = random.Random(seed if seed is not None else day.toordinal())
    out_dir.mkdir(parents=True, exist_ok=True)
    prod = _products(random.Random(history_seed + 2))  # same catalogue as history
    products = prod.to_dict("records")
    pop = [random.Random(i).paretovariate(1.3) for i in range(len(products))]
    cust_ids = [f"C{i:05d}" for i in range(1, customers + 1)]
    lines = _orders_for_day(rng, day, products, cust_ids, day - timedelta(days=365), [rng.randint(500000, 900000)],
                            daily_orders, pop)
    # A brand-new customer that is not in the CRM yet -> becomes an inferred member.
    if lines:
        lines[0]["customer_id"] = f"C9{rng.randint(1000, 9999)}"
    status_spelling = {"completed": "Delivered", "returned": "Refunded", "cancelled": "VOID", "pending": "Processing"}
    pos = pd.DataFrame([{
        "Invoice No": ln["order_id"], "Line": ln["line_number"], "Sale Date": ln["order_date"].strftime("%d %b %Y"),
        "Branch ID": ln["store_id"], "Cust ID": ln["customer_id"], "SKU": ln["product_id"],
        "Qty": ln["quantity"], "Selling Price": ln["unit_price"], "Disc %": f"{ln['discount'] * 100:.0f}%",
        "Currency Code": ln["currency"], "Status": status_spelling[ln["order_status"]],
        "Tender": ln["payment_method"].lower().replace(" ", "_"), "Cashier": ln["sales_rep"],
        "Loyalty Points": int(ln["quantity"] * ln["unit_price"] // 10),   # a column nobody mapped yet
    } for ln in lines])
    written = []
    p = out_dir / f"pos_export_{day:%Y%m%d}.csv"
    pos.to_csv(p, index=False, sep=";")
    written.append(p)

    # CRM update: a couple of customers change segment/city (tracked as SCD2 history).
    upd = _customers(random.Random(history_seed + 1), customers).sample(2, random_state=day.toordinal() % 1000)
    upd["segment"] = upd["segment"].map({"Consumer": "Small Business", "Small Business": "Corporate",
                                         "Corporate": "Corporate"})
    upd = upd.rename(columns={"customer_id": "Client ID", "customer_name": "Client Name", "segment": "Customer Type"})
    p = out_dir / f"crm_update_{day:%Y%m%d}.csv"
    upd.to_csv(p, index=False)
    written.append(p)
    return written
