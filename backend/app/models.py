"""Database models and API schemas.

Money is always stored as integer cents to avoid floating-point rounding errors.
"""

import re
from datetime import date as Date
from datetime import datetime, timezone
from enum import Enum

from pydantic import field_validator
from sqlmodel import Field, SQLModel, UniqueConstraint


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class AccountType(str, Enum):
    checking = "checking"
    savings = "savings"
    cash = "cash"
    credit = "credit"
    investment = "investment"


class TxKind(str, Enum):
    income = "income"
    expense = "expense"

# ---------- Users (who logs in) ----------
# A User is a person. An Account (below) is a bank account that will belong to a user.

class User(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    email: str = Field(unique=True, index=True, max_length=254)
    password_hash: str  # argon2 hash, never the password and never sent to the client
    created_at: datetime = Field(default_factory=utcnow)


class UserCreate(SQLModel):  # body of POST /auth/register
    email: str = Field(max_length=254)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def _valid_email(cls, v: str) -> str:
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", v.strip()):
            raise ValueError("Invalid email address")
        return v


class UserRead(SQLModel):  # response: no password_hash
    id: int
    email: str


class Login(SQLModel):  # body of POST /auth/login
    email: str
    password: str


class Token(SQLModel):
    access_token: str
    token_type: str = "bearer"


# ---------- Accounts ----------

'''
    When no table = True, it is an API schema, describin shape of the data that crosses the HTTP boundary
'''

class AccountBase(SQLModel):
    name: str = Field(min_length=1, max_length=80)
    type: AccountType = AccountType.checking
    currency: str = Field(default="EUR", min_length=3, max_length=3)
    initial_balance_cents: int = 0
    # Reserved for bank sync later (e.g. a GoCardless / Tink account id)
    external_id: str | None = Field(default=None, index=True)


class Account(AccountBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=utcnow)

# Everything needed for creating an account, already in AccountBase
class AccountCreate(AccountBase):
    pass


class AccountUpdate(SQLModel):
    name: str | None = None
    type: AccountType | None = None
    currency: str | None = None
    initial_balance_cents: int | None = None


class AccountRead(AccountBase):
    id: int
    balance_cents: int


# ---------- Categories ----------

class CategoryBase(SQLModel):
    name: str = Field(min_length=1, max_length=50)
    kind: TxKind = TxKind.expense
    color: str = "#64748b"
    icon: str = "pricetag"


class Category(CategoryBase, table=True):
    id: int | None = Field(default=None, primary_key=True)


class CategoryCreate(CategoryBase):
    pass


class CategoryRead(CategoryBase):
    id: int


# ---------- Transactions ----------

class TransactionBase(SQLModel):
    account_id: int = Field(foreign_key="account.id", index=True)
    category_id: int | None = Field(default=None, foreign_key="category.id", index=True)
    kind: TxKind
    amount_cents: int = Field(gt=0)
    date: Date = Field(index=True)
    description: str = Field(default="", max_length=200)


class Transaction(TransactionBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    # Reserved for bank sync later, used to de-duplicate imported transactions
    external_id: str | None = Field(default=None, index=True)
    created_at: datetime = Field(default_factory=utcnow)


class TransactionCreate(TransactionBase):
    pass


class TransactionUpdate(SQLModel):
    account_id: int | None = None
    category_id: int | None = None
    kind: TxKind | None = None
    amount_cents: int | None = Field(default=None, gt=0)
    date: Date | None = None
    description: str | None = None


class TransactionRead(TransactionBase):
    id: int


# ---------- Budgets ----------

class BudgetBase(SQLModel):
    category_id: int = Field(foreign_key="category.id")
    month: str = Field(regex=r"^\d{4}-(0[1-9]|1[0-2])$", description="YYYY-MM")
    limit_cents: int = Field(gt=0)


class Budget(BudgetBase, table=True):
    __table_args__ = (UniqueConstraint("category_id", "month"),)
    id: int | None = Field(default=None, primary_key=True)


class BudgetCreate(BudgetBase):
    pass


class BudgetUpdate(SQLModel):
    limit_cents: int = Field(gt=0)


class BudgetRead(BudgetBase):
    id: int
    category_name: str
    category_color: str
    spent_cents: int
