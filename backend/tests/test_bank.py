"""Bank connections, using the sandbox bank (no network)."""

from datetime import date, timedelta

import pytest
from sqlmodel import Session, select

from app.models import BankConnection, Transaction
from app.services import crypto
from app.services.banking.redirects import is_allowed_redirect, with_query
from app.services.categorise import guess_category_id

REDIRECT = "financeapp://bank-callback"
BANK = "sandbox-norte"


def start(client, institution=BANK, redirect=REDIRECT):
    return client.post("/bank/connections", json={"institution_id": institution, "redirect_url": redirect})


def approve(anon, auth_url):
    """Play the user's part: open the bank's page and press Allow."""
    path = auth_url.split("testserver", 1)[1]
    assert anon.get(path).status_code == 200
    return anon.post(f"{path}/approve", follow_redirects=False)


@pytest.fixture
def linked(client, anon_client):
    """A fully connected sandbox bank for `client`. Returns the connection id."""
    link = start(client).json()
    approve(anon_client, link["auth_url"])
    r = client.post(f"/bank/connections/{link['connection']['id']}/complete")
    assert r.status_code == 200, r.text
    return link["connection"]["id"]


def bank_accounts(client):
    return [a for a in client.get("/accounts").json() if a["source"] == "bank"]


# ---- linking -----------------------------------------------------------------------------------


def test_institutions(client):
    banks = client.get("/bank/institutions").json()
    assert BANK in [b["id"] for b in banks] and banks[0]["provider"] == "sandbox"
    assert all(b["country"] == "PT" for b in client.get("/bank/institutions", params={"country": "pt"}).json())


def test_full_link_flow(client, anon_client):
    r = start(client)
    assert r.status_code == 201
    link = r.json()
    cid = link["connection"]["id"]
    assert link["connection"]["status"] == "pending"
    assert client.get("/bank/connections").json() == []  # not listed until approved

    # Can't finish before the user approves at the bank
    assert client.post(f"/bank/connections/{cid}/complete").status_code == 409

    back = approve(anon_client, link["auth_url"])
    assert back.status_code == 303 and back.headers["location"] == f"{REDIRECT}?status=approved"

    done = client.post(f"/bank/connections/{cid}/complete").json()
    assert done["connection"]["status"] == "linked" and done["connection"]["account_count"] == 2
    assert done["imported"] > 0

    accounts = bank_accounts(client)
    assert len(accounts) == 2
    assert all(a["connection_id"] == cid and a["institution_name"] and a["last_synced_at"] for a in accounts)
    # Completing twice is harmless
    again = client.post(f"/bank/connections/{cid}/complete").json()
    assert again["imported"] == 0 and len(bank_accounts(client)) == 2


def test_consent_link_works_once(client, anon_client):
    link = start(client).json()
    approve(anon_client, link["auth_url"])
    path = link["auth_url"].split("testserver", 1)[1]
    assert anon_client.get(path).status_code == 404
    assert anon_client.post(f"{path}/approve").status_code == 404
    assert anon_client.get("/bank/sandbox/consent/not-a-real-ref").status_code == 404


def test_deny_removes_the_pending_connection(client, anon_client, engine):
    link = start(client).json()
    path = link["auth_url"].split("testserver", 1)[1]
    r = anon_client.post(f"{path}/deny", follow_redirects=False)
    assert r.headers["location"] == f"{REDIRECT}?status=denied"
    assert client.post(f"/bank/connections/{link['connection']['id']}/complete").status_code == 404
    with Session(engine) as s:
        assert s.exec(select(BankConnection)).all() == []


def test_starting_again_drops_unfinished_links(client, engine):
    start(client)
    start(client)
    with Session(engine) as s:
        assert len(s.exec(select(BankConnection)).all()) == 1


def test_validation(client):
    assert start(client, institution="no-such-bank").status_code == 422
    assert start(client, redirect="https://evil.example/steal").status_code == 422
    assert start(client, redirect="http://localhost.evil.example/x").status_code == 422
    assert start(client, redirect="http://localhost:8081/bank-callback").status_code == 201


def test_disabled_provider(client, monkeypatch):
    monkeypatch.setenv("BANK_PROVIDER", "none")
    assert client.get("/bank/institutions").status_code == 503
    assert start(client).status_code == 503


# ---- secrets -----------------------------------------------------------------------------------


def test_tokens_are_encrypted_and_never_returned(client, anon_client, engine):
    link = start(client).json()
    with Session(engine) as s:
        conn = s.exec(select(BankConnection)).one()
        token = crypto.decrypt(conn.credentials_encrypted)
        assert token.startswith("sandbox-token-")
        assert token not in conn.credentials_encrypted
        ref = conn.external_id
    approve(anon_client, link["auth_url"])
    cid = link["connection"]["id"]
    bodies = [
        str(link["connection"]),
        client.post(f"/bank/connections/{cid}/complete").text,
        client.get("/bank/connections").text,
        client.get("/accounts").text,
        client.get("/transactions").text,
    ]
    for body in bodies:
        assert token not in body and "credentials" not in body
    # The consent reference only ever appears in the auth_url
    assert all(ref not in body for body in bodies)


