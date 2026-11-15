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
    ("GET", "/bank/institutions", None),
    ("GET", "/bank/connections", None),
    ("POST", "/bank/connections", {"institution_id": "sandbox-norte", "redirect_url": "financeapp://bank-callback"}),
    ("POST", "/bank/connections/1/complete", None),
    ("POST", "/bank/connections/1/sync", None),
    ("DELETE", "/bank/connections/1", None),
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


def test_login_is_throttled_after_repeated_failures(anon_client):
    anon_client.post("/auth/register", json=CREDS)
    wrong = {**CREDS, "password": "wrong-password"}
    for _ in range(5):
        assert anon_client.post("/auth/login", json=wrong).status_code == 401
    locked = anon_client.post("/auth/login", json=wrong)
    assert locked.status_code == 429 and int(locked.headers["retry-after"]) > 0
    # Even the right password has to wait, otherwise guessing could just continue
    assert anon_client.post("/auth/login", json=CREDS).status_code == 429
    # Other accounts are not affected
    other = {"email": "bea@example.com", "password": "another-password"}
    anon_client.post("/auth/register", json=other)
    assert anon_client.post("/auth/login", json=other).status_code == 200


def test_successful_login_resets_the_failure_count(anon_client):
    anon_client.post("/auth/register", json=CREDS)
    wrong = {**CREDS, "password": "wrong-password"}
    for _ in range(3):
        for _ in range(4):
            assert anon_client.post("/auth/login", json=wrong).status_code == 401
        assert anon_client.post("/auth/login", json=CREDS).status_code == 200


def test_startup_refuses_a_weak_secret(monkeypatch):
    from app.services.auth import check_auth_config

    monkeypatch.setenv("JWT_SECRET", "change-me")
    with pytest.raises(RuntimeError):
        check_auth_config()
    monkeypatch.delenv("JWT_SECRET")
    with pytest.raises(RuntimeError):
        check_auth_config()


# ---- refresh tokens ----------------------------------------------------------------------------


def tokens(client):
    client.post("/auth/register", json=CREDS)
    return client.post("/auth/login", json=CREDS).json()


def test_refresh_gives_a_working_new_pair(anon_client):
    first = tokens(anon_client)
    r = anon_client.post("/auth/refresh", json={"refresh_token": first["refresh_token"]})
    assert r.status_code == 200
    second = r.json()
    assert second["refresh_token"] != first["refresh_token"]
    assert anon_client.get("/auth/me", headers=bearer(second["access_token"])).status_code == 200


def test_refresh_token_is_single_use_and_reuse_signs_out_everywhere(anon_client):
    first = tokens(anon_client)
    second = anon_client.post("/auth/refresh", json={"refresh_token": first["refresh_token"]}).json()
    # Replaying the old one fails...
    assert anon_client.post("/auth/refresh", json={"refresh_token": first["refresh_token"]}).status_code == 401
    # ...and because that looks like theft, the newer token is revoked too
    assert anon_client.post("/auth/refresh", json={"refresh_token": second["refresh_token"]}).status_code == 401


def test_refresh_rejects_garbage_and_expired_tokens(anon_client, monkeypatch):
    assert anon_client.post("/auth/refresh", json={"refresh_token": "nope"}).status_code == 401
    monkeypatch.setenv("REFRESH_EXPIRE_DAYS", "-1")
    expired = tokens(anon_client)["refresh_token"]
    assert anon_client.post("/auth/refresh", json={"refresh_token": expired}).status_code == 401


def test_refresh_token_is_not_an_access_token(anon_client):
    t = tokens(anon_client)
    assert anon_client.get("/accounts", headers=bearer(t["refresh_token"])).status_code == 401


def test_logout_revokes_the_refresh_token(anon_client):
    t = tokens(anon_client)
    assert anon_client.post("/auth/logout", json={"refresh_token": t["refresh_token"]}).status_code == 204
    assert anon_client.post("/auth/refresh", json={"refresh_token": t["refresh_token"]}).status_code == 401
    # Logging out twice, or with an unknown token, is not an error
    assert anon_client.post("/auth/logout", json={"refresh_token": t["refresh_token"]}).status_code == 204
    assert anon_client.post("/auth/logout", json={"refresh_token": "unknown"}).status_code == 204


def test_refresh_tokens_are_stored_hashed(anon_client, engine):
    from app.models import RefreshToken

    t = tokens(anon_client)
    with Session(engine) as s:
        row = s.exec(select(RefreshToken)).one()
        assert row.token_hash != t["refresh_token"] and len(row.token_hash) == 64


def test_token_with_wrong_type_is_rejected(anon_client):
    login(anon_client)
    claims = {"sub": "1", "type": "refresh", "exp": utcnow().timestamp() + 3600}
    token = jwt.encode(claims, JWT_SECRET, algorithm=ALGORITHM)
    assert anon_client.get("/accounts", headers=bearer(token)).status_code == 401


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
