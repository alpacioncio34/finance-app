from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from app.db import get_session
from app.models import Budget, BudgetCreate, BudgetRead, BudgetUpdate, Category, TxKind
from app.services.dates import current_month
from app.services.money import spending_by_category

router = APIRouter(prefix="/budgets", tags=["budgets"])

MONTH = r"^\d{4}-(0[1-9]|1[0-2])$"


def _to_read(b: Budget, cat: Category, spent: dict[int | None, int]) -> BudgetRead:
    return BudgetRead(
        **b.model_dump(),
        category_name=cat.name,
        category_color=cat.color,
        spent_cents=spent.get(b.category_id, 0),
    )


@router.get("", response_model=list[BudgetRead])
def list_budgets(month: str = Query(default_factory=current_month, pattern=MONTH), session: Session = Depends(get_session)):
    spent = spending_by_category(session, month)
    rows = session.exec(
        select(Budget, Category)
        .join(Category, Category.id == Budget.category_id)
        .where(Budget.month == month)
        .order_by(Category.name)
    ).all()
    return [_to_read(b, c, spent) for b, c in rows]


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
    return _to_read(b, cat, spending_by_category(session, b.month))


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
    return _to_read(b, session.get(Category, b.category_id), spending_by_category(session, b.month))


@router.delete("/{budget_id}", status_code=204)
def delete_budget(budget_id: int, session: Session = Depends(get_session)):
    b = session.get(Budget, budget_id)
    if not b:
        raise HTTPException(404, "Budget not found")
    session.delete(b)
    session.commit()
