# Tests

Run from `backend/`:

```bash
pytest -q
```

## How they work

- Every test gets a fresh **in-memory SQLite** database, so `finance.db` is never touched and tests don't affect each other.
- `conftest.py` provides the fixtures:
  - `client`: a test client already registered and logged in (sends the Bearer token for you).
  - `other_client`: a second logged-in user, for checking that users can't reach each other's data.
  - `anon_client`: a test client with no login, for checking that routes reject unauthenticated requests.
- The app's `get_session` dependency is overridden to use that in-memory DB, and `JWT_SECRET` is set automatically.
- Bank tests use the sandbox bank, so nothing leaves the machine.

## Files

- `test_api.py`: accounts, transactions, budgets, categories (happy paths and validation rules).
- `test_auth.py`: register, login, refresh tokens, logout, login throttling, and that every route needs a token.
- `test_isolation.py`: one user can't see or change another user's rows.
- `test_bank.py`: connecting a bank, syncing, read-only rules for bank accounts, token encryption, redirect allowlist.
- `test_money.py`: the money calculations.

## Adding a test

Write a function starting with `test_` and take `client` as an argument:

```python
def test_something(client):
    r = client.get("/accounts")
    assert r.status_code == 200
```
