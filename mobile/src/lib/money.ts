/**
 * Every calculation that sums money lives here (the on-device counterpart of backend/app/services/money.py).
 * Screens never add up transactions themselves: when transfers arrive, the rule that excludes them
 * from income and expense totals changes in this file only.
 *
 * All amounts are integer cents. Pure functions: they take the rows and return numbers.
 */

import { monthRange } from '@/lib/format';
import type { Account, Transaction, TxKind } from '@/lib/types';

/** +amount for income, -amount for expense. */
export function signedCents(tx: Pick<Transaction, 'kind' | 'amount_cents'>): number {
  return tx.kind === 'income' ? tx.amount_cents : -tx.amount_cents;
}

function inMonth(tx: Transaction, month: string): boolean {
  const { start, end } = monthRange(month);
  return tx.date >= start && tx.date < end; // ISO dates compare correctly as strings
}

/** (income, expense) for the month. */
export function monthTotals(txs: Transaction[], month: string): { income: number; expense: number } {
  let income = 0;
  let expense = 0;
  for (const tx of txs) {
    if (!inMonth(tx, month)) continue;
    if (tx.kind === 'income') income += tx.amount_cents;
    else expense += tx.amount_cents;
  }
  return { income, expense };
}

/** Expense total per category id for the month. Uncategorised spending is under `null`. */
export function spendingByCategory(txs: Transaction[], month: string): Map<number | null, number> {
  const totals = new Map<number | null, number>();
  for (const tx of txs) {
    if (tx.kind !== 'expense' || !inMonth(tx, month)) continue;
    totals.set(tx.category_id, (totals.get(tx.category_id) ?? 0) + tx.amount_cents);
  }
  return totals;
}

/** Current balance of every account, in cents: initial balance + Σ income − Σ expense. */
export function accountBalances(accounts: Account[], txs: Transaction[]): Map<number, number> {
  const movements = new Map<number, number>();
  for (const tx of txs) movements.set(tx.account_id, (movements.get(tx.account_id) ?? 0) + signedCents(tx));
  return new Map(accounts.map((a) => [a.id, a.initial_balance_cents + (movements.get(a.id) ?? 0)]));
}
