"""Bank connections: link a bank, import its accounts, sync transactions. Read-only (AIS).

Flow:
1. GET  /bank/institutions                 the app shows the list of banks
2. POST /bank/connections                  returns `auth_url`; the app opens it in a browser
3. the user approves at the bank, which redirects back to the app
4. POST /bank/connections/{id}/complete    imports the accounts and the first batch of transactions
5. POST /bank/connections/{id}/sync        any time later, pulls what is new

The app never sees bank credentials or tokens: they stay in this API, encrypted.
"""

from html import escape

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlmodel import Session, select

from app.db import get_session
from app.models import (
    Account,
    AccountSource,
    BankConnection,
    BankConnectionCreate,
    BankConnectionRead,
    BankLinkStart,
    BankSyncResult,
    ConnectionStatus,
    InstitutionRead,
    Transaction,
    User,
    as_utc,
)
from app.services import crypto
from app.services.auth import get_current_user, get_owned
from app.services.banking import BankSyncDisabled, get_provider
from app.services.banking.base import BankError, BankProvider, ConsentExpired, UnknownInstitution
from app.services.banking.redirects import is_allowed_redirect, with_query
from app.services.banking.sync import sync_connection

router = APIRouter(prefix="/bank", tags=["bank"])
# The sandbox bank's consent page is opened in a browser, so it can't send a Bearer token.
public_router = APIRouter(prefix="/bank/sandbox", tags=["bank sandbox"], include_in_schema=False)


def _provider() -> BankProvider:
    try:
        return get_provider()
    except BankSyncDisabled as e:
        raise HTTPException(503, str(e))


def _accounts(session: Session, conn: BankConnection) -> list[Account]:
    return list(session.exec(select(Account).where(Account.connection_id == conn.id)).all())


def _to_read(session: Session, conn: BankConnection) -> BankConnectionRead:
    return BankConnectionRead(
        id=conn.id,
        provider=conn.provider,
        institution_id=conn.institution_id,
        institution_name=conn.institution_name,
        status=conn.status,
        last_synced_at=as_utc(conn.last_synced_at),
        account_count=len(_accounts(session, conn)),
    )


def _owned_connection(session: Session, connection_id: int, user: User) -> BankConnection:
    conn = get_owned(session, BankConnection, connection_id, user)
    if not conn:
        raise HTTPException(404, "Bank connection not found")
    return conn


def _run_sync(session: Session, conn: BankConnection, provider: BankProvider, import_new_accounts: bool = False) -> int:
    if conn.provider != provider.name:
        raise HTTPException(409, "This connection was made with another provider. Disconnect it and connect the bank again.")
    try:
        return sync_connection(session, conn, provider, import_new_accounts)
    except ConsentExpired:
        session.rollback()
        conn.status = ConnectionStatus.expired
        session.add(conn)
        session.commit()
        raise HTTPException(409, "The bank's permission has expired. Connect the bank again.")
    except BankError as e:
        session.rollback()
        raise HTTPException(502, f"The bank did not answer correctly: {e}")


@router.get("/institutions", response_model=list[InstitutionRead])
def list_institutions(country: str | None = None):
    provider = _provider()
    return [
        InstitutionRead(id=i.id, name=i.name, country=i.country, provider=provider.name)
        for i in provider.list_institutions(country)
    ]


