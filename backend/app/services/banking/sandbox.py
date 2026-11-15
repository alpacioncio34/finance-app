"""A fake bank for development and tests. No network, no real money, no real credentials.

It behaves like a real aggregator: the user is sent to a consent page (served by this API,
see routers/bank.py), approves, and then accounts and transactions can be fetched.
The data is generated from the date, so every sync returns the same history plus the new days.
"""

import hashlib
import random
import secrets
from datetime import date, timedelta

from app.models import AccountType, BankConnection, ConnectionStatus
from app.services.banking.base import (
    BankAccountData,
    BankTransactionData,
    Institution,
    LinkStart,
    UnknownInstitution,
)

INSTITUTIONS = [
    Institution("sandbox-norte", "Banco Norte (sandbox)", "ES"),
    Institution("sandbox-litoral", "Caja Litoral (sandbox)", "ES"),
    Institution("sandbox-atlantico", "Banco Atlântico (sandbox)", "PT"),
]

# (suffix, name, type, balance on EPOCH in cents)
ACCOUNTS = [
    ("current", "Current account", AccountType.checking, 150_000),
    ("savings", "Savings account", AccountType.savings, 800_000),
]
EPOCH = date(2025, 1, 1)

# (description, lowest cents, highest cents)
PURCHASES = [
    ("MERCADONA", 800, 6500),
    ("LIDL SUPERMERCADOS", 600, 4200),
    ("RENFE VIAJEROS", 250, 4900),
    ("UBER TRIP", 500, 1900),
    ("GLOVO", 900, 2800),
    ("RESTAURANTE LA PLAZA", 1200, 4500),
    ("CINESA", 700, 1800),
    ("FARMACIA CENTRAL", 300, 2500),
    ("COMPRA TARJETA 4829", 500, 6000),
]


def _rng(*parts: object) -> random.Random:
    seed = hashlib.sha256("|".join(str(p) for p in parts).encode()).digest()
    return random.Random(int.from_bytes(seed[:8], "big"))


def _day_movements(account_id: str, kind: str, day: date) -> list[BankTransactionData]:
    """Everything that happened on one day. Same input, same output, always."""
    rows: list[tuple[int, str]] = []
    if kind == "savings":
        if day.day == 28:
            rows.append((310, "INTERESES CUENTA AHORRO"))
    else:
        if day.day == 1:
            rows.append((185_000, "NOMINA ACME SL"))
        if day.day == 2:
            rows.append((-65_000, "ALQUILER PISO"))
        if day.day == 5:
            rows.append((-1_299, "NETFLIX.COM"))
            rows.append((-1_099, "SPOTIFY"))
        rng = _rng(account_id, day.isoformat())
        for _ in range(rng.choice([0, 0, 1, 1, 2, 3])):
            name, low, high = rng.choice(PURCHASES)
            rows.append((-rng.randint(low, high), name))
    return [
        BankTransactionData(external_id=f"{account_id}:{day.isoformat()}:{i}", date=day, amount_cents=amount, description=text)
        for i, (amount, text) in enumerate(rows)
    ]


def _movements(account_id: str, kind: str, start: date, end: date) -> list[BankTransactionData]:
    out: list[BankTransactionData] = []
    day = max(start, EPOCH)
    while day <= end:
        out.extend(_day_movements(account_id, kind, day))
        day += timedelta(days=1)
    return out


class SandboxProvider:
    name = "sandbox"

    def list_institutions(self, country: str | None) -> list[Institution]:
        return [i for i in INSTITUTIONS if country is None or i.country == country.upper()]

    def start_link(self, institution_id: str, redirect_url: str, api_base_url: str) -> LinkStart:
        inst = next((i for i in INSTITUTIONS if i.id == institution_id), None)
        if inst is None:
            raise UnknownInstitution(institution_id)
        ref = secrets.token_urlsafe(32)
        return LinkStart(
            external_id=ref,
            auth_url=f"{api_base_url.rstrip('/')}/bank/sandbox/consent/{ref}",
            institution_name=inst.name,
            # Stands in for the access token a real provider would return
            credentials=f"sandbox-token-{secrets.token_urlsafe(16)}",
        )

    def is_authorised(self, conn: BankConnection) -> bool:
        # The sandbox consent page flips the status itself. A real provider would ask its API here.
        return conn.status in (ConnectionStatus.authorised, ConnectionStatus.linked)

    def fetch_accounts(self, conn: BankConnection, credentials: str | None) -> list[BankAccountData]:
        today = date.today()
        accounts = []
        for suffix, name, type_, opening in ACCOUNTS:
            account_id = f"{conn.institution_id}:{suffix}"
            balance = opening + sum(m.amount_cents for m in _movements(account_id, suffix, EPOCH, today))
            accounts.append(BankAccountData(account_id, name, type_, "EUR", balance))
        return accounts

    def fetch_transactions(
        self, conn: BankConnection, credentials: str | None, account_external_id: str, date_from: date
    ) -> list[BankTransactionData]:
        kind = account_external_id.rsplit(":", 1)[-1]
        return _movements(account_external_id, kind, date_from, date.today())
