"""What every bank data provider (aggregator) must offer.

The rest of the app only talks to this interface, so adding a real aggregator
(Enable Banking, Tink, Salt Edge, GoCardless...) means writing one class and
registering it in `banking/__init__.py`. Nothing else changes.

Bank sync is read-only (account information). Payments are out of scope.
"""

from dataclasses import dataclass
from datetime import date
from typing import Protocol

from app.models import AccountType, BankConnection


class BankError(Exception):
    """The provider failed or refused. Routers turn this into a 502."""


class UnknownInstitution(BankError):
    pass


class ConsentExpired(BankError):
    """The user's consent ran out (PSD2 consents last a limited time). The user must reconnect."""


@dataclass(frozen=True)
class Institution:
    id: str
    name: str
    country: str


@dataclass(frozen=True)
class LinkStart:
    external_id: str  # the provider's reference for this consent
    auth_url: str  # where the user approves access
    institution_name: str
    credentials: str | None = None  # provider access token, if it issues one. Stored encrypted.


@dataclass(frozen=True)
class BankAccountData:
    external_id: str
    name: str
    type: AccountType
    currency: str
    balance_cents: int  # balance reported by the bank right now


@dataclass(frozen=True)
class BankTransactionData:
    external_id: str
    date: date
    amount_cents: int  # signed: positive is money in, negative is money out
    description: str


class BankProvider(Protocol):
    name: str

    def list_institutions(self, country: str | None) -> list[Institution]: ...

    def start_link(self, institution_id: str, redirect_url: str, api_base_url: str) -> LinkStart:
        """Begin a consent. The user must then open `auth_url`."""
        ...

    def is_authorised(self, conn: BankConnection) -> bool:
        """Has the user approved this consent at the bank?"""
        ...

    def fetch_accounts(self, conn: BankConnection, credentials: str | None) -> list[BankAccountData]: ...

    def fetch_transactions(
        self, conn: BankConnection, credentials: str | None, account_external_id: str, date_from: date
    ) -> list[BankTransactionData]:
        """Booked transactions of one account from `date_from` until today."""
        ...
