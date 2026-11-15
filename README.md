# Finance App

Personal finance manager: accounts, transactions, monthly budgets and a dashboard.
Each user logs in and sees only their own data. An account is either **manual** (you type the
transactions) or **connected to a bank** (read-only: balances and transactions come from the bank).
Bank sync currently runs against a built-in sandbox bank; a real Open Banking / PSD2 aggregator plugs in as one class.

```
finance-app/
├── backend/   FastAPI + SQLModel + SQLite
└── mobile/    Expo (SDK 58) + expo-router, TypeScript
```

## Run it

### 1. Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env             # then set JWT_SECRET to a long random string (32+ characters)
python -m app.seed --demo        # optional: user demo@example.com / demo-password with 3 months of fake data
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API docs: http://localhost:8000/docs · Tests: `pytest`

Upgrading from an older checkout: the tables changed (every row now has an owner), so delete
`backend/finance.db` once. It is recreated on startup.

### 2. App

```bash
cd mobile
npm install
npx expo start          # press w for web, or scan the QR with Expo Go
```

The app finds the backend automatically: it uses the same machine as the Expo dev server, port 8000.
So a phone on the same Wi-Fi works as long as uvicorn runs with `--host 0.0.0.0`.
To point it elsewhere, copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_URL`.

## What's in the MVP

| Screen | What it does |
|---|---|
| **Overview** | Total balance, month income / spent / net, spending by category, 6-month income vs expense trend, recent transactions |
| **Transactions** | Month view grouped by day, filter by income/expense, tap to edit or delete |
| **Budgets** | Monthly limit per expense category with progress (amber > 85 %, red when over), "copy from last month" |
| **Accounts** | Net worth, bank accounts grouped under their bank (update now, disconnect), manual accounts, tap to edit |
| **Sign in** | Log in or create an account. The session is renewed in the background, so you stay signed in |
| **Connect a bank** | Pick a bank, approve read-only access on the bank's page, accounts and 90 days of transactions are imported |

## Design decisions

- **Money is integer cents** everywhere (DB, API, app). Never floats.
- **Balance is computed**, not stored: `initial_balance + Σ income − Σ expense`. No drift between a stored number and the transactions.
- **`external_id`** on accounts and transactions is the bank's id, used to match rows so a sync never imports twice.
- **Two kinds of account.** Manual: you add, edit and delete transactions. Bank: read-only, the balance always equals
  the bank's, and on imported transactions only the category and description can be changed.
- **Auth.** Short-lived access token (JWT) plus a rotating refresh token stored hashed. Every query is filtered by the
  logged-in user; other users' rows answer 404.
- **Bank tokens never reach the app.** They are stored encrypted in the API. The app only receives the URL of the bank's approval page.
- Budgets are **upserted** by `(category, month)`: posting twice updates the limit.
- Deleting a category keeps its transactions (they become uncategorised).

## API

| Method | Path | Notes |
|---|---|---|
| POST | `/auth/register`, `/auth/login` | login returns `access_token` + `refresh_token` |
| POST | `/auth/refresh`, `/auth/logout` | refresh swaps the refresh token for a new pair (single use) |
| GET | `/auth/me` | the logged-in user |
| GET/POST | `/accounts` | list includes computed `balance_cents`, `source` (`manual` \| `bank`) |
| GET/PATCH/DELETE | `/accounts/{id}` | delete cascades to its transactions |
| GET/POST | `/categories` | `?kind=income\|expense`; 14 defaults seeded on startup |
| GET/POST | `/transactions` | filters: `month=YYYY-MM`, `account_id`, `category_id`, `kind` |
| GET/PATCH/DELETE | `/transactions/{id}` | category kind must match transaction kind |
| GET/POST | `/budgets` | `?month=YYYY-MM`, response includes `spent_cents` |
| POST | `/budgets/copy?from_month=&to_month=` | |
| GET | `/dashboard?month=YYYY-MM` | everything the Overview screen needs in one call |
| GET | `/bank/institutions` | banks that can be connected |
| GET/POST | `/bank/connections` | POST starts a link and returns `auth_url` to open in a browser |
| POST | `/bank/connections/{id}/complete` | after approving at the bank: imports accounts and transactions |
| POST | `/bank/connections/{id}/sync` | pulls new transactions |
| DELETE | `/bank/connections/{id}` | accounts stay as manual ones, or `?delete_accounts=true` |

Everything except `/health` and the `/auth` login routes needs `Authorization: Bearer <access_token>`.

## Roadmap

Done: auth, per-user data, bank connections against the sandbox bank, rule-based auto-categorisation.

1. **Transfers** between your own accounts (two linked transactions, excluded from income/expense totals).
2. **Postgres + Alembic migrations** instead of `create_all`.
3. **A real bank provider**: implement `BankProvider` (`backend/app/services/banking/base.py`) for an aggregator such as
   Enable Banking, Tink or Salt Edge, register it in `banking/__init__.py` and set `BANK_PROVIDER`. Add a scheduled sync.
4. **Making changes in the bank** (payments) is a different, much stricter tier: Payment Initiation (PIS) requires a licensed provider and strong customer authentication on every payment. Plan for it as a separate project.

## TODOS

1. Suscriptions must renovate monthly
2. Creating endpoints for seeing your current transactions