import type { IconName } from '@/components/ui';
import type { AccountType } from '@/lib/api';

export const ACCOUNT_TYPES: { value: AccountType; label: string; icon: IconName }[] = [
  { value: 'checking', label: 'Checking', icon: 'card' },
  { value: 'savings', label: 'Savings', icon: 'trending-up' },
  { value: 'cash', label: 'Cash', icon: 'cash' },
  { value: 'credit', label: 'Credit card', icon: 'card-outline' },
  { value: 'investment', label: 'Investment', icon: 'stats-chart' },
];
