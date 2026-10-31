import { router } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, View } from 'react-native';

import { TransactionRow } from '@/components/TransactionRow';
import { Empty, ErrorBanner, Fab, MonthSwitcher, Screen, Segmented, Text } from '@/components/ui';
import { api, type Transaction, type TxKind } from '@/lib/api';
import { currentMonth, dayLabel, formatMoney } from '@/lib/format';
import { useLookups } from '@/lib/lookups';
import { space, useTheme } from '@/lib/theme';
import { useQuery } from '@/lib/useQuery';

type Filter = 'all' | TxKind;

export default function Transactions() {
  const t = useTheme();
  const [month, setMonth] = useState(currentMonth());
  const [filter, setFilter] = useState<Filter>('all');
  const { data, error, loading, refetch } = useQuery(
    () => api.transactions({ month, kind: filter === 'all' ? undefined : filter }),
    [month, filter],
  );
  const { accountById, categoryById } = useLookups();

  // Group by day
  const groups = new Map<string, Transaction[]>();
  for (const tx of data ?? []) groups.set(tx.date, [...(groups.get(tx.date) ?? []), tx]);

  return (
    <>
      <Screen title="Activity" refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={refetch} />}>
        <MonthSwitcher month={month} onChange={setMonth} />
        <Segmented<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'expense', label: 'Spent', color: t.expense },
            { value: 'income', label: 'Income', color: t.income },
          ]}
        />
        {error && <ErrorBanner message={error} onRetry={refetch} />}
        {data?.length === 0 && <Empty icon="receipt-outline" title="No transactions this month" hint="Tap + to add one." />}

        {[...groups.entries()].map(([day, txs]) => {
          const dayTotal = txs.reduce((s, x) => s + (x.kind === 'income' ? x.amount_cents : -x.amount_cents), 0);
          return (
            <View key={day}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingBottom: space.xs, borderBottomWidth: 1, borderBottomColor: t.border }}>
                <Text variant="heading" style={{ fontSize: 15 }}>{dayLabel(day)}</Text>
                <Text variant="caption">{formatMoney(dayTotal, 'EUR', { signed: true })}</Text>
              </View>
              {txs.map((tx) => (
                <TransactionRow
                  key={tx.id}
                  tx={tx}
                  account={accountById.get(tx.account_id)}
                  category={tx.category_id ? categoryById.get(tx.category_id) : undefined}
                  onPress={() => router.push({ pathname: '/transaction-form', params: { id: tx.id } })}
                />
              ))}
            </View>
          );
        })}
      </Screen>
      <Fab onPress={() => router.push('/transaction-form')} />
    </>
  );
}
