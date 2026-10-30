from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.db import get_session
from app.models import Account, AccountCreate, AccountRead, AccountUpdate, Transaction
from app.services import account_balances

router = APIRouter(prefix="/accounts", tags=["accounts"])


def _read(acc: Account, balances: dict[int, int]) -> AccountRead:
    return AccountRead(**acc.model_dump(), balance_cents=balances.get(acc.id, acc.initial_balance_cents))


@router.get("", response_model=list[AccountRead])
def list_accounts(session: Session = Depends(get_session)):
    balances = account_balances(session)
    accounts = session.exec(select(Account).order_by(Account.created_at)).all()
    return [_read(a, balances) for a in accounts]


@router.post("", response_model=AccountRead, status_code=201)
def create_account(data: AccountCreate, session: Session = Depends(get_session)):
    acc = Account.model_validate(data)
    session.add(acc)
    session.commit()
    session.refresh(acc)
    return _read(acc, account_balances(session))


@router.get("/{account_id}", response_model=AccountRead)
def get_account(account_id: int, session: Session = Depends(get_session)):
    acc = session.get(Account, account_id)
    if not acc:
        raise HTTPException(404, "Account not found")
    return _read(acc, account_balances(session))


@router.patch("/{account_id}", response_model=AccountRead)
def update_account(account_id: int, data: AccountUpdate, session: Session = Depends(get_session)):
    acc = session.get(Account, account_id)
    if not acc:
        raise HTTPException(404, "Account not found")
    acc.sqlmodel_update(data.model_dump(exclude_unset=True))
    session.add(acc)
    session.commit()
    session.refresh(acc)
    return _read(acc, account_balances(session))


@router.delete("/{account_id}", status_code=204)
def delete_account(account_id: int, session: Session = Depends(get_session)):
    acc = session.get(Account, account_id)
    if not acc:
        raise HTTPException(404, "Account not found")
    for tx in session.exec(select(Transaction).where(Transaction.account_id == account_id)).all():
        session.delete(tx)
    session.delete(acc)
    session.commit()
