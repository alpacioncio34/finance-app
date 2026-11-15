"""Bank data providers. `get_provider()` returns the one chosen by the BANK_PROVIDER env var."""

import os

from app.services.banking.base import BankProvider
from app.services.banking.sandbox import SandboxProvider

# Register real aggregators here once you have credentials for one.
PROVIDERS: dict[str, type] = {
    "sandbox": SandboxProvider,
}


class BankSyncDisabled(Exception):
    pass


def get_provider() -> BankProvider:
    name = os.getenv("BANK_PROVIDER", "sandbox").strip().lower()
    if name not in PROVIDERS:
        raise BankSyncDisabled(f"Bank sync is not configured (BANK_PROVIDER={name!r})")
    return PROVIDERS[name]()
