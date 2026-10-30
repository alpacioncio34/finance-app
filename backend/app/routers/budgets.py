from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, func, select

from app.db import get_session
from app.models import Budget, BudgetCreate, BudgetRead, BudgetUpdate, Category, Transaction, TxKind
from app.services import current_month, month_range

router = APIRouter(prefix="/budgets", tags=["budgets"])

MONTH = r"^\d{4}-(0[1-9]|1[0-2])$"


def spent_by_category(session: Session, month: str) -> dict[int, int]:
    start, end = month_range(month)
    rows = session.exec(
        select(Transaction.category_id, func.sum(Transaction.amount_cents))
        .where(
            Transaction.kind == TxKind.expense,
            Transaction.date >= start,
            Transaction.date < end,
            Transaction.category_id.is_not(None),
        )
        .group_by(Transaction.category_id)
    ).all()
    return {cid: int(total) for cid, total in rows}


def _read(b: Budget, cat: Category, spent: dict[int, int]) -> BudgetRead:
    return BudgetRead(
        **b.model_dump(),
        category_name=cat.name,
        category_color=cat.color,
        spent_cents=spent.get(b.category_id, 0),
    )


@router.get("", response_model=list[BudgetRead])
def list_budgets(month: str = Query(default_factory=current_month, pattern=MONTH), session: Session = Depends(get_session)):
    spent = spent_by_category(session, month)
    rows = session.exec(
        select(Budget, Category)
        .join(Category, Category.id == Budget.category_id)
        .where(Budget.month == month)
        .order_by(Category.name)
    ).all()
    return [_read(b, c, spent) for b, c in rows]


@router.post("", response_model=BudgetRead, status_code=201)
def create_or_replace_budget(data: BudgetCreate, session: Session = Depends(get_session)):
    """Creates the budget, or updates the limit if one already exists for that category+month."""
    cat = session.get(Category, data.category_id)
    if not cat:
        raise HTTPException(422, "Category does not exist")
    if cat.kind != TxKind.expense:
        raise HTTPException(422, "Budgets can only be set on expense categories")
    existing = session.exec(
        select(Budget).where(Budget.category_id == data.category_id, Budget.month == data.month)
    ).first()
    if existing:
        existing.limit_cents = data.limit_cents
        b = existing
    else:
        b = Budget.model_validate(data)
    session.add(b)
    session.commit()
    session.refresh(b)
    return _read(b, cat, spent_by_category(session, b.month))


@router.post("/copy", response_model=list[BudgetRead])
def copy_budgets(
    from_month: str = Query(pattern=MONTH),
    to_month: str = Query(pattern=MONTH),
    session: Session = Depends(get_session),
):
    """Copy every budget from one month to another (skips categories already budgeted)."""
    already = set(session.exec(select(Budget.category_id).where(Budget.month == to_month)).all())
    for b in session.exec(select(Budget).where(Budget.month == from_month)).all():
        if b.category_id not in already:
            session.add(Budget(category_id=b.category_id, month=to_month, limit_cents=b.limit_cents))
    session.commit()
    return list_budgets(to_month, session)


@router.patch("/{budget_id}", response_model=BudgetRead)
def update_budget(budget_id: int, data: BudgetUpdate, session: Session = Depends(get_session)):
    b = session.get(Budget, budget_id)
    if not b:
        raise HTTPException(404, "Budget not found")
    b.limit_cents = data.limit_cents
    session.add(b)
    session.commit()
    session.refresh(b)
    return _read(b, session.get(Category, b.category_id), spent_by_category(session, b.month))


@router.delete("/{budget_id}", status_code=204)
def delete_budget(budget_id: int, session: Session = Depends(get_session)):
    b = session.get(Budget, budget_id)
    if not b:
        raise HTTPException(404, "Budget not found")
    session.delete(b)
    session.commit()
