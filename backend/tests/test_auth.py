import jwt
import pytest
from sqlmodel import Session, select

from app.models import User, utcnow
from app.services.auth import ALGORITHM
from tests.conftest import CREDS, JWT_SECRET

# Every protected endpoint. Bodies are plausible so the 401 is proven to win over 422 validation.
PROTECTED = [
    ("GET", "/auth/me", None),
    ("GET", "/accounts", None),
    ("POST", "/accounts", {"name": "Main"}),
    ("GET", "/accounts/1", None),
    ("PATCH", "/accounts/1", {"name": "New"}),
    ("DELETE", "/accounts/1", None),
    ("GET", "/categories", None),
    ("POST", "/categories", {"name": "Gym", "kind": "expense"}),
    ("GET", "/transactions", None),
    ("POST", "/transactions", {"account_id": 1, "kind": "expense", "amount_cents": 100, "date": "2026-10-01"}),
    ("GET", "/transactions/1", None),
    ("PATCH", "/transactions/1", {"amount_cents": 200}),
    ("DELETE", "/transactions/1", None),
    ("GET", "/budgets", None),
    ("POST", "/budgets", {"category_id": 1, "month": "2026-10", "limit_cents": 1000}),
    ("GET", "/dashboard", None),
]
LIST_ENDPOINTS = ["/accounts", "/categories", "/transactions", "/budgets", "/dashboard", "/auth/me"]


def ids(params):
    return [f"{m} {p}" for m, p, _ in params]


def login(client):
    client.post("/auth/register", json=CREDS)
    return client.post("/auth/login", json=CREDS).json()["access_token"]


def bearer(token):
    return {"Authorization": f"Bearer {token}"}


# ---- register / login --------------------------------------------------------------------------


def test_register_login_me(anon_client):
    r = anon_client.post("/auth/register", json=CREDS)
    assert r.status_code == 201
    assert r.json()["email"] == CREDS["email"]
    assert "password" not in r.text and "hash" not in r.text

    token = anon_client.post("/auth/login", json=CREDS).json()["access_token"]
    me = anon_client.get("/auth/me", headers=bearer(token))
    assert me.status_code == 200 and me.json()["email"] == CREDS["email"]


def test_duplicate_email_is_case_insensitive(anon_client):
    anon_client.post("/auth/register", json=CREDS)
    r = anon_client.post("/auth/register", json={**CREDS, "email": "ANA@example.com"})
    assert r.status_code == 409


def test_invalid_email_and_short_password(anon_client):
    assert anon_client.post("/auth/register", json={**CREDS, "email": "nope"}).status_code == 422
    assert anon_client.post("/auth/register", json={**CREDS, "password": "short"}).status_code == 422


def test_wrong_password_and_unknown_email_look_the_same(anon_client):
    anon_client.post("/auth/register", json=CREDS)
    bad_pw = anon_client.post("/auth/login", json={**CREDS, "password": "wrong-password"})
    unknown = anon_client.post("/auth/login", json={"email": "who@example.com", "password": "whatever1"})
    assert bad_pw.status_code == unknown.status_code == 401
    assert bad_pw.json() == unknown.json()


def test_public_routes_need_no_token(anon_client):
    assert anon_client.get("/health").status_code == 200
    assert anon_client.post("/auth/register", json=CREDS).status_code == 201
    assert anon_client.post("/auth/login", json=CREDS).status_code == 200


# ---- no token -> 401 ---------------------------------------------------------------------------


@pytest.mark.parametrize("method,path,body", PROTECTED, ids=ids(PROTECTED))
def test_protected_routes_reject_missing_token(anon_client, method, path, body):
    r = anon_client.request(method, path, json=body)
    assert r.status_code == 401
    assert r.headers["www-authenticate"] == "Bearer"


# ---- bad tokens -> 401 -------------------------------------------------------------------------


def test_malformed_header_and_garbage_token(anon_client):
    assert anon_client.get("/accounts", headers={"Authorization": "Token abc"}).status_code == 401
    assert anon_client.get("/accounts", headers={"Authorization": "Bearer"}).status_code == 401
    assert anon_client.get("/accounts", headers=bearer("garbage")).status_code == 401


def test_token_signed_with_other_secret_is_rejected(anon_client):
    login(anon_client)
    claims = {"sub": "1", "exp": utcnow().timestamp() + 3600}
    forged = jwt.encode(claims, "another-secret-long-enough-for-hs256", algorithm=ALGORITHM)
    assert anon_client.get("/accounts", headers=bearer(forged)).status_code == 401


def test_token_without_sub_is_rejected(anon_client):
    login(anon_client)
    token = jwt.encode({"exp": utcnow().timestamp() + 3600}, JWT_SECRET, algorithm=ALGORITHM)
    assert anon_client.get("/accounts", headers=bearer(token)).status_code == 401


def test_expired_token_is_rejected(anon_client, monkeypatch):
    monkeypatch.setenv("JWT_EXPIRE_MINUTES", "-1")
    token = login(anon_client)
    assert anon_client.get("/accounts", headers=bearer(token)).status_code == 401


def test_token_of_deleted_user_is_rejected(anon_client, engine):
    token = login(anon_client)
    assert anon_client.get("/accounts", headers=bearer(token)).status_code == 200
    with Session(engine) as s:
        s.delete(s.exec(select(User)).one())
        s.commit()
    assert anon_client.get("/accounts", headers=bearer(token)).status_code == 401


# ---- valid token -> 200 ------------------------------------------------------------------------


@pytest.mark.parametrize("path", LIST_ENDPOINTS)
def test_valid_token_is_accepted(anon_client, path):
    token = login(anon_client)
    assert anon_client.get(path, headers=bearer(token)).status_code == 200


def test_authenticated_fixture_client_works(client):
    assert client.get("/auth/me").json()["email"] == "fixture@example.com"
