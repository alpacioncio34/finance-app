# Finance App

Personal finance manager: accounts, transactions, monthly budgets and a dashboard.
Built so that bank sync (Open Banking / PSD2) can be plugged in later without reshaping the data.

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

python -m app.seed --demo        # optional: 3 accounts + 3 months of fake data
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API docs: http://localhost:8000/docs · Tests: `pytest`

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
| **Accounts** | Balances per account, net worth, long-press to delete |

## Design decisions

- **Money is integer cents** everywhere (DB, API, app). Never floats.
- **Balance is computed**, not stored: `initial_balance + Σ income − Σ expense`. No drift between a stored number and the transactions.
- **`external_id`** on accounts and transactions is reserved for bank sync: it's the provider's id, used to de-duplicate imports.
- Budgets are **upserted** by `(category, month)`: posting twice updates the limit.
- Deleting a category keeps its transactions (they become uncategorised).

## API

| Method | Path | Notes |
|---|---|---|
| GET/POST | `/accounts` | list includes computed `balance_cents` |
| GET/PATCH/DELETE | `/accounts/{id}` | delete cascades to its transactions |
| GET/POST | `/categories` | `?kind=income\|expense`; 14 defaults seeded on startup |
| GET/POST | `/transactions` | filters: `month=YYYY-MM`, `account_id`, `category_id`, `kind` |
| GET/PATCH/DELETE | `/transactions/{id}` | category kind must match transaction kind |
| GET/POST | `/budgets` | `?month=YYYY-MM`, response includes `spent_cents` |
| POST | `/budgets/copy?from_month=&to_month=` | |
| GET | `/dashboard?month=YYYY-MM` | everything the Overview screen needs in one call |

## Roadmap

1. **Auth**: users + JWT, add `user_id` to every table. Needed before anything leaves your laptop.
2. **Transfers** between your own accounts (two linked transactions, excluded from income/expense totals).
3. **Postgres + Alembic migrations** instead of `create_all`.
4. **Bank sync (read-only first)**: an aggregator such as GoCardless Bank Account Data, Tink or Salt Edge. The backend stores the consent/requisition, pulls accounts and transactions on a schedule, matches them by `external_id`, and auto-categorises with simple rules.
5. **Making changes in the bank** (payments) is a different, much stricter tier: Payment Initiation (PIS) requires a licensed provider and strong customer authentication on every payment. Plan for it as a separate project.

## TODOS

1. Suscriptions must renovate monthly
