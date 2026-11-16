# Installing and using Finance

Finance keeps all your data on the device it runs on. Each installation is separate: **data does not sync between your phone, your laptop and the web**. Pick the way you want to run it below.

| Where | How | Effort |
|---|---|---|
| Android phone | Install an `.apk` file | Medium (one cloud build) |
| Android or iPhone, quick test | Expo Go app | Low |
| iPhone, permanent install | Build for iOS with EAS, then TestFlight | High (Apple developer account needed) |
| Windows, macOS or Linux | Open the web version in a browser | Low |

---

## Before you start (all platforms)

You need the project folder and [Node.js](https://nodejs.org) 20 or newer.

```bash
node --version      # should print v20 or higher
cd finance-app/mobile
npm install         # run once, and again after the project is updated
```

Only `mobile/` is needed. The `backend/` folder is not used by the app.

---

## Android: install an APK

The APK is built in the cloud by Expo (EAS). You need a free Expo account.

1. Create an account at https://expo.dev and ask the project owner to give you access to the `alpacioncios-team` organisation, or create your own project.
2. Build the APK:
   ```bash
   cd mobile
   npx eas login
   npx eas build -p android --profile preview
   ```
   The first build asks for an Android package name, for example `com.yourname.finance`. Answer yes to let EAS save it.
3. When the build finishes, the terminal shows a download link. Open it on the phone (or download on the computer and copy the file over).
4. Allow installs from your browser or file manager when Android asks, then open the `.apk` and tap **Install**.

To update later, run the build command again and install the new file over the old one. Your data is kept because the package name stays the same.

**Quick test without building:** install **Expo Go** from the Play Store, run `npx expo start` in `mobile/`, and scan the QR code. The phone and computer must be on the same Wi-Fi.

---

## iPhone and iPad

Apple does not allow installing unsigned apps, so there are two options:

- **Expo Go (free, for testing):** install Expo Go from the App Store, run `npx expo start` in `mobile/`, scan the QR code with the Camera app. Works while the computer's dev server runs.
- **A permanent install (needs an Apple Developer account, about 99 USD a year):**
  ```bash
  cd mobile
  npx eas login
  npx eas build -p ios --profile preview
  ```
  EAS asks for your Apple credentials and an iOS bundle identifier, for example `com.yourname.finance`. When the build finishes, upload it with `npx eas submit -p ios` and install it through **TestFlight** on your iPhone.

---

## Windows, macOS and Linux

The desktop version is the web version, run in a browser. No installer is needed.

**Option A: run the development server (you are developing or testing):**

```bash
cd mobile
npx expo start --web
```

A browser tab opens at `http://localhost:8081`. Keep the terminal open while you use the app.

**Option B: build a static copy you can open any time:**

```bash
cd mobile
npx expo export --platform web
```

This writes the app to `mobile/dist/`. Serve that folder with any static file server, for example:

```bash
npx serve dist            # then open the address it prints
```

Or copy the `dist` folder to any web host. Opening `dist/index.html` directly from disk may not work, because the app loads its files by path. Use a server.

Your data is stored in the browser for that address. Use the same browser and address to keep it. Clearing the browser's site data deletes it.

---

## Using the app

### First run
1. Open **Accounts** and tap **Add**. Create one account per place you keep money: current account, savings, wallet, credit card. Enter today's balance (a negative number for debt).
2. Open **Overview** and tap **+** to add your first transaction. Choose *Spent* or *Income*, the amount in euros (for example `12,50`), the category, the account and the date.
3. Use **Budgets** to set a monthly limit per category. Use **Copy from last month** to repeat last month's limits.

### Daily use
- **Overview:** this month's balance, income, spending by category and a six-month trend.
- **Activity:** every transaction in a month, grouped by day. Use the filters to show only spending or income, or one account. Tap a transaction to edit or delete it.
- **Budgets:** how much of each limit you have used. Amber means over 85 %, red means over the limit.
- **Accounts:** your net worth and each account's balance. Tap an account to rename it, change its type or starting balance, or delete it. Deleting an account deletes its transactions too.
- **Settings** (the person icon on Overview): shows how much is stored and lets you erase everything.

### Back up your data
There is no built-in backup yet. Your data lives only on that device or in that browser. If you change phones or browsers, you start again from an empty app. Until a backup feature exists, keep notes of important figures, or ask for one to be added.

---

## Troubleshooting

| Problem | What to do |
|---|---|
| `node: command not found` or version below 20 | Install Node.js 20 or newer from nodejs.org, then open a new terminal |
| `npm install` fails | Check your internet connection and run it again |
| Expo Go shows "Something went wrong" | Make sure the phone and computer are on the same Wi-Fi, then press **r** in the terminal to reload |
| The APK won't install on Android | Allow "Install unknown apps" for the app you opened the file with |
| Data disappeared on the web | The browser's site data was cleared, or you opened a different address or browser |
| "Couldn't open your saved data" on startup | The saved data could not be read. Do not erase it without checking; tell the developer |
