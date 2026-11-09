from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.db import get_session
from app.models import Login, Token, User, UserCreate, UserRead
from app.services.auth import create_access_token, get_current_user, hash_password, verify_password

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
    return user


@router.post("/login", response_model=Token)
def login(data: Login, session: Session = Depends(get_session)):
    user = session.exec(select(User).where(User.email == data.email.strip().lower())).first()
    # Same error for unknown email and wrong password, so emails can't be probed.
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(401, "Invalid email or password")
    return Token(access_token=create_access_token(user))

'''
    How is authentication managed?
    When using depends, if the function called does not raise an HTTPException, the value returned by the function will be returned to the route,
    and get_current_user already manages everything internally: token is present, signature is valid, the token hasnt expired and the user exists.

    IT DOES NOT DO AUTHORIZATION, another thing that it doesn't do is create tokens, managed by create_access_token

    For authentication working details see services/auth.py, there is where all the token's logic is made.
'''
@router.get("/me", response_model=UserRead)
def me(user: User = Depends(get_current_user)):
    return user
