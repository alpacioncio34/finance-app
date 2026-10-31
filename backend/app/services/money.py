"""Every calculation that sums money lives here.

Routers must not write their own SUM queries: when transfers arrive they have to be
excluded from income/expense totals, and that rule should change in one place only.
"""

from sqlalchemy import case
from sqlmodel import Session, func, select

from app.models import Account, Transaction, TxKind
from app.services.dates import month_range


def signed_amount():
    """SQL expression: +amount for income, -amount for expense."""
    return case(
        (Transaction.kind == TxKind.income, Transaction.amount_cents),
        else_=-Transaction.amount_cents,
    )


def _in_month(month: str):
    start, end = month_range(month)
    return Transaction.date >= start, Transaction.date < end


def month_totals(session: Session, month: str) -> tuple[int, int]:
    """(income_cents, expense_cents) for the month."""
    rows = dict(
        session.exec(
            select(Transaction.kind, func.sum(Transaction.amount_cents))
            .where(*_in_month(month))
            .group_by(Transaction.kind)
        ).all()
    )
    return int(rows.get(TxKind.income) or 0), int(rows.get(TxKind.expense) or 0)


def spending_by_category(session: Session, month: str) -> dict[int | None, int]:
    """Expense total per category id for the month. Uncategorised spending is under `None`."""
    rows = session.exec(
        select(Transaction.category_id, func.sum(Transaction.amount_cents))
        .where(Transaction.kind == TxKind.expense, *_in_month(month))
        .group_by(Transaction.category_id)
    ).all()
    return {cid: int(total) for cid, total in rows}


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


def account_balance(session: Session, account: Account) -> int:
    """Current balance of one account, in cents."""
    movements = session.exec(
        select(func.coalesce(func.sum(signed_amount()), 0)).where(Transaction.account_id == account.id)
    ).one()
    return account.initial_balance_cents + int(movements)
