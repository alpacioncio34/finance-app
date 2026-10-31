import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Where the FastAPI backend lives.
 * 1. EXPO_PUBLIC_API_URL if set (see .env.*.example). Required, and HTTPS-only, in production builds.
 * 2. Otherwise: same machine that runs the Expo dev server, port 8000.
 *    This makes a physical phone on the same Wi-Fi work without config.
 */
function resolveBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (!__DEV__) {
    // Production bundle: never guess a host, and never use plain HTTP.
    if (!fromEnv) throw new Error('EXPO_PUBLIC_API_URL must be set for production builds');
    if (!fromEnv.startsWith('https://')) throw new Error('EXPO_PUBLIC_API_URL must use https:// in production');
  }
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `http://${window.location.hostname}:8000`;
  }
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (host) return `http://${host}:8000`;
  return Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000';
}

export const API_URL = resolveBaseUrl();

// ---------- Types (mirror backend/app/models.py) ----------

export type TxKind = 'income' | 'expense';
export type AccountType = 'checking' | 'savings' | 'cash' | 'credit' | 'investment';

export interface Account {
  id: number;
  name: string;
  type: AccountType;
  currency: string;
  initial_balance_cents: number;
  balance_cents: number;
  external_id: string | null;
}

export interface Category {
  id: number;
  name: string;
  kind: TxKind;
  color: string;
  icon: string;
}

export interface Transaction {
  id: number;
  account_id: number;
  category_id: number | null;
  kind: TxKind;
  amount_cents: number;
  date: string; // YYYY-MM-DD
  description: string;
}

export type TransactionInput = Omit<Transaction, 'id'>;

export interface Budget {
  id: number;
  category_id: number;
  month: string;
  limit_cents: number;
  category_name: string;
  category_color: string;
  spent_cents: number;
}

export interface Dashboard {
  month: string;
  total_balance_cents: number;
  income_cents: number;
  expense_cents: number;
  net_cents: number;
  spending_by_category: { category_id: number | null; name: string; color: string; amount_cents: number }[];
  trend: { month: string; income_cents: number; expense_cents: number }[];
  recent: Transaction[];
}

// ---------- Client ----------

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown, query?: Record<string, unknown>): Promise<T> {
  const qs = query
    ? '?' +
      Object.entries(query)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&')
    : '';
  const res = await fetch(`${API_URL}${path}${qs}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const data = await res.json();
      if (typeof data.detail === 'string') msg = data.detail;
      else if (Array.isArray(data.detail)) msg = data.detail.map((d: { msg: string }) => d.msg).join(', ');
    } catch {}
    throw new ApiError(res.status, msg);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export const api = {
  dashboard: (month: string) => request<Dashboard>('GET', '/dashboard', undefined, { month }),

  accounts: () => request<Account[]>('GET', '/accounts'),
  createAccount: (a: Pick<Account, 'name' | 'type' | 'currency' | 'initial_balance_cents'>) =>
    request<Account>('POST', '/accounts', a),
  deleteAccount: (id: number) => request<void>('DELETE', `/accounts/${id}`),

  categories: (kind?: TxKind) => request<Category[]>('GET', '/categories', undefined, { kind }),

  transactions: (filters: { month?: string; account_id?: number; kind?: TxKind } = {}) =>
    request<Transaction[]>('GET', '/transactions', undefined, filters),
  transaction: (id: number) => request<Transaction>('GET', `/transactions/${id}`),
  createTransaction: (t: TransactionInput) => request<Transaction>('POST', '/transactions', t),
  updateTransaction: (id: number, t: Partial<TransactionInput>) =>
    request<Transaction>('PATCH', `/transactions/${id}`, t),
  deleteTransaction: (id: number) => request<void>('DELETE', `/transactions/${id}`),

  budgets: (month: string) => request<Budget[]>('GET', '/budgets', undefined, { month }),
  setBudget: (b: { category_id: number; month: string; limit_cents: number }) => request<Budget>('POST', '/budgets', b),
  copyBudgets: (from_month: string, to_month: string) =>
    request<Budget[]>('POST', '/budgets/copy', undefined, { from_month, to_month }),
  deleteBudget: (id: number) => request<void>('DELETE', `/budgets/${id}`),
};
