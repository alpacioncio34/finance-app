from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from app.db import get_session
from app.models import (
    Account,
    AccountSource,
    Category,
    Transaction,
    TransactionCreate,
    TransactionRead,
    TransactionUpdate,
    TxKind,
    User,
)
from app.services.auth import get_current_user, get_owned
from app.services.dates import month_range

router = APIRouter(prefix="/transactions", tags=["transactions"])

# The only fields of a bank-imported transaction the user may change
IMPORTED_EDITABLE = {"category_id", "description"}


def _validate_refs(session: Session, user: User, account_id: int | None, category_id: int | None, kind: TxKind | None):
    """Account and category must exist and belong to the user. Other users' ids look like missing ones."""
    if account_id is not None:
        acc = get_owned(session, Account, account_id, user)
        if not acc:
            raise HTTPException(422, "Account does not exist")
        if acc.source == AccountSource.bank:
            raise HTTPException(422, "Bank-connected accounts are read-only: their transactions come from the bank")
    if category_id is not None:
        cat = get_owned(session, Category, category_id, user)
        if not cat:
            raise HTTPException(422, "Category does not exist")
        if kind is not None and cat.kind != kind:
            raise HTTPException(422, f"Category '{cat.name}' is for {cat.kind.value}, not {kind.value}")


@router.get("", response_model=list[TransactionRead])
def list_transactions(
    month: str | None = Query(None, pattern=r"^\d{4}-(0[1-9]|1[0-2])$"),
    account_id: int | None = None,
    category_id: int | None = None,
    kind: TxKind | None = None,
    limit: int = Query(200, ge=1, le=1000),
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    q = select(Transaction).where(Transaction.user_id == user.id)
    if month:
        start, end = month_range(month)
        q = q.where(Transaction.date >= start, Transaction.date < end)
    if account_id is not None:
        q = q.where(Transaction.account_id == account_id)
    if category_id is not None:
        q = q.where(Transaction.category_id == category_id)
    if kind is not None:
        q = q.where(Transaction.kind == kind)
    q = q.order_by(Transaction.date.desc(), Transaction.id.desc()).limit(limit)
    return session.exec(q).all()


@router.post("", response_model=TransactionRead, status_code=201)
def create_transaction(
    data: TransactionCreate,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    _validate_refs(session, user, data.account_id, data.category_id, data.kind)
    tx = Transaction(**data.model_dump(), user_id=user.id)
    session.add(tx)
    session.commit()
    session.refresh(tx)
    return tx


@router.get("/{tx_id}", response_model=TransactionRead)
def get_transaction(tx_id: int, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    tx = get_owned(session, Transaction, tx_id, user)
    if not tx:
        raise HTTPException(404, "Transaction not found")
    return tx


@router.patch("/{tx_id}", response_model=TransactionRead)
def update_transaction(
    tx_id: int,
    data: TransactionUpdate,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    tx = get_owned(session, Transaction, tx_id, user)
    if not tx:
        raise HTTPException(404, "Transaction not found")
    # Only keep fields whose value really changes, so a form that resends everything still works
    changes = {k: v for k, v in data.model_dump(exclude_unset=True).items() if getattr(tx, k) != v}
    if tx.external_id is not None and set(changes) - IMPORTED_EDITABLE:
        raise HTTPException(422, "Only the category and description of a bank transaction can be changed")
    _validate_refs(
        session,
        user,
        changes.get("account_id"),
        changes.get("category_id", tx.category_id),
        changes.get("kind", tx.kind),
    )
    tx.sqlmodel_update(changes)
    session.add(tx)
    session.commit()
    session.refresh(tx)
    return tx


@router.delete("/{tx_id}", status_code=204)
def delete_transaction(tx_id: int, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    tx = get_owned(session, Transaction, tx_id, user)
    if not tx:
        raise HTTPException(404, "Transaction not found")
    if tx.external_id is not None:
        raise HTTPException(422, "Bank transactions can't be deleted: the next sync would import them again")
    session.delete(tx)
    session.commit()
