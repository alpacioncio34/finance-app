import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from app.db import get_session
from app.main import app

CREDS = {"email": "ana@example.com", "password": "correct-horse"}


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", "test-secret-that-is-long-enough-for-hs256")
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    SQLModel.metadata.create_all(engine)

    def override():
        with Session(engine) as s:
            yield s

    app.dependency_overrides[get_session] = override
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_register_login_me(client):
    r = client.post("/auth/register", json=CREDS)
    assert r.status_code == 201
    assert r.json()["email"] == CREDS["email"]
    assert "password" not in r.text and "hash" not in r.text

    token = client.post("/auth/login", json=CREDS).json()["access_token"]
    me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200 and me.json()["email"] == CREDS["email"]


def test_duplicate_email_is_case_insensitive(client):
    client.post("/auth/register", json=CREDS)
    r = client.post("/auth/register", json={**CREDS, "email": "ANA@example.com"})
    assert r.status_code == 409


def test_invalid_email_and_short_password(client):
    assert client.post("/auth/register", json={**CREDS, "email": "nope"}).status_code == 422
    assert client.post("/auth/register", json={**CREDS, "password": "short"}).status_code == 422


def test_wrong_password_and_unknown_email_look_the_same(client):
    client.post("/auth/register", json=CREDS)
    bad_pw = client.post("/auth/login", json={**CREDS, "password": "wrong-password"})
    unknown = client.post("/auth/login", json={"email": "who@example.com", "password": "whatever1"})
    assert bad_pw.status_code == unknown.status_code == 401
    assert bad_pw.json() == unknown.json()


def test_me_requires_valid_token(client):
    assert client.get("/auth/me").status_code == 401
    assert client.get("/auth/me", headers={"Authorization": "Bearer garbage"}).status_code == 401
