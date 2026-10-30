import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from app.db import get_session
from app.main import app
from app.seed import seed_categories


@pytest.fixture
def client():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    SQLModel.metadata.create_all(engine)
    with Session(engine) as s:
        seed_categories(s)

    def override():
        with Session(engine) as s:
            yield s

    app.dependency_overrides[get_session] = override
    yield TestClient(app)
    app.dependency_overrides.clear()


def cat_id(client, name):
    return next(c["id"] for c in client.get("/categories").json() if c["name"] == name)


def test_balance_follows_transactions(client):
    acc = client.post("/accounts", json={"name": "Main", "initial_balance_cents": 10000}).json()
    assert acc["balance_cents"] == 10000

    client.post("/transactions", json={"account_id": acc["id"], "kind": "income", "amount_cents": 5000,
                                       "date": "2026-10-01", "category_id": cat_id(client, "Salary")})
    client.post("/transactions", json={"account_id": acc["id"], "kind": "expense", "amount_cents": 2500,
                                       "date": "2026-10-03", "category_id": cat_id(client, "Groceries")})

    assert client.get(f"/accounts/{acc['id']}").json()["balance_cents"] == 12500


def test_category_kind_must_match(client):
    acc = client.post("/accounts", json={"name": "Main"}).json()
    r = client.post("/transactions", json={"account_id": acc["id"], "kind": "income", "amount_cents": 100,
                                           "date": "2026-10-01", "category_id": cat_id(client, "Groceries")})
    assert r.status_code == 422


def test_amount_must_be_positive(client):
    acc = client.post("/accounts", json={"name": "Main"}).json()
    r = client.post("/transactions", json={"account_id": acc["id"], "kind": "expense", "amount_cents": -5,
                                           "date": "2026-10-01"})
    assert r.status_code == 422


def test_budget_tracks_spending_and_upserts(client):
    acc = client.post("/accounts", json={"name": "Main"}).json()
    groceries = cat_id(client, "Groceries")
    client.post("/budgets", json={"category_id": groceries, "month": "2026-10", "limit_cents": 20000})
    client.post("/budgets", json={"category_id": groceries, "month": "2026-10", "limit_cents": 30000})  # upsert
    for amount, d in [(4000, "2026-10-05"), (6000, "2026-10-20"), (9999, "2026-11-01")]:
        client.post("/transactions", json={"account_id": acc["id"], "kind": "expense", "amount_cents": amount,
                                           "date": d, "category_id": groceries})

    budgets = client.get("/budgets", params={"month": "2026-10"}).json()
    assert len(budgets) == 1
    assert budgets[0]["limit_cents"] == 30000
    assert budgets[0]["spent_cents"] == 10000


def test_copy_budgets(client):
    groceries = cat_id(client, "Groceries")
    client.post("/budgets", json={"category_id": groceries, "month": "2026-10", "limit_cents": 20000})
    copied = client.post("/budgets/copy", params={"from_month": "2026-10", "to_month": "2026-11"}).json()
    assert [b["limit_cents"] for b in copied] == [20000]


def test_dashboard(client):
    acc = client.post("/accounts", json={"name": "Main", "initial_balance_cents": 1000}).json()
    client.post("/transactions", json={"account_id": acc["id"], "kind": "income", "amount_cents": 50000,
                                       "date": "2026-10-01"})
    client.post("/transactions", json={"account_id": acc["id"], "kind": "expense", "amount_cents": 3000,
                                       "date": "2026-10-02", "category_id": cat_id(client, "Transport")})
    client.post("/transactions", json={"account_id": acc["id"], "kind": "expense", "amount_cents": 7000,
                                       "date": "2026-09-15", "category_id": cat_id(client, "Leisure")})

    d = client.get("/dashboard", params={"month": "2026-10", "months_back": 3}).json()
    assert d["total_balance_cents"] == 1000 + 50000 - 3000 - 7000
    assert d["income_cents"] == 50000 and d["expense_cents"] == 3000 and d["net_cents"] == 47000
    assert d["spending_by_category"][0]["name"] == "Transport"
    assert [t["month"] for t in d["trend"]] == ["2026-08", "2026-09", "2026-10"]
    assert d["trend"][1]["expense_cents"] == 7000
    assert len(d["recent"]) == 3


def test_delete_category_uncategorises_transactions(client):
    acc = client.post("/accounts", json={"name": "Main"}).json()
    leisure = cat_id(client, "Leisure")
    tx = client.post("/transactions", json={"account_id": acc["id"], "kind": "expense", "amount_cents": 100,
                                            "date": "2026-10-01", "category_id": leisure}).json()
    assert client.delete(f"/categories/{leisure}").status_code == 204
    txs = client.get("/transactions").json()
    assert txs[0]["id"] == tx["id"] and txs[0]["category_id"] is None
