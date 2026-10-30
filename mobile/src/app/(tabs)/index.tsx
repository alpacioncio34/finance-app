import { router } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, View } from 'react-native';

import { CategoryBreakdown, TrendChart } from '@/components/charts';
import { TransactionRow } from '@/components/TransactionRow';
import { Card, ErrorBanner, Fab, MonthSwitcher, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { currentMonth, formatMoney } from '@/lib/format';
import { useLookups } from '@/lib/lookups';
import { space, useTheme } from '@/lib/theme';
import { useQuery } from '@/lib/useQuery';

export default function Overview() {
  const t = useTheme();
  const [month, setMonth] = useState(currentMonth());
  const { data, error, loading, refetch } = useQuery(() => api.dashboard(month), [month]);
  const { accountById, categoryById } = useLookups();

  return (
    <>
      <Screen refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={refetch} />}>
        {error && <ErrorBanner message={error} onRetry={refetch} />}

        <View style={{ gap: space.xs }}>
          <Text variant="label">Total balance</Text>
          <Text variant="title">{data ? formatMoney(data.total_balance_cents) : '—'}</Text>
        </View>

        <MonthSwitcher month={month} onChange={setMonth} />

        <View style={{ flexDirection: 'row', gap: space.md }}>
          <Stat label="Income" value={data?.income_cents} color={t.income} />
          <Stat label="Spent" value={data?.expense_cents} color={t.expense} />
          <Stat label="Net" value={data?.net_cents} color={(data?.net_cents ?? 0) >= 0 ? t.income : t.expense} />
        </View>

        <Card style={{ gap: space.md }}>
          <Text variant="heading">Where it went</Text>
          {data && <CategoryBreakdown items={data.spending_by_category} total={data.expense_cents} />}
        </Card>

        <Card style={{ gap: space.md }}>
          <Text variant="heading">Last 6 months</Text>
          {data && <TrendChart data={data.trend} />}
        </Card>

        <Card style={{ gap: space.xs }}>
          <Text variant="heading">Recent</Text>
          {data?.recent.length === 0 && <Text variant="caption">Nothing yet. Tap + to add your first transaction.</Text>}
          {data?.recent.map((tx) => (
            <TransactionRow
              key={tx.id}
              tx={tx}
              account={accountById.get(tx.account_id)}
              category={tx.category_id ? categoryById.get(tx.category_id) : undefined}
              onPress={() => router.push({ pathname: '/transaction-form', params: { id: tx.id } })}
            />
          ))}
        </Card>
      </Screen>
      <Fab onPress={() => router.push('/transaction-form')} />
    </>
  );
}

function Stat({ label, value, color }: { label: string; value?: number; color: string }) {
  return (
    <Card style={{ flex: 1, padding: space.md, gap: 4 }}>
      <Text variant="label">{label}</Text>
      <Text variant="amount" color={color} numberOfLines={1} style={{ fontSize: 16 }}>
        {value === undefined ? '—' : formatMoney(value, 'EUR', { compact: Math.abs(value) >= 100000 })}
      </Text>
    </Card>
  );
}
