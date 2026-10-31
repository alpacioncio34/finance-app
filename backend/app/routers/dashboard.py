from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlmodel import Session, select

from app.db import get_session
from app.models import Category, Transaction, TransactionRead
from app.services.dates import current_month, shift_month
from app.services.money import account_balances, month_totals, spending_by_category

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


class CategorySpend(BaseModel):
    category_id: int | None
    name: str
    color: str
    amount_cents: int


class MonthTotals(BaseModel):
    month: str
    income_cents: int
    expense_cents: int


class Dashboard(BaseModel):
    month: str
    total_balance_cents: int
    income_cents: int
    expense_cents: int
    net_cents: int
    spending_by_category: list[CategorySpend]
    trend: list[MonthTotals]
    recent: list[TransactionRead]


@router.get("", response_model=Dashboard)
def get_dashboard(
    month: str = Query(default_factory=current_month, pattern=r"^\d{4}-(0[1-9]|1[0-2])$"),
    months_back: int = Query(6, ge=1, le=24),
    session: Session = Depends(get_session),
):
    income, expense = month_totals(session, month)

    by_cat = spending_by_category(session, month)
    cats = {c.id: c for c in session.exec(select(Category)).all()}
    spending = sorted(
        (
            CategorySpend(
                category_id=cid,
                name=cats[cid].name if cid in cats else "Uncategorised",
                color=cats[cid].color if cid in cats else "#94a3b8",
                amount_cents=int(total),
            )
            for cid, total in by_cat.items()
        ),
        key=lambda s: s.amount_cents,
        reverse=True,
    )

    trend = []
    for i in range(months_back - 1, -1, -1):
        m = shift_month(month, -i)
        inc, exp = month_totals(session, m)
        trend.append(MonthTotals(month=m, income_cents=inc, expense_cents=exp))

    recent = session.exec(
        select(Transaction).order_by(Transaction.date.desc(), Transaction.id.desc()).limit(5)
    ).all()

    return Dashboard(
        month=month,
        total_balance_cents=sum(account_balances(session).values()),
        income_cents=income,
        expense_cents=expense,
        net_cents=income - expense,
        spending_by_category=spending,
        trend=trend,
        recent=[TransactionRead.model_validate(t) for t in recent],
    )
