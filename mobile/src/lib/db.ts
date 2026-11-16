/**
 * The app's data layer. Everything is stored on the device, in AsyncStorage (SQLite on phones,
 * localStorage on the web). There is no server: this file replaces the old HTTP client.
 *
 * How it works:
 * - `initDb()` loads the saved data once at startup into memory. Reads are then synchronous work
 *   on that copy, and every method still returns a Promise so screens don't change shape.
 * - Every write changes the in-memory copy, then saves the whole copy. Saves run one after another,
 *   so a slow save can't overwrite a newer one.
 * - The validation rules and cascades of the old backend (e.g. deleting an account deletes its transactions) are enforced here.
 *   Errors are thrown as Error with a message meant for the user.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { accountBalances, monthTotals, spendingByCategory } from '@/lib/money';
import { currentMonth, isValidISODate, monthRange, shiftMonth } from '@/lib/format';
import type {
  Account,
  AccountType,
  AccountView,
  Budget,
  BudgetView,
  Category,
  Dashboard,
  Transaction,
  TransactionInput,
  TxKind,
} from '@/lib/types';

const STORAGE_KEY = 'finance.v1';
const ACCOUNT_TYPES: AccountType[] = ['checking', 'savings', 'cash', 'credit', 'investment'];
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Default categories, copied into a fresh store (was backend/app/seed.py). */
const DEFAULT_CATEGORIES: Omit<Category, 'id'>[] = [
  { name: 'Groceries', kind: 'expense', color: '#22c55e', icon: 'cart' },
  { name: 'Rent', kind: 'expense', color: '#6366f1', icon: 'home' },
  { name: 'Transport', kind: 'expense', color: '#0ea5e9', icon: 'bus' },
  { name: 'Eating out', kind: 'expense', color: '#f97316', icon: 'restaurant' },
  { name: 'Leisure', kind: 'expense', color: '#ec4899', icon: 'game-controller' },
  { name: 'Travel', kind: 'expense', color: '#14b8a6', icon: 'airplane' },
  { name: 'Subscriptions', kind: 'expense', color: '#a855f7', icon: 'repeat' },
  { name: 'Health', kind: 'expense', color: '#ef4444', icon: 'medkit' },
  { name: 'Education', kind: 'expense', color: '#eab308', icon: 'school' },
  { name: 'Other', kind: 'expense', color: '#64748b', icon: 'ellipsis-horizontal' },
  { name: 'Salary', kind: 'income', color: '#16a34a', icon: 'briefcase' },
  { name: 'Scholarship', kind: 'income', color: '#0891b2', icon: 'ribbon' },
  { name: 'Gifts', kind: 'income', color: '#db2777', icon: 'gift' },
  { name: 'Other income', kind: 'income', color: '#475569', icon: 'cash' },
];

interface Store {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
}

type AccountInput = Pick<Account, 'name' | 'type' | 'currency' | 'initial_balance_cents'>;

let store: Store | null = null;
let saving: Promise<void> = Promise.resolve();

function freshStore(): Store {
  return {
    accounts: [],
    categories: DEFAULT_CATEGORIES.map((c, i) => ({ ...c, id: i + 1 })),
    transactions: [],
    budgets: [],
  };
}

function current(): Store {
  if (!store) throw new Error('Data is not loaded yet');
  return store;
}

/** Save the whole store. Chained so saves happen in order. */
function persist(): Promise<void> {
  const snapshot = JSON.stringify(current());
  saving = saving.then(() => AsyncStorage.setItem(STORAGE_KEY, snapshot));
  return saving;
}

function nextId(rows: { id: number }[]): number {
  return rows.reduce((max, r) => Math.max(max, r.id), 0) + 1;
}

/** Load the saved data. Call once at startup, before any screen reads. */
export async function initDb(): Promise<void> {
  if (store) return;
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  // If the saved text can't be read, this throws instead of silently replacing the user's data.
  store = raw ? (JSON.parse(raw) as Store) : freshStore();
  if (!raw) await persist();
}

// ---------- Validation (same rules as the old backend routers) ----------

function cleanAccount(input: AccountInput): AccountInput {
  const name = input.name.trim();
  if (name.length < 1 || name.length > 80) throw new Error('Account name must be 1 to 80 characters.');
  if (!ACCOUNT_TYPES.includes(input.type)) throw new Error('Unknown account type.');
  if (!Number.isInteger(input.initial_balance_cents)) throw new Error('Balance must be a whole number of cents.');
  return { name, type: input.type, currency: input.currency || 'EUR', initial_balance_cents: input.initial_balance_cents };
}

