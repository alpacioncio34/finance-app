// Domain types. Everything lives on the device (see db.ts); these describe what the screens work with.

export type TxKind = 'income' | 'expense';
export type AccountType = 'checking' | 'savings' | 'cash' | 'credit' | 'investment';

/** What is stored: the balance is computed, never saved (see money.ts). */
export interface Account {
  id: number;
  name: string;
  type: AccountType;
  currency: string;
  initial_balance_cents: number;
}

/** An account with its current balance worked out. */
export interface AccountView extends Account {
  balance_cents: number;
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
  /** Always positive; `kind` gives the direction. */
  amount_cents: number;
  date: string; // YYYY-MM-DD
  description: string;
}

export type TransactionInput = Omit<Transaction, 'id'>;

export interface Budget {
  id: number;
  category_id: number;
  month: string; // YYYY-MM
  limit_cents: number;
}

/** A budget with its category name, colour and what has been spent so far. */
export interface BudgetView extends Budget {
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
