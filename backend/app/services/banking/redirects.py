"""Where a bank may send the user back to after consent.

The redirect URL comes from the app, so it is checked against an allowlist before it is
stored. Otherwise the consent flow could be used to bounce a user to any site.

BANK_REDIRECT_ALLOWLIST is comma-separated. An entry is either a bare scheme ("financeapp",
the app's deep-link scheme) or an origin ("https://app.example.com"). Origins match on
scheme + host; for localhost any port is accepted.
"""

import os
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

DEFAULT_ALLOWLIST = "financeapp,exp,http://localhost,http://127.0.0.1"


def is_allowed_redirect(url: str) -> bool:
    try:
        target = urlsplit(url)
    except ValueError:
        return False
    if not target.scheme:
        return False
    for entry in os.getenv("BANK_REDIRECT_ALLOWLIST", DEFAULT_ALLOWLIST).split(","):
        entry = entry.strip()
        if not entry:
            continue
        if "://" not in entry:
            if target.scheme == entry.lower():
                return True
            continue
        allowed = urlsplit(entry)
        if target.scheme != allowed.scheme or target.hostname != allowed.hostname:
            continue
        if allowed.port is None or allowed.port == target.port:
            return True
    return False


def with_query(url: str, **params: str) -> str:
    """Add query parameters to a URL, keeping the ones it already has."""
    parts = urlsplit(url)
    query = dict(parse_qsl(parts.query))
    query.update(params)
    return urlunsplit(parts._replace(query=urlencode(query)))