function checkTransaction(s: Store, t: TransactionInput) {
  if (!s.accounts.some((a) => a.id === t.account_id)) throw new Error('Account does not exist');
  if (!Number.isInteger(t.amount_cents) || t.amount_cents <= 0) throw new Error('Amount must be greater than 0.');
  if (!isValidISODate(t.date)) throw new Error('Use the form YYYY-MM-DD, for example 2026-10-29.');
  if (t.description.length > 200) throw new Error('Description is too long (200 characters at most).');
  if (t.category_id !== null) {
    const cat = s.categories.find((c) => c.id === t.category_id);
    if (!cat) throw new Error('Category does not exist');
    if (cat.kind !== t.kind) throw new Error(`Category '${cat.name}' is for ${cat.kind}, not ${t.kind}`);
  }
}

function withBalance(s: Store, accounts: Account[]): AccountView[] {
  const balances = accountBalances(accounts, s.transactions);
  return accounts.map((a) => ({ ...a, balance_cents: balances.get(a.id) ?? a.initial_balance_cents }));
}

function sortByDateDesc(txs: Transaction[]): Transaction[] {
  return [...txs].sort((a, b) => (a.date === b.date ? b.id - a.id : a.date < b.date ? 1 : -1));
}

function budgetView(s: Store, b: Budget, spent: Map<number | null, number>): BudgetView {
  const cat = s.categories.find((c) => c.id === b.category_id);
  return {
    ...b,
    category_name: cat?.name ?? 'Unknown',
    category_color: cat?.color ?? '#64748b',
    spent_cents: spent.get(b.category_id) ?? 0,
  };
}

// ---------- The data methods (same names the screens used with the old API) ----------

