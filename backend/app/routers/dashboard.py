from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlmodel import Session, func, select

from app.db import get_session
from app.models import Category, Transaction, TransactionRead, TxKind
from app.services import account_balances, current_month, month_range, shift_month

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


def _totals(session: Session, month: str) -> tuple[int, int]:
    start, end = month_range(month)
    rows = dict(
        session.exec(
            select(Transaction.kind, func.sum(Transaction.amount_cents))
            .where(Transaction.date >= start, Transaction.date < end)
            .group_by(Transaction.kind)
        ).all()
    )
    return int(rows.get(TxKind.income, 0) or 0), int(rows.get(TxKind.expense, 0) or 0)


@router.get("", response_model=Dashboard)
def get_dashboard(
    month: str = Query(default_factory=current_month, pattern=r"^\d{4}-(0[1-9]|1[0-2])$"),
    months_back: int = Query(6, ge=1, le=24),
    session: Session = Depends(get_session),
):
    income, expense = _totals(session, month)

    start, end = month_range(month)
    by_cat = session.exec(
        select(Transaction.category_id, func.sum(Transaction.amount_cents))
        .where(Transaction.kind == TxKind.expense, Transaction.date >= start, Transaction.date < end)
        .group_by(Transaction.category_id)
    ).all()
    cats = {c.id: c for c in session.exec(select(Category)).all()}
    spending = sorted(
        (
            CategorySpend(
                category_id=cid,
                name=cats[cid].name if cid in cats else "Uncategorised",
                color=cats[cid].color if cid in cats else "#94a3b8",
                amount_cents=int(total),
            )
            for cid, total in by_cat
        ),
        key=lambda s: s.amount_cents,
        reverse=True,
    )

    trend = []
    for i in range(months_back - 1, -1, -1):
        m = shift_month(month, -i)
        inc, exp = _totals(session, m)
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
