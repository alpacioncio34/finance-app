from fastapi import HTTPException,APIRouter, Depends

from app.db import get_session
from app.models import login, Account
from sqlmodel import Session, select

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/login")
async def login(userdata: login, session: Session = Depends(get_session)):

    # 1. User query with selet

    # 2. Check it exists

    # 3. Check for credentials

    # 4. If correct, return a JWT
    pass

@router.post("/regiter")
async def register(userdata: Account, session: Session = Depends(get_session)):

    # 1. Check for valid and available email

    # 2. Create user checking corresponding fields

    # 3. Give a session to the crated user
    pass