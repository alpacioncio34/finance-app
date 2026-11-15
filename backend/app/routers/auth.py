from fastapi import APIRouter, Depends, HTTPException, Request
from sqlmodel import Session, select

from app.db import get_session
from app.models import Login, RefreshRequest, Token, User, UserCreate, UserRead
from app.seed import seed_categories
from app.services.auth import (
    authenticate,
    check_login_allowed,
    clear_login_failures,
    get_current_user,
    hash_password,
    issue_tokens,
    record_login_failure,
    revoke_refresh_token,
    rotate_refresh_token,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserRead, status_code=201)
def register(data: UserCreate, session: Session = Depends(get_session)):
    email = data.email.strip().lower()
    if session.exec(select(User).where(User.email == email)).first():
        raise HTTPException(409, "Email already registered")
    user = User(email=email, password_hash=hash_password(data.password))
    session.add(user)
    session.commit()
    session.refresh(user)
    seed_categories(session, user.id)  # every user starts with their own copy of the default categories
    return user


@router.post("/login", response_model=Token)
def login(data: Login, request: Request, session: Session = Depends(get_session)):
    # Throttle per (client address, email), so guessing one account's password gets locked out
    # without letting a stranger lock the real owner out from another address.
    key = f"{request.client.host if request.client else 'unknown'}|{data.email.strip().lower()}"
    check_login_allowed(key)
    user = authenticate(session, data.email, data.password)
    # Same error for unknown email and wrong password, so emails can't be probed.
    if user is None:
        record_login_failure(key)
        raise HTTPException(401, "Invalid email or password")
    clear_login_failures(key)
    return issue_tokens(session, user)


@router.post("/refresh", response_model=Token)
def refresh(data: RefreshRequest, session: Session = Depends(get_session)):
    """Swap a refresh token for a new access + refresh pair. Each refresh token works once."""
    return rotate_refresh_token(session, data.refresh_token)


@router.post("/logout", status_code=204)
def logout(data: RefreshRequest, session: Session = Depends(get_session)):
    """Revoke the refresh token. The access token simply expires a few minutes later."""
    revoke_refresh_token(session, data.refresh_token)


'''
    How is authentication managed?
    When using depends, if the function called does not raise an HTTPException, the value returned by the function will be returned to the route,
    and get_current_user already manages everything internally: token is present, signature is valid, the token hasnt expired and the user exists.

    Authentication (who are you?) is get_current_user.
    Authorisation (is this row yours?) is done in each router: every query filters by user.id, and single rows
    are loaded with get_owned(), which returns None for rows of other users so the router answers 404.

    For authentication working details see services/auth.py, there is where all the token's logic is made.
'''
@router.get("/me", response_model=UserRead)
def me(user: User = Depends(get_current_user)):
    return user
