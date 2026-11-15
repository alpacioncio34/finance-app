import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { tokenStore } from '@/lib/tokenStore';

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
/** manual = you enter the transactions. bank = read-only copy of a bank account, filled by bank sync. */
export type AccountSource = 'manual' | 'bank';
export type ConnectionStatus = 'pending' | 'authorised' | 'linked' | 'expired';

export interface Account {
  id: number;
  name: string;
  type: AccountType;
  currency: string;
  initial_balance_cents: number;
  balance_cents: number;
  source: AccountSource;
  connection_id: number | null;
  /** Bank accounts only */
  institution_name: string | null;
  last_synced_at: string | null;
}

export type AccountInput = Pick<Account, 'name' | 'type' | 'currency' | 'initial_balance_cents'>;

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
  /** Set when the bank imported it: only category and description can be edited. */
  external_id: string | null;
}

export type TransactionInput = Omit<Transaction, 'id' | 'external_id'>;

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

export interface UserCreate {
  email: string;
  password: string;
}

export interface Login {
  email: string;
  password: string;
}

export interface Token {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface UserRead {
  id: number;
  email: string;
}

export interface Institution {
  id: string;
  name: string;
  country: string;
  /** 'sandbox' means a pretend bank with made-up data. */
  provider: string;
}

export interface BankConnection {
  id: number;
  provider: string;
  institution_id: string;
  institution_name: string;
  status: ConnectionStatus;
  last_synced_at: string | null;
  account_count: number;
}

export interface BankLinkStart {
  connection: BankConnection;
  /** Open in a browser so the user can approve access at the bank. */
  auth_url: string;
}

export interface BankSyncResult {
  connection: BankConnection;
  imported: number;
}

// ---------- Client ----------

/** Every failed call ends up as one of these. `status` is 0 when the server could not be reached. */
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const http = axios.create({ baseURL: API_URL, timeout: 15000 });

/*
  How the session works:
  - Logging in returns an access token (lives minutes) and a refresh token (lives days).
  - The access token is kept in memory only and sent as "Authorization: Bearer ..." on every request.
  - The refresh token is kept in tokenStore (Keychain / Keystore on phones).
  - When a request comes back 401, the refresh token is swapped for a new pair and the request is retried once.
  - If that swap is refused, the session is over: the handler below tells the auth context to show the sign-in screen.
*/
let accessToken: string | null = null;
let signedOutHandler: (() => void) | null = null;

export function setSignedOutHandler(fn: (() => void) | null) {
  signedOutHandler = fn;
}

async function startSession(tokens: Token) {
  accessToken = tokens.access_token;
  await tokenStore.save(tokens.refresh_token);
}

async function endSession() {
  accessToken = null;
  await tokenStore.clear();
}

type RefreshResult = 'ok' | 'invalid' | 'offline';
let refreshing: Promise<RefreshResult> | null = null;

/**
 * Swap the stored refresh token for a new pair. A refresh token works only once, so concurrent
 * callers must share one request: a second request with the same token would look like theft
 * to the API and sign the user out everywhere.
 */
function refreshSession(): Promise<RefreshResult> {
  refreshing ??= (async (): Promise<RefreshResult> => {
    // Read from storage every time: on web another tab may have refreshed since.
    const stored = await tokenStore.load();
    if (!stored) return 'invalid';
    try {
      // Plain axios, not `http`, so the interceptors below don't run for this call
      const res = await axios.post<Token>(`${API_URL}/auth/refresh`, { refresh_token: stored }, { timeout: 15000 });
      await startSession(res.data);
      return 'ok';
    } catch (e) {
      if (axios.isAxiosError(e) && e.response?.status === 401) {
        await endSession();
        return 'invalid';
      }
      return 'offline';
    }
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

http.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

http.interceptors.response.use(undefined, async (error: AxiosError) => {
  const original = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
  // A 401 from login / register / refresh means "wrong credentials", not "session expired"
  const isCredentialCall = !!original?.url && /^\/auth\/(login|register|refresh|logout)/.test(original.url);
  if (error.response?.status === 401 && original && !original._retried && !isCredentialCall) {
    original._retried = true;
    const result = await refreshSession();
    if (result === 'ok') return http.request(original);
    if (result === 'invalid') signedOutHandler?.();
  }
  throw error;
});

/** Turn anything axios throws into an ApiError with the backend's own message. */
function toApiError(e: unknown): ApiError {
  if (!axios.isAxiosError(e)) return new ApiError(0, e instanceof Error ? e.message : String(e));
  if (!e.response) return new ApiError(0, `Can't reach the server at ${API_URL}. Is the backend running?`);
  const detail = (e.response.data as { detail?: unknown } | undefined)?.detail;
  let message = `${e.response.status} ${e.response.statusText}`.trim();
  if (typeof detail === 'string') message = detail;
  // FastAPI validation errors (422) come as a list of { msg }
  else if (Array.isArray(detail)) message = detail.map((d: { msg?: string }) => d.msg ?? '').filter(Boolean).join(', ');
  return new ApiError(e.response.status, message);
}

async function request<T>(method: string, path: string, body?: unknown, query?: Record<string, unknown>): Promise<T> {
  const params = query
    ? Object.fromEntries(Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== ''))
    : undefined;
  try {
    const res = await http.request<T>({ method, url: path, data: body, params });
    return res.status === 204 ? (undefined as T) : res.data;
  } catch (e) {
    throw toApiError(e);
  }
}

export const api = {
  // ----- Session -----
  async signIn(l: Login): Promise<UserRead> {
    await startSession(await request<Token>('POST', '/auth/login', l));
    return request<UserRead>('GET', '/auth/me');
  },
  // Registering does not log in, so sign in with the same credentials straight after
  async signUp(u: UserCreate): Promise<UserRead> {
    await request<UserRead>('POST', '/auth/register', u);
    return api.signIn(u);
  },
  async signOut(): Promise<void> {
    const stored = await tokenStore.load();
    // Best effort: the local session ends even if the server can't be reached
    if (stored) await request<void>('POST', '/auth/logout', { refresh_token: stored }).catch(() => {});
    await endSession();
  },
  /** On app start: the logged-in user if a stored session is still valid, else null. */
  async restoreSession(): Promise<UserRead | null> {
    if ((await refreshSession()) !== 'ok') return null;
    return request<UserRead>('GET', '/auth/me').catch(() => null);
  },

  dashboard: (month: string) => request<Dashboard>('GET', '/dashboard', undefined, { month }),

  accounts: () => request<Account[]>('GET', '/accounts'),
  account: (id: number) => request<Account>('GET', `/accounts/${id}`),
  createAccount: (a: AccountInput) => request<Account>('POST', '/accounts', a),
  updateAccount: (id: number, a: Partial<AccountInput>) => request<Account>('PATCH', `/accounts/${id}`, a),
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

  // ----- Bank connections (read-only) -----
  institutions: (country?: string) => request<Institution[]>('GET', '/bank/institutions', undefined, { country }),
  bankConnections: () => request<BankConnection[]>('GET', '/bank/connections'),
  /** Step 1: returns the URL where the user approves access at the bank. */
  startBankConnection: (institution_id: string, redirect_url: string) =>
    request<BankLinkStart>('POST', '/bank/connections', { institution_id, redirect_url }),
  /** Step 2, after the user comes back from the bank: imports accounts and recent transactions. */
  completeBankConnection: (id: number) => request<BankSyncResult>('POST', `/bank/connections/${id}/complete`),
  syncBankConnection: (id: number) => request<BankSyncResult>('POST', `/bank/connections/${id}/sync`),
  /** Keeps the accounts as manual ones unless `deleteAccounts` is true. */
  disconnectBank: (id: number, deleteAccounts = false) =>
    request<void>('DELETE', `/bank/connections/${id}`, undefined, { delete_accounts: deleteAccounts || undefined }),
};
