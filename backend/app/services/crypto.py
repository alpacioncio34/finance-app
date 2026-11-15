"""Encryption for secrets that must be stored, such as bank access tokens.

Set BANK_TOKEN_KEY to a Fernet key in production:
    python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
Without it, a key is derived from JWT_SECRET so local development needs no extra setup.
Changing the key makes stored tokens unreadable: users then have to reconnect their bank.
"""

import base64
import os

from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF


def _fernet() -> Fernet:
    key = os.getenv("BANK_TOKEN_KEY")
    if key:
        return Fernet(key.encode())
    secret = os.getenv("JWT_SECRET", "")
    if not secret:
        raise RuntimeError("Set BANK_TOKEN_KEY (or JWT_SECRET) to store bank tokens (see .env.example)")
    derived = HKDF(algorithm=hashes.SHA256(), length=32, salt=None, info=b"finance-app/bank-token-key").derive(secret.encode())
    return Fernet(base64.urlsafe_b64encode(derived))


def encrypt(plaintext: str) -> str:
    return _fernet().encrypt(plaintext.encode()).decode()


def decrypt(ciphertext: str) -> str | None:
    """The plaintext, or None if the key changed or the value was tampered with."""
    try:
        return _fernet().decrypt(ciphertext.encode()).decode()
    except InvalidToken:
        return None
