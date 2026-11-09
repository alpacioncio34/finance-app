"""Password hashing, JWT creation and the get_current_user dependency."""

import os
from datetime import timedelta

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlmodel import Session

from app.db import get_session
from app.models import User, utcnow

ALGORITHM = "HS256"
_hasher = PasswordHasher()
_bearer = HTTPBearer(auto_error=False)


def _secret() -> str:
    secret = os.getenv("JWT_SECRET")
    if not secret:
        raise RuntimeError("JWT_SECRET is not set (see .env.example)")
    return secret


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except VerifyMismatchError:
        return False


def create_access_token(user: User) -> str:
    minutes = int(os.getenv("JWT_EXPIRE_MINUTES", "60"))
    payload = {"sub": str(user.id), "exp": utcnow() + timedelta(minutes=minutes)}
    return jwt.encode(payload, _secret(), algorithm=ALGORITHM)


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    session: Session = Depends(get_session),
) -> User:
    """Dependency for protected routes: `user: User = Depends(get_current_user)`."""
    unauthorized = HTTPException(401, "Invalid or missing token", headers={"WWW-Authenticate": "Bearer"})
    if creds is None:
        raise unauthorized
    try:
        payload = jwt.decode(creds.credentials, _secret(), algorithms=[ALGORITHM])
        user = session.get(User, int(payload["sub"]))
    except (jwt.PyJWTError, KeyError, ValueError):
        raise unauthorized
    if user is None:
        raise unauthorized
    return user
