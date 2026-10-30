import { api, type Account, type Category } from '@/lib/api';
import { useQuery } from '@/lib/useQuery';

/** Accounts + categories as id-indexed maps, for rendering rows and pickers. */
export function useLookups() {
  const q = useQuery(() => Promise.all([api.accounts(), api.categories()]));
  const [accounts = [], categories = []] = q.data ?? [];
  return {
    ...q,
    accounts,
    categories,
    accountById: new Map<number, Account>(accounts.map((a) => [a.id, a])),
    categoryById: new Map<number, Category>(categories.map((c) => [c.id, c])),
  };
}
