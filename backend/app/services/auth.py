"""Password hashing, access and refresh tokens, login throttling and the get_current_user dependency.

Two tokens are issued at login:
- access token: a JWT that lives for minutes. It is sent on every request and never stored server-side.
- refresh token: a random string that lives for days. Only its hash is stored. It is single use:
  POST /auth/refresh swaps it for a new pair, so a stolen one stops working once the owner refreshes.
"""

import hashlib
import os
import secrets
import time
from collections import defaultdict, deque
from datetime import timedelta
from typing import TypeVar

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlmodel import Session, SQLModel, select

from app.db import get_session
from app.models import RefreshToken, Token, User, as_utc, utcnow

ALGORITHM = "HS256"
MIN_SECRET_LENGTH = 32
_hasher = PasswordHasher()
_bearer = HTTPBearer(auto_error=False)
# Verified when the email is unknown, so both login failures take the same time.
_DUMMY_HASH = _hasher.hash("not-a-real-password")

T = TypeVar("T", bound=SQLModel)


def _secret() -> str:
    secret = os.getenv("JWT_SECRET", "")
    if len(secret) < MIN_SECRET_LENGTH:
        raise RuntimeError(f"JWT_SECRET must be set and at least {MIN_SECRET_LENGTH} characters (see .env.example)")
    return secret


def check_auth_config() -> None:
    """Called at startup so a missing or weak secret fails fast, not on the first login."""
    _secret()


# ---------- Passwords ----------


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except (VerificationError, InvalidHashError):
        return False


def authenticate(session: Session, email: str, password: str) -> User | None:
    """The user if the credentials are right, else None. Takes the same time either way."""
    user = session.exec(select(User).where(User.email == email.strip().lower())).first()
    if user is None:
        verify_password(password, _DUMMY_HASH)
        return None
    if not verify_password(password, user.password_hash):
        return None
    if _hasher.check_needs_rehash(user.password_hash):
        user.password_hash = hash_password(password)
        session.add(user)
        session.commit()
    return user


# ---------- Login throttling ----------
# In-memory, so it resets on restart and is per process. Good enough for one server;
# move it to Redis (or the database) before running several workers.

MAX_FAILED_LOGINS = 5
LOCKOUT_SECONDS = 15 * 60
_failed_logins: dict[str, deque[float]] = defaultdict(deque)


def _recent_failures(key: str) -> deque[float]:
    attempts = _failed_logins[key]
    cutoff = time.monotonic() - LOCKOUT_SECONDS
    while attempts and attempts[0] < cutoff:
        attempts.popleft()
    return attempts


def check_login_allowed(key: str) -> None:
    attempts = _recent_failures(key)
    if len(attempts) >= MAX_FAILED_LOGINS:
        retry_after = int(attempts[0] + LOCKOUT_SECONDS - time.monotonic()) + 1
        raise HTTPException(429, "Too many failed logins. Try again later.", headers={"Retry-After": str(retry_after)})


def record_login_failure(key: str) -> None:
    _recent_failures(key).append(time.monotonic())


def clear_login_failures(key: str | None = None) -> None:
    if key is None:
        _failed_logins.clear()
    else:
        _failed_logins.pop(key, None)


# ---------- Tokens ----------


def create_access_token(user: User) -> str:
    minutes = int(os.getenv("JWT_EXPIRE_MINUTES", "15"))
    now = utcnow()
    payload = {"sub": str(user.id), "type": "access", "iat": now, "exp": now + timedelta(minutes=minutes)}
    return jwt.encode(payload, _secret(), algorithm=ALGORITHM)


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def issue_tokens(session: Session, user: User) -> Token:
    """New access + refresh pair. The refresh token is returned once and only its hash is kept."""
    days = int(os.getenv("REFRESH_EXPIRE_DAYS", "30"))
    raw = secrets.token_urlsafe(48)
    session.add(RefreshToken(user_id=user.id, token_hash=_hash_token(raw), expires_at=utcnow() + timedelta(days=days)))
    session.commit()
    return Token(access_token=create_access_token(user), refresh_token=raw)


def _revoke_all(session: Session, user_id: int) -> None:
    rows = session.exec(
        select(RefreshToken).where(RefreshToken.user_id == user_id, RefreshToken.revoked_at == None)  # noqa: E711
    ).all()
    for row in rows:
        row.revoked_at = utcnow()
        session.add(row)


def rotate_refresh_token(session: Session, raw: str) -> Token:
    """Swap a valid refresh token for a new pair. The old one is revoked."""
    invalid = HTTPException(401, "Invalid or expired refresh token")
    row = session.exec(select(RefreshToken).where(RefreshToken.token_hash == _hash_token(raw))).first()
    if row is None:
        raise invalid
    if row.revoked_at is not None:
        # A token that was already used is being replayed: assume it leaked and sign the user out everywhere.
        _revoke_all(session, row.user_id)
        session.commit()
        raise invalid
    user = session.get(User, row.user_id)
    if as_utc(row.expires_at) <= utcnow() or user is None:
        raise invalid
    row.revoked_at = utcnow()
    session.add(row)
    return issue_tokens(session, user)


def revoke_refresh_token(session: Session, raw: str) -> None:
    """Logout. Unknown tokens are ignored so the endpoint never reveals whether one existed."""
    row = session.exec(select(RefreshToken).where(RefreshToken.token_hash == _hash_token(raw))).first()
    if row is not None and row.revoked_at is None:
        row.revoked_at = utcnow()
        session.add(row)
        session.commit()


# ---------- Dependencies ----------


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    session: Session = Depends(get_session),
) -> User:
    """Authentication: `user: User = Depends(get_current_user)` gives the logged-in user or raises 401."""
    unauthorized = HTTPException(401, "Invalid or missing token", headers={"WWW-Authenticate": "Bearer"})
    if creds is None:
        raise unauthorized
    try:
        payload = jwt.decode(
            creds.credentials, _secret(), algorithms=[ALGORITHM], options={"require": ["exp", "sub"]}
        )
        if payload.get("type", "access") != "access":
            raise unauthorized
        user = session.get(User, int(payload["sub"]))
    except (jwt.PyJWTError, KeyError, ValueError):
        raise unauthorized
    if user is None:
        raise unauthorized
    return user


def get_owned(session: Session, model: type[T], obj_id: int | None, user: User) -> T | None:
    """Authorisation: the row only if it belongs to `user`.

    Rows of other users come back as None, the same as rows that don't exist, so routers
    answer 404 for both and ids can't be probed.
    """
    if obj_id is None:
        return None
    obj = session.get(model, obj_id)
    if obj is None or obj.user_id != user.id:
        return None
    return obj
