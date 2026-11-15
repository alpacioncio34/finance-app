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


class AccountSource(str, Enum):
    """Where an account's data comes from."""

    manual = "manual"  # the user types every transaction
    bank = "bank"  # read-only mirror of a bank account, filled by bank sync


class ConnectionStatus(str, Enum):
    pending = "pending"  # link started, user has not approved at the bank yet
    authorised = "authorised"  # user approved at the bank, accounts not imported yet
    linked = "linked"  # accounts imported, can be synced
    expired = "expired"  # consent ran out, the user must reconnect


def as_utc(dt: datetime | None) -> datetime | None:
    """SQLite returns naive datetimes. Everything we store is UTC, so re-attach the zone."""
    if dt is not None and dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt

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
    email: str = Field(max_length=254)
    password: str = Field(max_length=128)


class Token(SQLModel):
    access_token: str  # short-lived JWT, sent as "Authorization: Bearer ..."
    refresh_token: str  # long-lived, single use: exchange it at POST /auth/refresh
    token_type: str = "bearer"


class RefreshRequest(SQLModel):  # body of POST /auth/refresh and POST /auth/logout
    refresh_token: str = Field(max_length=256)


class RefreshToken(SQLModel, table=True):
    """One row per issued refresh token. Only the SHA-256 hash is stored, never the token."""

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    token_hash: str = Field(unique=True, index=True)
    expires_at: datetime
    revoked_at: datetime | None = None
    created_at: datetime = Field(default_factory=utcnow)


# ---------- Bank connections ----------
# One row per consent the user gave at a bank. A connection owns one or more bank accounts.

class BankConnection(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    provider: str  # which aggregator created it, e.g. "sandbox"
    institution_id: str
    institution_name: str
    status: ConnectionStatus = ConnectionStatus.pending
    # The provider's reference for this consent (requisition / session id). Never sent to the app.
    external_id: str = Field(unique=True, index=True)
    # Provider access token, encrypted with services/crypto.py. Never sent to the app.
    credentials_encrypted: str | None = None
    # Where the bank sends the user back to. Validated against an allowlist when the link starts.
    redirect_url: str
    last_synced_at: datetime | None = None
    created_at: datetime = Field(default_factory=utcnow)


class BankConnectionCreate(SQLModel):  # body of POST /bank/connections
    institution_id: str = Field(min_length=1, max_length=100)
    redirect_url: str = Field(min_length=1, max_length=500)


class BankConnectionRead(SQLModel):  # no external_id, no credentials
    id: int
    provider: str
    institution_id: str
    institution_name: str
    status: ConnectionStatus
    last_synced_at: datetime | None
    account_count: int


class BankLinkStart(SQLModel):  # response of POST /bank/connections
    connection: BankConnectionRead
    auth_url: str  # open this in a browser so the user can approve at the bank


class BankSyncResult(SQLModel):
    connection: BankConnectionRead
    imported: int  # new transactions added by this sync


class InstitutionRead(SQLModel):
    id: str
    name: str
    country: str
    provider: str


# ---------- Accounts ----------

'''
    When no table = True, it is an API schema, describin shape of the data that crosses the HTTP boundary
'''

class AccountBase(SQLModel):
    name: str = Field(min_length=1, max_length=80)
    type: AccountType = AccountType.checking
    currency: str = Field(default="EUR", min_length=3, max_length=3)
    initial_balance_cents: int = 0


class Account(AccountBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    # manual = the user enters transactions; bank = filled by bank sync and read-only in the API
    source: AccountSource = AccountSource.manual
    connection_id: int | None = Field(default=None, foreign_key="bankconnection.id", index=True)
    # The bank's id for this account. Used by bank sync to find the account again. Set by the server only.
    external_id: str | None = Field(default=None, index=True)
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
    source: AccountSource
    connection_id: int | None
    # Filled for bank accounts only
    institution_name: str | None = None
    last_synced_at: datetime | None = None


# ---------- Categories ----------

class CategoryBase(SQLModel):
    name: str = Field(min_length=1, max_length=50)
    kind: TxKind = TxKind.expense
    color: str = "#64748b"
    icon: str = "pricetag"


class Category(CategoryBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    # Categories are per user: each new user gets their own copy of the defaults (see seed.py)
    user_id: int = Field(foreign_key="user.id", index=True)


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
    user_id: int = Field(foreign_key="user.id", index=True)
    # The bank's id for this movement. Set by bank sync only, and used to skip rows already imported.
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
    # Not null means the bank imported it: only category and description can be edited
    external_id: str | None = None


# ---------- Budgets ----------

class BudgetBase(SQLModel):
    category_id: int = Field(foreign_key="category.id")
    month: str = Field(regex=r"^\d{4}-(0[1-9]|1[0-2])$", description="YYYY-MM")
    limit_cents: int = Field(gt=0)


class Budget(BudgetBase, table=True):
    __table_args__ = (UniqueConstraint("category_id", "month"),)
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)


class BudgetCreate(BudgetBase):
    pass


class BudgetUpdate(SQLModel):
    limit_cents: int = Field(gt=0)


class BudgetRead(BudgetBase):
    id: int
    category_name: str
    category_color: str
    spent_cents: int
