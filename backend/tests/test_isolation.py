"""Authorisation: a logged-in user can only see and change their own data.

`client` and `other_client` are two different users. Everything `client` creates must be
invisible to `other_client`, and reaching for it by id must look like it doesn't exist (404).
"""

import pytest


def cat_id(client, name):
    return next(c["id"] for c in client.get("/categories").json() if c["name"] == name)


@pytest.fixture
def mine(client):
    """One of everything, owned by `client`."""
    acc = client.post("/accounts", json={"name": "Main", "initial_balance_cents": 10000}).json()
    groceries = cat_id(client, "Groceries")
    tx = client.post("/transactions", json={"account_id": acc["id"], "kind": "expense", "amount_cents": 2500,
                                            "date": "2026-10-03", "category_id": groceries}).json()
    budget = client.post("/budgets", json={"category_id": groceries, "month": "2026-10", "limit_cents": 20000}).json()
    return {"account": acc["id"], "category": groceries, "transaction": tx["id"], "budget": budget["id"]}


def test_lists_only_show_own_rows(client, other_client, mine):
    assert other_client.get("/accounts").json() == []
    assert other_client.get("/transactions").json() == []
    assert other_client.get("/budgets", params={"month": "2026-10"}).json() == []
    assert mine["category"] not in [c["id"] for c in other_client.get("/categories").json()]


def test_each_user_gets_their_own_default_categories(client, other_client):
    mine, theirs = client.get("/categories").json(), other_client.get("/categories").json()
    assert len(mine) == len(theirs) == 14
    assert {c["id"] for c in mine}.isdisjoint({c["id"] for c in theirs})


def test_other_users_rows_look_missing(other_client, mine):
    assert other_client.get(f"/accounts/{mine['account']}").status_code == 404
    assert other_client.patch(f"/accounts/{mine['account']}", json={"name": "Stolen"}).status_code == 404
    assert other_client.delete(f"/accounts/{mine['account']}").status_code == 404
    assert other_client.get(f"/transactions/{mine['transaction']}").status_code == 404
    assert other_client.patch(f"/transactions/{mine['transaction']}", json={"amount_cents": 1}).status_code == 404
    assert other_client.delete(f"/transactions/{mine['transaction']}").status_code == 404
    assert other_client.patch(f"/budgets/{mine['budget']}", json={"limit_cents": 1}).status_code == 404
    assert other_client.delete(f"/budgets/{mine['budget']}").status_code == 404
    assert other_client.delete(f"/categories/{mine['category']}").status_code == 404


def test_nothing_was_changed_by_the_other_user(client, other_client, mine):
    test_other_users_rows_look_missing(other_client, mine)
    assert client.get(f"/accounts/{mine['account']}").json()["name"] == "Main"
    assert client.get(f"/transactions/{mine['transaction']}").json()["amount_cents"] == 2500
    assert client.get("/budgets", params={"month": "2026-10"}).json()[0]["limit_cents"] == 20000


def test_cannot_post_into_another_users_account_or_category(client, other_client, mine):
    their_account = other_client.post("/accounts", json={"name": "Theirs"}).json()["id"]
    body = {"kind": "expense", "amount_cents": 100, "date": "2026-10-01"}
    # their transaction, my account
    assert other_client.post("/transactions", json={**body, "account_id": mine["account"]}).status_code == 422
    # their account, my category
    r = other_client.post("/transactions", json={**body, "account_id": their_account, "category_id": mine["category"]})
    assert r.status_code == 422
    # a budget on my category
    r = other_client.post("/budgets", json={"category_id": mine["category"], "month": "2026-10", "limit_cents": 5})
    assert r.status_code == 422
    assert client.get("/budgets", params={"month": "2026-10"}).json()[0]["limit_cents"] == 20000


def test_cannot_move_a_transaction_into_another_users_account(client, other_client, mine):
    their_account = other_client.post("/accounts", json={"name": "Theirs"}).json()["id"]
    r = client.patch(f"/transactions/{mine['transaction']}", json={"account_id": their_account})
    assert r.status_code == 422


def test_dashboard_and_balances_are_per_user(client, other_client, mine):
    other_client.post("/accounts", json={"name": "Theirs", "initial_balance_cents": 500})
    mine_dash = client.get("/dashboard", params={"month": "2026-10"}).json()
    their_dash = other_client.get("/dashboard", params={"month": "2026-10"}).json()
    assert mine_dash["total_balance_cents"] == 7500 and mine_dash["expense_cents"] == 2500
    assert their_dash["total_balance_cents"] == 500 and their_dash["expense_cents"] == 0
    assert their_dash["recent"] == [] and their_dash["spending_by_category"] == []


def test_copy_budgets_only_copies_own(client, other_client, mine):
    assert other_client.post("/budgets/copy", params={"from_month": "2026-10", "to_month": "2026-11"}).json() == []
    assert len(client.post("/budgets/copy", params={"from_month": "2026-10", "to_month": "2026-11"}).json()) == 1