@router.get("/connections", response_model=list[BankConnectionRead])
def list_connections(session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    """The user's banks. Links that were started but never approved are left out."""
    conns = session.exec(
        select(BankConnection)
        .where(BankConnection.user_id == user.id, BankConnection.status != ConnectionStatus.pending)
        .order_by(BankConnection.created_at)
    ).all()
    return [_to_read(session, c) for c in conns]


@router.post("/connections", response_model=BankLinkStart, status_code=201)
def start_connection(
    data: BankConnectionCreate,
    request: Request,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Start linking a bank. Open the returned `auth_url` so the user can approve access."""
    provider = _provider()
    if not is_allowed_redirect(data.redirect_url):
        raise HTTPException(422, "redirect_url is not allowed (see BANK_REDIRECT_ALLOWLIST)")
    try:
        link = provider.start_link(data.institution_id, data.redirect_url, str(request.base_url))
    except UnknownInstitution:
        raise HTTPException(422, "Bank does not exist")
    except BankError as e:
        raise HTTPException(502, f"The bank did not answer correctly: {e}")

    # Links the user started earlier and never finished are no use any more
    stale = session.exec(
        select(BankConnection).where(BankConnection.user_id == user.id, BankConnection.status == ConnectionStatus.pending)
    ).all()
    for old in stale:
        session.delete(old)

    conn = BankConnection(
        user_id=user.id,
        provider=provider.name,
        institution_id=data.institution_id,
        institution_name=link.institution_name,
        external_id=link.external_id,
        credentials_encrypted=crypto.encrypt(link.credentials) if link.credentials else None,
        redirect_url=data.redirect_url,
    )
    session.add(conn)
    session.commit()
    session.refresh(conn)
    return BankLinkStart(connection=_to_read(session, conn), auth_url=link.auth_url)


@router.post("/connections/{connection_id}/complete", response_model=BankSyncResult)
def complete_connection(connection_id: int, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    """Call after the user comes back from the bank: imports accounts and recent transactions."""
    conn = _owned_connection(session, connection_id, user)
    provider = _provider()
    if conn.status == ConnectionStatus.linked:
        return BankSyncResult(connection=_to_read(session, conn), imported=0)
    if conn.provider != provider.name or not provider.is_authorised(conn):
        raise HTTPException(409, "The bank has not confirmed the connection yet")
    imported = _run_sync(session, conn, provider, import_new_accounts=True)
    conn.status = ConnectionStatus.linked
    session.add(conn)
    session.commit()
    session.refresh(conn)
    return BankSyncResult(connection=_to_read(session, conn), imported=imported)


@router.post("/connections/{connection_id}/sync", response_model=BankSyncResult)
def sync(connection_id: int, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    conn = _owned_connection(session, connection_id, user)
    if conn.status != ConnectionStatus.linked:
        raise HTTPException(409, "This bank is not connected. Connect it again.")
    imported = _run_sync(session, conn, _provider())
    session.refresh(conn)
    return BankSyncResult(connection=_to_read(session, conn), imported=imported)


@router.delete("/connections/{connection_id}", status_code=204)
def disconnect(
    connection_id: int,
    delete_accounts: bool = False,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Disconnect a bank.

    By default its accounts stay as manual accounts with everything imported so far.
    With `delete_accounts=true` the accounts and their transactions are deleted too.
    """
    conn = _owned_connection(session, connection_id, user)
    for acc in _accounts(session, conn):
        if delete_accounts:
            for tx in session.exec(select(Transaction).where(Transaction.account_id == acc.id)).all():
                session.delete(tx)
            session.delete(acc)
        else:
            # external_id is kept, so connecting the same bank again re-links this account
            acc.source = AccountSource.manual
            acc.connection_id = None
            session.add(acc)
    session.delete(conn)
    session.commit()


# ---------- Sandbox bank consent page (public, development only) ----------

PAGE = """<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{bank}</title>
<style>
  body {{ font-family: system-ui, sans-serif; background: #eef1ee; color: #1c2a24; margin: 0; padding: 24px; }}
  main {{ max-width: 420px; margin: 8vh auto; background: #fff; border-radius: 20px; padding: 28px; }}
  h1 {{ font-size: 22px; margin: 0 0 8px; }}
  p, li {{ line-height: 1.5; color: #55605a; }}
  .note {{ background: #fff6dc; color: #6b5200; border-radius: 12px; padding: 10px 14px; font-size: 14px; }}
  form {{ margin: 12px 0 0; }}
  button {{ width: 100%; padding: 14px; border-radius: 14px; border: 0; font-size: 16px; font-weight: 600; cursor: pointer; }}
  .yes {{ background: #1f5a41; color: #fff; }}
  .no {{ background: transparent; color: #a03b24; }}
</style></head>
<body><main>
  <p class="note">Sandbox bank. This is a pretend bank with made-up data. No real account is involved.</p>
  <h1>{bank}</h1>
  <p>Finance app is asking to:</p>
  <ul><li>see your accounts and balances</li><li>see your transactions</li></ul>
  <p>It can't move money or make payments.</p>
  <form method="post" action="{ref}/approve"><button class="yes">Allow access</button></form>
  <form method="post" action="{ref}/deny"><button class="no">Cancel</button></form>
</main></body></html>"""


def _pending_sandbox_connection(session: Session, ref: str) -> BankConnection:
    try:
        is_sandbox = get_provider().name == "sandbox"
    except BankSyncDisabled:
        is_sandbox = False
    conn = None
    if is_sandbox:
        conn = session.exec(
            select(BankConnection).where(
                BankConnection.provider == "sandbox",
                BankConnection.external_id == ref,
                BankConnection.status == ConnectionStatus.pending,
            )
        ).first()
    if conn is None:
        raise HTTPException(404, "This link is no longer valid. Go back to the app and start again.")
    return conn


@public_router.get("/consent/{ref}", response_class=HTMLResponse)
def sandbox_consent_page(ref: str, session: Session = Depends(get_session)):
    conn = _pending_sandbox_connection(session, ref)
    return PAGE.format(bank=escape(conn.institution_name), ref=escape(ref, quote=True))


@public_router.post("/consent/{ref}/approve")
def sandbox_approve(ref: str, session: Session = Depends(get_session)):
    conn = _pending_sandbox_connection(session, ref)
    conn.status = ConnectionStatus.authorised
    session.add(conn)
    session.commit()
    # The redirect target was validated and stored when the link started. It is never read from this request.
    return RedirectResponse(with_query(conn.redirect_url, status="approved"), status_code=303)


@public_router.post("/consent/{ref}/deny")
def sandbox_deny(ref: str, session: Session = Depends(get_session)):
    conn = _pending_sandbox_connection(session, ref)
    redirect_url = conn.redirect_url
    session.delete(conn)
    session.commit()
    return RedirectResponse(with_query(redirect_url, status="denied"), status_code=303)
