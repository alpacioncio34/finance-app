# Finance App

A personal finance app for your phone. Track accounts, transactions and monthly budgets, and see where your money goes.
Everything is saved on the device. There is no server and no account to create.

```
finance-app/
├── mobile/    Expo (SDK 58) + expo-router, TypeScript. Runs on Android, iOS and the web.
└── backend/   The old FastAPI server. The app no longer uses it.
```

## Run it

```bash
cd mobile
npm install
npx expo start          # press w for the web, or scan the QR code with Expo Go
```

For installing on Android, iPhone or a desktop browser, and for a first-run guide, see **[INSTALL.md](INSTALL.md)**.

## Build an APK (Android)

```bash
cd mobile
npx eas login
npx eas build -p android --profile preview
```

EAS builds the app in the cloud and gives you a download link for an `.apk` you can install directly.
The `preview` profile is set in `mobile/eas.json`.

## What's in the app

| Screen | What it does |
|---|---|
| **Overview** | Total balance, month income / spent / net, spending by category, 6-month trend, recent transactions |
| **Activity** | Transactions for a month, grouped by day, filter by income or spending and by account, tap to edit or delete |
| **Budgets** | Monthly limit per expense category with progress, and "copy from last month" |
| **Accounts** | Net worth and a list of accounts, tap to edit |
| **Settings** | What is stored on this device, and erasing all data |

## Things to know

- **Your data stays on the device.** Uninstalling the app deletes it. On the web, clearing the site's data deletes it.
  There is no backup or sync yet.
- **Money is stored as whole cents**, never as decimals, so totals never drift.
- **Balances are calculated**, not stored: starting balance + income − spending.
- Bank connection was removed with the server. It needs a bank-data provider, which would bring back a backend.
