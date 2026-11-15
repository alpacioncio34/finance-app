from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.db import get_session
from app.models import (
    Account,
    AccountCreate,
    AccountRead,
    AccountSource,
    AccountUpdate,
    BankConnection,
    Transaction,
    User,
    as_utc,
)
from app.services.auth import get_current_user, get_owned
from app.services.money import account_balance, account_balances

router = APIRouter(prefix="/accounts", tags=["accounts"])


def _to_read(acc: Account, balance_cents: int, conn: BankConnection | None = None) -> AccountRead:
    """Table row -> response schema. The balance is computed, never stored, so it's passed in."""
    return AccountRead(
        **acc.model_dump(),
        balance_cents=balance_cents,
        institution_name=conn.institution_name if conn else None,
        last_synced_at=as_utc(conn.last_synced_at) if conn else None,
    )


def _connection(session: Session, acc: Account) -> BankConnection | None:
    return session.get(BankConnection, acc.connection_id) if acc.connection_id else None


@router.get("", response_model=list[AccountRead])
def list_accounts(session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    balances = account_balances(session, user.id)
    accounts = session.exec(select(Account).where(Account.user_id == user.id).order_by(Account.created_at)).all()
    conns = {c.id: c for c in session.exec(select(BankConnection).where(BankConnection.user_id == user.id)).all()}
    return [_to_read(a, balances.get(a.id, a.initial_balance_cents), conns.get(a.connection_id)) for a in accounts]


@router.post("", response_model=AccountRead, status_code=201)
def create_account(data: AccountCreate, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    """Creates a manual account. Bank accounts are only created by bank sync (see routers/bank.py)."""
    acc = Account(**data.model_dump(), user_id=user.id)
    session.add(acc)
    session.commit()
    session.refresh(acc)
    return _to_read(acc, account_balance(session, acc))


@router.get("/{account_id}", response_model=AccountRead)
def get_account(account_id: int, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    acc = get_owned(session, Account, account_id, user)
    if not acc:
        raise HTTPException(404, "Account not found")
    return _to_read(acc, account_balance(session, acc), _connection(session, acc))


@router.patch("/{account_id}", response_model=AccountRead)
def update_account(
    account_id: int,
    data: AccountUpdate,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    acc = get_owned(session, Account, account_id, user)
    if not acc:
        raise HTTPException(404, "Account not found")
    changes = data.model_dump(exclude_unset=True)
    if acc.source == AccountSource.bank and set(changes) - {"name"}:
        raise HTTPException(422, "Only the name of a bank-connected account can be changed")
    acc.sqlmodel_update(changes)
    session.add(acc)
    session.commit()
    session.refresh(acc)
    return _to_read(acc, account_balance(session, acc), _connection(session, acc))


@router.delete("/{account_id}", status_code=204)
def delete_account(account_id: int, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    acc = get_owned(session, Account, account_id, user)
    if not acc:
        raise HTTPException(404, "Account not found")
    for tx in session.exec(select(Transaction).where(Transaction.account_id == account_id)).all():
        session.delete(tx)
    session.delete(acc)
    session.commit()
