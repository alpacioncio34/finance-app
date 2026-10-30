"""Default categories, plus optional demo data.

Run demo seeding with:  python -m app.seed --demo
"""

import random
import sys
from datetime import date, timedelta

from sqlmodel import Session, select

from app.models import Account, AccountType, Budget, Category, Transaction, TxKind
from app.services import month_range, shift_month

DEFAULT_CATEGORIES = [
    # (name, kind, color, ionicon)
    ("Groceries", TxKind.expense, "#22c55e", "cart"),
    ("Rent", TxKind.expense, "#6366f1", "home"),
    ("Transport", TxKind.expense, "#0ea5e9", "bus"),
    ("Eating out", TxKind.expense, "#f97316", "restaurant"),
    ("Leisure", TxKind.expense, "#ec4899", "game-controller"),
    ("Travel", TxKind.expense, "#14b8a6", "airplane"),
    ("Subscriptions", TxKind.expense, "#a855f7", "repeat"),
    ("Health", TxKind.expense, "#ef4444", "medkit"),
    ("Education", TxKind.expense, "#eab308", "school"),
    ("Other", TxKind.expense, "#64748b", "ellipsis-horizontal"),
    ("Salary", TxKind.income, "#16a34a", "briefcase"),
    ("Scholarship", TxKind.income, "#0891b2", "ribbon"),
    ("Gifts", TxKind.income, "#db2777", "gift"),
    ("Other income", TxKind.income, "#475569", "cash"),
]


def seed_categories(session: Session) -> None:
    if session.exec(select(Category)).first():
        return
    for name, kind, color, icon in DEFAULT_CATEGORIES:
        session.add(Category(name=name, kind=kind, color=color, icon=icon))
    session.commit()


def seed_demo(session: Session) -> None:
    """Three months of fake data so the dashboard has something to show."""
    seed_categories(session)
    if session.exec(select(Account)).first():
        print("Accounts already exist, skipping demo data.")
        return

    cats = {c.name: c for c in session.exec(select(Category)).all()}
    checking = Account(name="Main account", type=AccountType.checking, initial_balance_cents=120000)
    savings = Account(name="Savings", type=AccountType.savings, initial_balance_cents=300000)
    cash = Account(name="Wallet", type=AccountType.cash, initial_balance_cents=5000)
    session.add_all([checking, savings, cash])
    session.commit()

    rng = random.Random(42)
    today = date.today()
    for back in range(3):
        m_start, _ = month_range(shift_month(today.strftime("%Y-%m"), -back))
        session.add(Transaction(account_id=checking.id, category_id=cats["Scholarship"].id, kind=TxKind.income,
                                amount_cents=95000, date=m_start, description="Monthly scholarship"))
        session.add(Transaction(account_id=checking.id, category_id=cats["Rent"].id, kind=TxKind.expense,
                                amount_cents=45000, date=m_start + timedelta(days=1), description="Rent"))
        for _ in range(18):
            day = m_start + timedelta(days=rng.randint(0, 27))
            if day > today:
                continue
            name, lo, hi, acc = rng.choice([
                ("Groceries", 800, 6500, checking),
                ("Eating out", 600, 3500, cash),
                ("Transport", 250, 4900, checking),
                ("Leisure", 1000, 4000, checking),
                ("Subscriptions", 499, 1299, checking),
            ])
            session.add(Transaction(account_id=acc.id, category_id=cats[name].id, kind=TxKind.expense,
                                    amount_cents=rng.randint(lo, hi), date=day, description=name))

    month = today.strftime("%Y-%m")
    for name, limit in [("Groceries", 25000), ("Eating out", 8000), ("Transport", 6000), ("Leisure", 7000)]:
        session.add(Budget(category_id=cats[name].id, month=month, limit_cents=limit))
    session.commit()
    print("Demo data created.")


if __name__ == "__main__":
    from app.db import engine, init_db

    init_db()
    with Session(engine) as s:
        if "--demo" in sys.argv:
            seed_demo(s)
        else:
            seed_categories(s)
            print("Default categories ready.")