export const db = {
  // ----- Accounts -----
  async accounts(): Promise<AccountView[]> {
    const s = current();
    return withBalance(s, s.accounts);
  },

  async account(id: number): Promise<AccountView> {
    const s = current();
    const acc = s.accounts.find((a) => a.id === id);
    if (!acc) throw new Error('Account not found');
    return withBalance(s, [acc])[0];
  },

  async createAccount(input: AccountInput): Promise<AccountView> {
    const s = current();
    const acc: Account = { id: nextId(s.accounts), ...cleanAccount(input) };
    s.accounts.push(acc);
    await persist();
    return withBalance(s, [acc])[0];
  },

  async updateAccount(id: number, patch: Partial<AccountInput>): Promise<AccountView> {
    const s = current();
    const acc = s.accounts.find((a) => a.id === id);
    if (!acc) throw new Error('Account not found');
    const next = cleanAccount({ ...acc, ...patch });
    Object.assign(acc, next);
    await persist();
    return withBalance(s, [acc])[0];
  },

  /** Deletes the account and all of its transactions. */
  async deleteAccount(id: number): Promise<void> {
    const s = current();
    s.accounts = s.accounts.filter((a) => a.id !== id);
    s.transactions = s.transactions.filter((t) => t.account_id !== id);
    await persist();
  },

  // ----- Categories -----
  async categories(kind?: TxKind): Promise<Category[]> {
    return current()
      .categories.filter((c) => !kind || c.kind === kind)
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  // ----- Transactions -----
  async transactions(filters: { month?: string; account_id?: number; kind?: TxKind } = {}): Promise<Transaction[]> {
    const { month, account_id, kind } = filters;
    const range = month ? monthRange(month) : null;
    return sortByDateDesc(
      current().transactions.filter(
        (t) =>
          (!range || (t.date >= range.start && t.date < range.end)) &&
          (account_id === undefined || t.account_id === account_id) &&
          (!kind || t.kind === kind),
      ),
    );
  },

  async transaction(id: number): Promise<Transaction> {
    const tx = current().transactions.find((t) => t.id === id);
    if (!tx) throw new Error('Transaction not found');
    return tx;
  },

  async createTransaction(input: TransactionInput): Promise<Transaction> {
    const s = current();
    checkTransaction(s, input);
    const tx: Transaction = { id: nextId(s.transactions), ...input, description: input.description.trim() };
    s.transactions.push(tx);
    await persist();
    return tx;
  },

  async updateTransaction(id: number, patch: Partial<TransactionInput>): Promise<Transaction> {
    const s = current();
    const tx = s.transactions.find((t) => t.id === id);
    if (!tx) throw new Error('Transaction not found');
    const next = { ...tx, ...patch, description: (patch.description ?? tx.description).trim() };
    checkTransaction(s, next);
    Object.assign(tx, next);
    await persist();
    return tx;
  },

  async deleteTransaction(id: number): Promise<void> {
    const s = current();
    if (!s.transactions.some((t) => t.id === id)) throw new Error('Transaction not found');
    s.transactions = s.transactions.filter((t) => t.id !== id);
    await persist();
  },

  // ----- Budgets -----
  async budgets(month: string): Promise<BudgetView[]> {
    const s = current();
    const spent = spendingByCategory(s.transactions, month);
    return s.budgets
      .filter((b) => b.month === month)
      .map((b) => budgetView(s, b, spent))
      .sort((a, b) => a.category_name.localeCompare(b.category_name));
  },

  /** Creates the budget, or changes the limit if the category already has one that month. */
  async setBudget(input: { category_id: number; month: string; limit_cents: number }): Promise<BudgetView> {
    const s = current();
    if (!MONTH.test(input.month)) throw new Error('Month must look like 2026-10.');
    if (!Number.isInteger(input.limit_cents) || input.limit_cents <= 0) throw new Error('Limit must be greater than 0.');
    const cat = s.categories.find((c) => c.id === input.category_id);
    if (!cat) throw new Error('Category does not exist');
    if (cat.kind !== 'expense') throw new Error('Budgets can only be set on expense categories');
    let b = s.budgets.find((x) => x.category_id === input.category_id && x.month === input.month);
    if (b) b.limit_cents = input.limit_cents;
    else {
      b = { id: nextId(s.budgets), ...input };
      s.budgets.push(b);
    }
    await persist();
    return budgetView(s, b, spendingByCategory(s.transactions, input.month));
  },

  /** Copies budgets from one month to another. Categories already budgeted in the target month are skipped. */
  async copyBudgets(fromMonth: string, toMonth: string): Promise<BudgetView[]> {
    const s = current();
    const already = new Set(s.budgets.filter((b) => b.month === toMonth).map((b) => b.category_id));
    for (const b of s.budgets.filter((x) => x.month === fromMonth)) {
      if (!already.has(b.category_id)) s.budgets.push({ id: nextId(s.budgets), category_id: b.category_id, month: toMonth, limit_cents: b.limit_cents });
    }
    await persist();
    return db.budgets(toMonth);
  },

  async deleteBudget(id: number): Promise<void> {
    const s = current();
    if (!s.budgets.some((b) => b.id === id)) throw new Error('Budget not found');
    s.budgets = s.budgets.filter((b) => b.id !== id);
    await persist();
  },

  // ----- Overview -----
  async dashboard(month: string = currentMonth(), monthsBack = 6): Promise<Dashboard> {
    const s = current();
    const { income, expense } = monthTotals(s.transactions, month);
    const cats = new Map(s.categories.map((c) => [c.id, c]));
    const spending = [...spendingByCategory(s.transactions, month)]
      .map(([cid, total]) => ({
        category_id: cid,
        name: cid !== null && cats.has(cid) ? cats.get(cid)!.name : 'Uncategorised',
        color: cid !== null && cats.has(cid) ? cats.get(cid)!.color : '#94a3b8',
        amount_cents: total,
      }))
      .sort((a, b) => b.amount_cents - a.amount_cents);

    const trend = [];
    for (let i = monthsBack - 1; i >= 0; i--) {
      const m = shiftMonth(month, -i);
      const t = monthTotals(s.transactions, m);
      trend.push({ month: m, income_cents: t.income, expense_cents: t.expense });
    }

    const balances = accountBalances(s.accounts, s.transactions);
    const totalBalance = [...balances.values()].reduce((sum, v) => sum + v, 0);

    return {
      month,
      total_balance_cents: totalBalance,
      income_cents: income,
      expense_cents: expense,
      net_cents: income - expense,
      spending_by_category: spending,
      trend,
      recent: sortByDateDesc(s.transactions).slice(0, 5),
    };
  },

  // ----- Device data -----
  /** Counts for the settings screen. */
  async stats(): Promise<{ accounts: number; transactions: number; budgets: number }> {
    const s = current();
    return { accounts: s.accounts.length, transactions: s.transactions.length, budgets: s.budgets.length };
  },

  /** Deletes everything and restores the default categories. */
  async eraseAll(): Promise<void> {
    store = freshStore();
    await persist();
  },
};
