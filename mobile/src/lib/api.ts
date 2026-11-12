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
  token_type: string;
}

export interface UserRead {
  id: number;
  email: string;
}

// ---------- Client ----------

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// If we do not use authorization in our headers, every call will return a 401, since now the backend endpoints require a token from the logged in user.

/*
  ROADMAP FOR AUTH IN FRONTEND:

2. Attach the token to every request. This is the part people forget.
- In request(), add Authorization: Bearer <token> to the headers.
- Keep the token in a module-level variable in api.ts, with a setToken() function. Then request() doesn't need React.
- Note the current headers line is body ? {...} : undefined. You'll have to merge the auth header in there so GET requests get it too.

3. Persist the token. Without this, the user has to log in on every app launch.
- On iOS and Android, use expo-secure-store. Install it with npx expo install expo-secure-store, as your CLAUDE.md says.
- On web, SecureStore doesn't work. Fall back to localStorage, with a small wrapper that picks by Platform.OS. Keep that wrapper in src/lib/, not src/app/.
- Persisting a bank-app token in localStorage is a weaker guarantee, so it's worth knowing about.

4. An auth context (session state). The whole app needs to know whether the user is logged in.
- Create a provider, for example src/lib/auth.tsx, with token, user, loading, signIn, signUp and signOut.
- On startup it reads the stored token, calls setToken, then calls /auth/me. If that fails, it clears the token.
- Expose it with a useAuth() hook.

5. Routing in expo-router. This is how the login screen becomes the entrance point.
- Wrap the app in your provider in _layout.tsx. Keep returning null while the fonts and the session are loading, to avoid a flash of the login screen.
- Add a login/register screen. A single screen with a mode toggle works, and Segmented from ui.tsx is a good fit. Put it in a route 
group such as src/app/(auth)/login.tsx.
- Guard the routes. Expo Router has <Stack.Protected guard={...}>. Put (tabs) and the three modal forms in a group guarded by "has a session", and 
the auth screen in a group guarded by "no session". Then logging in or out redirects automatically, with no manual router.replace.
- Use the form primitives from ui.tsx (Screen, Input, Button) and useTheme() for colours. Validate the email and the password length client-side,
 to match whatever UserCreate enforces.

 6. VALIDATION IN FRONTEND: TODO = SEE HOW WE WOULD DO IT
*/
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
    headers: body ? { 'Content-Type': 'application/json'} : undefined
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

  // After a register, we do not have a token, call login with same credentials if succesfull
  register: (u: UserCreate) => request<UserRead>('POST', '/auth/register',u),
  login: (l: Login) => request<Token>('POST','/auth/login',l),
  me: () => request<UserRead>('GET','/auth/me')
}; 
