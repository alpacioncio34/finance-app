"""Copy accounts and transactions from a bank connection into the user's data.

Rules:
- A bank account is matched on `Account.external_id`, a bank transaction on `Transaction.external_id`.
  Rows already imported are never touched again, so the user's own edits (category, description) survive.
- Balances stay computed, never stored. After each sync the account's `initial_balance_cents` is set so
  that `initial + Σ imported transactions` equals the balance the bank reports.
- Only booked transactions are imported, and nothing is ever written back to the bank.
"""

from datetime import date, timedelta

from sqlmodel import Session, select

from app.models import (
    Account,
    AccountSource,
    BankConnection,
    Category,
    Transaction,
    TxKind,
    utcnow,
)
from app.services import crypto
from app.services.banking.base import BankAccountData, BankProvider
from app.services.categorise import guess_category_id
from app.services.money import account_movements

FIRST_SYNC_DAYS = 90  # how much history the first sync brings in
OVERLAP_DAYS = 7  # later syncs look back a little, since banks post some movements late


def _credentials(conn: BankConnection) -> str | None:
    return crypto.decrypt(conn.credentials_encrypted) if conn.credentials_encrypted else None


def import_accounts(session: Session, conn: BankConnection, bank_accounts: list[BankAccountData]) -> list[Account]:
    """Create (or re-link) one local account per bank account of the connection."""
    accounts = []
    for data in bank_accounts:
        acc = session.exec(
            select(Account).where(Account.user_id == conn.user_id, Account.external_id == data.external_id)
        ).first()
        if acc is None:
            acc = Account(
                user_id=conn.user_id,
                name=data.name,  # the user can rename it; the app shows it grouped under the bank
                type=data.type,
                currency=data.currency,
                external_id=data.external_id,
            )
        acc.source = AccountSource.bank
        acc.connection_id = conn.id
        session.add(acc)
        accounts.append(acc)
    session.flush()
    return accounts


def sync_connection(session: Session, conn: BankConnection, provider: BankProvider, import_new_accounts: bool = False) -> int:
    """Pull new transactions for every account of the connection. Returns how many were added."""
    credentials = _credentials(conn)
    bank_accounts = provider.fetch_accounts(conn, credentials)
    if import_new_accounts:
        import_accounts(session, conn, bank_accounts)
    reported = {a.external_id: a for a in bank_accounts}

    today = date.today()
    if conn.last_synced_at is None:
        date_from = today - timedelta(days=FIRST_SYNC_DAYS)
    else:
        date_from = conn.last_synced_at.date() - timedelta(days=OVERLAP_DAYS)

    categories = list(session.exec(select(Category).where(Category.user_id == conn.user_id)).all())
    imported = 0
    for acc in session.exec(select(Account).where(Account.connection_id == conn.id)).all():
        if acc.external_id not in reported:
            continue  # the bank no longer lists it
        known = set(
            session.exec(
                select(Transaction.external_id).where(
                    Transaction.account_id == acc.id, Transaction.external_id != None  # noqa: E711
                )
            ).all()
        )
        for row in provider.fetch_transactions(conn, credentials, acc.external_id, date_from):
            if row.external_id in known or row.amount_cents == 0:
                continue
            kind = TxKind.income if row.amount_cents > 0 else TxKind.expense
            description = row.description.strip()[:200]
            session.add(
                Transaction(
                    user_id=conn.user_id,
                    account_id=acc.id,
                    external_id=row.external_id,
                    kind=kind,
                    amount_cents=abs(row.amount_cents),
                    date=row.date,
                    description=description,
                    category_id=guess_category_id(description, kind, categories),
                )
            )
            known.add(row.external_id)
            imported += 1
        session.flush()
        # Make the computed balance equal the bank's: initial = reported − Σ movements
        acc.initial_balance_cents = reported[acc.external_id].balance_cents - account_movements(session, acc)
        session.add(acc)

    conn.last_synced_at = utcnow()
    session.add(conn)
    session.commit()
    return imported
