import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from app.db import get_session
from app.main import app
from app.seed import seed_categories

JWT_SECRET = "test-secret-that-is-long-enough-for-hs256"
CREDS = {"email": "ana@example.com", "password": "correct-horse"}
FIXTURE_USER = {"email": "fixture@example.com", "password": "fixture-password"}


@pytest.fixture
def engine(monkeypatch):
    """Fresh in-memory DB (categories seeded) wired into the app for one test."""
    monkeypatch.setenv("JWT_SECRET", JWT_SECRET)
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    SQLModel.metadata.create_all(engine)
    with Session(engine) as s:
        seed_categories(s)

    def override():
        with Session(engine) as s:
            yield s

    app.dependency_overrides[get_session] = override
    yield engine
    app.dependency_overrides.clear()


@pytest.fixture
def anon_client(engine):
    """Client with no Authorization header."""
    return TestClient(app)


@pytest.fixture
def client(engine):
    """Client logged in through the real /auth endpoints; sends its Bearer token on every request."""
    c = TestClient(app)
    assert c.post("/auth/register", json=FIXTURE_USER).status_code == 201
    token = c.post("/auth/login", json=FIXTURE_USER).json()["access_token"]
    c.headers.update({"Authorization": f"Bearer {token}"})
    return c
