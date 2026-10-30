from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.db import get_session
from app.models import Budget, Category, CategoryCreate, CategoryRead, Transaction, TxKind

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategoryRead])
def list_categories(kind: TxKind | None = None, session: Session = Depends(get_session)):
    q = select(Category).order_by(Category.name)
    if kind:
        q = q.where(Category.kind == kind)
    return session.exec(q).all()


@router.post("", response_model=CategoryRead, status_code=201)
def create_category(data: CategoryCreate, session: Session = Depends(get_session)):
    cat = Category.model_validate(data)
    session.add(cat)
    session.commit()
    session.refresh(cat)
    return cat


@router.delete("/{category_id}", status_code=204)
def delete_category(category_id: int, session: Session = Depends(get_session)):
    cat = session.get(Category, category_id)
    if not cat:
        raise HTTPException(404, "Category not found")
    # Keep transactions, just uncategorise them; drop budgets for this category
    for tx in session.exec(select(Transaction).where(Transaction.category_id == category_id)).all():
        tx.category_id = None
        session.add(tx)
    for b in session.exec(select(Budget).where(Budget.category_id == category_id)).all():
        session.delete(b)
    session.delete(cat)
    session.commit()
