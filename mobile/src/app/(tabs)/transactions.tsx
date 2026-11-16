import { router } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, View } from 'react-native';

import { TransactionRow } from '@/components/TransactionRow';
import { ChipPicker, Empty, ErrorBanner, Fab, MonthSwitcher, RowGroup, Screen, Segmented, Text } from '@/components/ui';
import { db } from '@/lib/db';
import { signedCents } from '@/lib/money';
import type { Transaction, TxKind } from '@/lib/types';
import { currentMonth, dayLabel, formatMoney } from '@/lib/format';
import { useLookups } from '@/lib/lookups';
import { space, useTheme } from '@/lib/theme';
import { useQuery } from '@/lib/useQuery';

type Filter = 'all' | TxKind;
const ALL_ACCOUNTS = 0;

export default function Transactions() {
  const t = useTheme();
  const [month, setMonth] = useState(currentMonth());
  const [filter, setFilter] = useState<Filter>('all');
  const [accountId, setAccountId] = useState(ALL_ACCOUNTS);
  const { data, error, loading, refetch } = useQuery(
    () => db.transactions({ month, kind: filter === 'all' ? undefined : filter, account_id: accountId || undefined }),
    [month, filter, accountId],
  );
  const { accounts, accountById, categoryById } = useLookups();

  // Group by day
  const groups = new Map<string, Transaction[]>();
  for (const tx of data ?? []) groups.set(tx.date, [...(groups.get(tx.date) ?? []), tx]);

  return (
    <>
      <Screen title="Activity" refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={refetch} />}>
        <MonthSwitcher month={month} onChange={setMonth} />
        <View style={{ gap: space.md }}>
          <Segmented<Filter>
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'All' },
              { value: 'expense', label: 'Spent', color: t.expense },
              { value: 'income', label: 'Income', color: t.income },
            ]}
          />
          {accounts.length > 1 && (
            <ChipPicker
              value={accountId}
              onChange={setAccountId}
              options={[
                { value: ALL_ACCOUNTS, label: 'All accounts' },
                ...accounts.map((a) => ({ value: a.id, label: a.name })),
              ]}
            />
          )}
        </View>
        {error && <ErrorBanner message={error} onRetry={refetch} />}
        {data?.length === 0 && <Empty icon="receipt-outline" title="Nothing here this month" hint="Tap + to add a transaction, or change the filters above." />}

        {[...groups.entries()].map(([day, txs]) => {
          const dayTotal = txs.reduce((s, x) => s + signedCents(x), 0);
          return (
            <View key={day} style={{ gap: space.sm }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: space.xs }}>
                <Text variant="label">{dayLabel(day)}</Text>
                <Text variant="caption">{formatMoney(dayTotal, 'EUR', { signed: true })}</Text>
              </View>
              <RowGroup>
                {txs.map((tx) => (
                  <TransactionRow
                    key={tx.id}
                    tx={tx}
                    account={accountById.get(tx.account_id)}
                    category={tx.category_id ? categoryById.get(tx.category_id) : undefined}
                    onPress={() => router.push({ pathname: '/transaction-form', params: { id: tx.id } })}
                  />
                ))}
              </RowGroup>
            </View>
          );
        })}
      </Screen>
      <Fab label="Add transaction" onPress={() => router.push('/transaction-form')} />
    </>
  );
}
