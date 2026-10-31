from datetime import date

import pytest
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from app.models import Account, Category, Transaction, TxKind
from app.services.dates import month_range, shift_month
from app.services.money import account_balance, account_balances, month_totals, spending_by_category


@pytest.fixture
def session():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    SQLModel.metadata.create_all(engine)
    with Session(engine) as s:
        yield s


def tx(session, account, kind, cents, day, category=None):
    session.add(Transaction(account_id=account.id, kind=kind, amount_cents=cents, date=day,
                            category_id=category.id if category else None))


@pytest.fixture
def data(session):
    a = Account(name="A", initial_balance_cents=1000)
    b = Account(name="B", initial_balance_cents=500)
    food = Category(name="Food", kind=TxKind.expense, color="#000000", icon="cart")
    session.add_all([a, b, food])
    session.commit()
    tx(session, a, TxKind.income, 3000, date(2026, 10, 1))
    tx(session, a, TxKind.expense, 400, date(2026, 10, 31), food)
    tx(session, a, TxKind.expense, 100, date(2026, 10, 15))           # uncategorised
    tx(session, b, TxKind.expense, 200, date(2026, 11, 1), food)      # next month
    session.commit()
    return a, b, food


def test_month_helpers():
    assert month_range("2026-12") == (date(2026, 12, 1), date(2027, 1, 1))
    assert shift_month("2026-01", -1) == "2025-12"
    assert shift_month("2026-11", 2) == "2027-01"


def test_month_totals_respect_month_boundaries(session, data):
    assert month_totals(session, "2026-10") == (3000, 500)
    assert month_totals(session, "2026-11") == (0, 200)
    assert month_totals(session, "2026-09") == (0, 0)


def test_spending_by_category_includes_uncategorised(session, data):
    _, _, food = data
    assert spending_by_category(session, "2026-10") == {food.id: 400, None: 100}


def test_single_balance_matches_all_balances(session, data):
    a, b, _ = data
    assert account_balances(session) == {a.id: 3500, b.id: 300}
    assert account_balance(session, a) == 3500
    assert account_balance(session, b) == 300


def test_balance_of_account_without_transactions(session):
    acc = Account(name="Empty", initial_balance_cents=777)
    session.add(acc)
    session.commit()
    assert account_balance(session, acc) == 777
