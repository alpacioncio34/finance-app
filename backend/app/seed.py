"""Default categories, plus optional demo data.

Every new user gets their own copy of the default categories (called from POST /auth/register).

Run demo seeding with:  python -m app.seed --demo
It creates the user demo@example.com (password: demo-password) with 3 accounts and 3 months of data.
"""

import random
import sys
from datetime import date, timedelta

from sqlmodel import Session, select

from app.models import Account, AccountType, Budget, Category, Transaction, TxKind, User
from app.services.dates import month_range, shift_month

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


DEMO_EMAIL = "demo@example.com"
DEMO_PASSWORD = "demo-password"  # local demo data only


def seed_categories(session: Session, user_id: int) -> None:
    """Give the user the default categories, unless they already have some."""
    if session.exec(select(Category).where(Category.user_id == user_id)).first():
        return
    for name, kind, color, icon in DEFAULT_CATEGORIES:
        session.add(Category(user_id=user_id, name=name, kind=kind, color=color, icon=icon))
    session.commit()


def _demo_user(session: Session) -> User:
    from app.services.auth import hash_password

    user = session.exec(select(User).where(User.email == DEMO_EMAIL)).first()
    if user is None:
        user = User(email=DEMO_EMAIL, password_hash=hash_password(DEMO_PASSWORD))
        session.add(user)
        session.commit()
        session.refresh(user)
    return user


def seed_demo(session: Session) -> None:
    """A demo user with three months of fake data so the dashboard has something to show."""
    user = _demo_user(session)
    uid = user.id
    seed_categories(session, uid)
    if session.exec(select(Account).where(Account.user_id == uid)).first():
        print(f"{DEMO_EMAIL} already has accounts, skipping demo data.")
        return

    cats = {c.name: c for c in session.exec(select(Category).where(Category.user_id == uid)).all()}
    checking = Account(user_id=uid, name="Main account", type=AccountType.checking, initial_balance_cents=120000)
    savings = Account(user_id=uid, name="Savings", type=AccountType.savings, initial_balance_cents=300000)
    cash = Account(user_id=uid, name="Wallet", type=AccountType.cash, initial_balance_cents=5000)
    session.add_all([checking, savings, cash])
    session.commit()

    rng = random.Random(42)
    today = date.today()
    for back in range(3):
        m_start, _ = month_range(shift_month(today.strftime("%Y-%m"), -back))
        session.add(Transaction(user_id=uid, account_id=checking.id, category_id=cats["Scholarship"].id, kind=TxKind.income,
                                amount_cents=95000, date=m_start, description="Monthly scholarship"))
        session.add(Transaction(user_id=uid, account_id=checking.id, category_id=cats["Rent"].id, kind=TxKind.expense,
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
            session.add(Transaction(user_id=uid, account_id=acc.id, category_id=cats[name].id, kind=TxKind.expense,
                                    amount_cents=rng.randint(lo, hi), date=day, description=name))

    month = today.strftime("%Y-%m")
    for name, limit in [("Groceries", 25000), ("Eating out", 8000), ("Transport", 6000), ("Leisure", 7000)]:
        session.add(Budget(user_id=uid, category_id=cats[name].id, month=month, limit_cents=limit))
    session.commit()
    print(f"Demo data created. Log in as {DEMO_EMAIL} / {DEMO_PASSWORD}")


if __name__ == "__main__":
    from app.db import engine, init_db

    init_db()
    with Session(engine) as s:
        if "--demo" in sys.argv:
            seed_demo(s)
        else:
            print("Nothing to do: default categories are created when a user registers. Use --demo for demo data.")
