"""Shared query helpers."""

from datetime import date

from sqlalchemy import case
from sqlmodel import Session, func, select

from app.models import Account, Transaction, TxKind


def month_range(month: str) -> tuple[date, date]:
    """'2026-10' -> (2026-10-01, 2026-11-01), end exclusive."""
    year, mon = (int(p) for p in month.split("-"))
    start = date(year, mon, 1)
    end = date(year + 1, 1, 1) if mon == 12 else date(year, mon + 1, 1)
    return start, end


def shift_month(month: str, delta: int) -> str:
    year, mon = (int(p) for p in month.split("-"))
    idx = year * 12 + (mon - 1) + delta
    return f"{idx // 12:04d}-{idx % 12 + 1:02d}"


def current_month() -> str:
    return date.today().strftime("%Y-%m")


def signed_amount():
    """SQL expression: +amount for income, -amount for expense."""
    return case(
        (Transaction.kind == TxKind.income, Transaction.amount_cents),
        else_=-Transaction.amount_cents,
    )


def account_balances(session: Session) -> dict[int, int]:
    """Current balance per account id, in cents."""
    movements = dict(
        session.exec(
            select(Transaction.account_id, func.coalesce(func.sum(signed_amount()), 0))
            .group_by(Transaction.account_id)
        ).all()
    )
    return {
        acc.id: acc.initial_balance_cents + int(movements.get(acc.id, 0))
        for acc in session.exec(select(Account)).all()
    }
