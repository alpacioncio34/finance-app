from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from app.db import get_session
from app.models import (
    Account,
    Category,
    Transaction,
    TransactionCreate,
    TransactionRead,
    TransactionUpdate,
    TxKind,
)
from app.services import month_range

router = APIRouter(prefix="/transactions", tags=["transactions"])


def _validate_refs(session: Session, account_id: int | None, category_id: int | None, kind: TxKind | None):
    if account_id is not None and not session.get(Account, account_id):
        raise HTTPException(422, "Account does not exist")
    if category_id is not None:
        cat = session.get(Category, category_id)
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
    limit: int = Query(200, le=1000),
    session: Session = Depends(get_session),
):
    q = select(Transaction)
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
def create_transaction(data: TransactionCreate, session: Session = Depends(get_session)):
    _validate_refs(session, data.account_id, data.category_id, data.kind)
    tx = Transaction.model_validate(data)
    session.add(tx)
    session.commit()
    session.refresh(tx)
    return tx


@router.get("/{tx_id}", response_model=TransactionRead)
def get_transaction(tx_id: int, session: Session = Depends(get_session)):
    tx = session.get(Transaction, tx_id)
    if not tx:
        raise HTTPException(404, "Transaction not found")
    return tx


@router.patch("/{tx_id}", response_model=TransactionRead)
def update_transaction(tx_id: int, data: TransactionUpdate, session: Session = Depends(get_session)):
    tx = session.get(Transaction, tx_id)
    if not tx:
        raise HTTPException(404, "Transaction not found")
    changes = data.model_dump(exclude_unset=True)
    _validate_refs(
        session,
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
def delete_transaction(tx_id: int, session: Session = Depends(get_session)):
    tx = session.get(Transaction, tx_id)
    if not tx:
        raise HTTPException(404, "Transaction not found")
    session.delete(tx)
    session.commit()