def test_decrypt_with_another_key_fails_safely(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", "a" * 40)
    secret = crypto.encrypt("bank-token")
    assert crypto.decrypt(secret) == "bank-token"
    monkeypatch.setenv("JWT_SECRET", "b" * 40)
    assert crypto.decrypt(secret) is None


# ---- sync --------------------------------------------------------------------------------------


def test_balance_matches_the_bank(client, linked, engine):
    """Balances are still computed: initial + Σ transactions must equal what the bank reports."""
    from app.services.banking.sandbox import SandboxProvider

    with Session(engine) as s:
        conn = s.get(BankConnection, linked)
        reported = {a.name: a.balance_cents for a in SandboxProvider().fetch_accounts(conn, None)}
    for acc in bank_accounts(client):
        name = next(n for n in reported if acc["name"].endswith(n))
        assert acc["balance_cents"] == reported[name]


def test_sync_twice_imports_nothing_new(client, linked):
    before = len(client.get("/transactions", params={"limit": 1000}).json())
    r = client.post(f"/bank/connections/{linked}/sync")
    assert r.status_code == 200 and r.json()["imported"] == 0
    assert len(client.get("/transactions", params={"limit": 1000}).json()) == before


def test_sync_picks_up_missing_transactions_and_keeps_edits(client, linked, engine):
    txs = client.get("/transactions", params={"limit": 1000}).json()
    edited = next(t for t in txs if t["description"] == "MERCADONA")
    client.patch(f"/transactions/{edited['id']}", json={"description": "Weekly shop"})
    balances = {a["id"]: a["balance_cents"] for a in bank_accounts(client)}
    # Pretend one imported row was never fetched
    with Session(engine) as s:
        victim = s.exec(select(Transaction).where(Transaction.id != edited["id"],
                                                  Transaction.date >= date.today() - timedelta(days=5))).first()
        s.delete(victim)
        s.commit()

    assert client.post(f"/bank/connections/{linked}/sync").json()["imported"] == 1
    assert client.get(f"/transactions/{edited['id']}").json()["description"] == "Weekly shop"
    assert {a["id"]: a["balance_cents"] for a in bank_accounts(client)} == balances


def test_imported_transactions_are_categorised(client, linked):
    cats = {c["id"]: c["name"] for c in client.get("/categories").json()}
    txs = client.get("/transactions", params={"limit": 1000}).json()
    by_desc = {t["description"]: cats.get(t["category_id"]) for t in txs}
    assert by_desc["NOMINA ACME SL"] == "Salary"
    assert by_desc["ALQUILER PISO"] == "Rent"
    assert by_desc["NETFLIX.COM"] == "Subscriptions"
    assert all(t["external_id"] for t in txs)
    assert {t["kind"] for t in txs} == {"income", "expense"} and all(t["amount_cents"] > 0 for t in txs)


def test_categorise_rules(client):
    from app.models import Category, TxKind

    cats = [Category(id=1, user_id=1, name="Groceries", kind=TxKind.expense), Category(id=2, user_id=1, name="Salary", kind=TxKind.income)]
    assert guess_category_id("Compra MERCADONA 1234", TxKind.expense, cats) == 1
    assert guess_category_id("NOMINA OCTUBRE", TxKind.income, cats) == 2
    assert guess_category_id("NOMINA OCTUBRE", TxKind.expense, cats) is None  # kind must match
    assert guess_category_id("Something unknown", TxKind.expense, cats) is None
    assert guess_category_id("NETFLIX", TxKind.expense, cats) is None  # user has no such category


def test_dashboard_includes_bank_money(client, linked):
    total = sum(a["balance_cents"] for a in bank_accounts(client))
    assert client.get("/dashboard").json()["total_balance_cents"] == total


# ---- bank accounts are read-only ---------------------------------------------------------------


def test_bank_account_rules(client, linked):
    acc = bank_accounts(client)[0]
    tx = client.get("/transactions", params={"account_id": acc["id"], "limit": 1}).json()[0]
    manual = client.post("/accounts", json={"name": "Wallet"}).json()
    groceries = next(c["id"] for c in client.get("/categories").json() if c["name"] == "Groceries")

    # no hand-made transactions in a bank account
    body = {"account_id": acc["id"], "kind": "expense", "amount_cents": 100, "date": "2026-10-01"}
    assert client.post("/transactions", json=body).status_code == 422
    # imported rows: amount, date, kind and account are fixed
    for change in ({"amount_cents": 1}, {"date": "2020-01-01"}, {"account_id": manual["id"]},
                   {"kind": "income" if tx["kind"] == "expense" else "expense"}):
        assert client.patch(f"/transactions/{tx['id']}", json=change).status_code == 422, change
    assert client.delete(f"/transactions/{tx['id']}").status_code == 422
    # ...but category and description are the user's to change, even when the form resends every field
    if tx["kind"] == "expense":
        r = client.patch(f"/transactions/{tx['id']}", json={**tx, "category_id": groceries, "description": "Mine"})
        assert r.status_code == 200 and r.json()["category_id"] == groceries
    # a manual transaction can't be moved into a bank account
    own = client.post("/transactions", json={**body, "account_id": manual["id"]}).json()
    assert client.patch(f"/transactions/{own['id']}", json={"account_id": acc["id"]}).status_code == 422
    # the account itself: rename only
    assert client.patch(f"/accounts/{acc['id']}", json={"name": "Everyday"}).json()["name"] == "Everyday"
    assert client.patch(f"/accounts/{acc['id']}", json={"initial_balance_cents": 1}).status_code == 422
    assert client.patch(f"/accounts/{acc['id']}", json={"type": "cash"}).status_code == 422


# ---- disconnecting -----------------------------------------------------------------------------


def test_disconnect_keeps_accounts_as_manual_and_reconnect_relinks(client, anon_client, linked):
    count = len(client.get("/transactions", params={"limit": 1000}).json())
    assert client.delete(f"/bank/connections/{linked}").status_code == 204
    assert client.get("/bank/connections").json() == []
    accounts = client.get("/accounts").json()
    assert len(accounts) == 2 and all(a["source"] == "manual" and a["connection_id"] is None for a in accounts)
    assert len(client.get("/transactions", params={"limit": 1000}).json()) == count
    assert client.post(f"/bank/connections/{linked}/sync").status_code == 404

    # Connecting the same bank again reuses the same two accounts and imports no duplicates
    link = start(client).json()
    approve(anon_client, link["auth_url"])
    done = client.post(f"/bank/connections/{link['connection']['id']}/complete").json()
    assert done["imported"] == 0
    assert len(client.get("/accounts").json()) == 2 and len(bank_accounts(client)) == 2


def test_disconnect_and_delete(client, linked):
    assert client.delete(f"/bank/connections/{linked}", params={"delete_accounts": True}).status_code == 204
    assert client.get("/accounts").json() == []
    assert client.get("/transactions").json() == []


def test_deleting_a_bank_account_stops_syncing_it(client, linked):
    acc = bank_accounts(client)[0]
    assert client.delete(f"/accounts/{acc['id']}").status_code == 204
    assert client.post(f"/bank/connections/{linked}/sync").json()["connection"]["account_count"] == 1
    assert len(bank_accounts(client)) == 1


# ---- isolation ---------------------------------------------------------------------------------


def test_connections_belong_to_one_user(client, other_client, anon_client, linked):
    assert other_client.get("/bank/connections").json() == []
    assert other_client.post(f"/bank/connections/{linked}/sync").status_code == 404
    assert other_client.post(f"/bank/connections/{linked}/complete").status_code == 404
    assert other_client.delete(f"/bank/connections/{linked}").status_code == 404
    assert len(client.get("/bank/connections").json()) == 1

    # Two users can connect the same bank and each get their own accounts
    link = start(other_client).json()
    approve(anon_client, link["auth_url"])
    other_client.post(f"/bank/connections/{link['connection']['id']}/complete")
    mine, theirs = bank_accounts(client), bank_accounts(other_client)
    assert len(mine) == len(theirs) == 2
    assert {a["id"] for a in mine}.isdisjoint({a["id"] for a in theirs})


# ---- redirect allowlist ------------------------------------------------------------------------


@pytest.mark.parametrize("url,ok", [
    ("financeapp://bank-callback", True),
    ("exp://192.168.1.20:8081/--/bank-callback", True),
    ("http://localhost:8081/bank-callback", True),
    ("http://127.0.0.1:19006/bank-callback", True),
    ("https://localhost/bank-callback", False),
    ("http://localhost.evil.example/", False),
    ("http://evil.example/?x=http://localhost", False),
    ("javascript:alert(1)", False),
    ("/relative", False),
    ("", False),
])
def test_redirect_allowlist(url, ok, monkeypatch):
    monkeypatch.delenv("BANK_REDIRECT_ALLOWLIST", raising=False)
    assert is_allowed_redirect(url) is ok


def test_redirect_allowlist_from_env(monkeypatch):
    monkeypatch.setenv("BANK_REDIRECT_ALLOWLIST", "financeapp, https://app.example.com")
    assert is_allowed_redirect("https://app.example.com/bank-callback")
    assert not is_allowed_redirect("http://localhost:8081/bank-callback")
    assert not is_allowed_redirect("https://app.example.com.evil.example/")


def test_with_query_keeps_existing_parameters():
    assert with_query("financeapp://cb?x=1", status="approved") == "financeapp://cb?x=1&status=approved"
