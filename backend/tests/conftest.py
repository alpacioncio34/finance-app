import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from app.db import get_session
from app.main import app
from app.services.auth import clear_login_failures

JWT_SECRET = "test-secret-that-is-long-enough-for-hs256"
CREDS = {"email": "ana@example.com", "password": "correct-horse"}
FIXTURE_USER = {"email": "fixture@example.com", "password": "fixture-password"}
OTHER_USER = {"email": "other@example.com", "password": "other-password"}


@pytest.fixture
def engine(monkeypatch):
    """Fresh in-memory DB wired into the app for one test. Categories are seeded when a user registers."""
    monkeypatch.setenv("JWT_SECRET", JWT_SECRET)
    monkeypatch.setenv("BANK_PROVIDER", "sandbox")
    monkeypatch.delenv("BANK_TOKEN_KEY", raising=False)
    monkeypatch.delenv("BANK_REDIRECT_ALLOWLIST", raising=False)
    clear_login_failures()
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    SQLModel.metadata.create_all(engine)

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


def _logged_in(creds) -> TestClient:
    c = TestClient(app)
    assert c.post("/auth/register", json=creds).status_code == 201
    token = c.post("/auth/login", json=creds).json()["access_token"]
    c.headers.update({"Authorization": f"Bearer {token}"})
    return c


@pytest.fixture
def client(engine):
    """Client logged in through the real /auth endpoints; sends its Bearer token on every request."""
    return _logged_in(FIXTURE_USER)


@pytest.fixture
def other_client(engine):
    """A second logged-in user, for checking that users can't reach each other's data."""
    return _logged_in(OTHER_USER)
