import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, View } from 'react-native';

import { CategoryBreakdown, TrendChart } from '@/components/charts';
import { TransactionRow } from '@/components/TransactionRow';
import { Card, ErrorBanner, Fab, HeroCard, MonthSwitcher, Screen, Text, type IconName } from '@/components/ui';
import { api } from '@/lib/api';
import { currentMonth, formatMoney } from '@/lib/format';
import { useLookups } from '@/lib/lookups';
import { font, space, useTheme } from '@/lib/theme';
import { useQuery } from '@/lib/useQuery';

export default function Overview() {
  const t = useTheme();
  const [month, setMonth] = useState(currentMonth());
  const { data, error, loading, refetch } = useQuery(() => api.dashboard(month), [month]);
  const { accountById, categoryById } = useLookups();

  const net = data?.net_cents ?? 0;

  return (
    <>
      <Screen inset refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={refetch} />}>
        {error && <ErrorBanner message={error} onRetry={refetch} />}

        <MonthSwitcher month={month} onChange={setMonth} />

        <HeroCard>
          <View style={{ gap: space.xs }}>
            <Text variant="label" color={t.onHero} style={{ opacity: 0.8 }}>Total balance</Text>
            <Text
              variant="title"
              numberOfLines={1}
              adjustsFontSizeToFit
              style={{ fontFamily: font.displayHeavy, fontSize: 52, lineHeight: 58, letterSpacing: -2, fontVariant: ['tabular-nums'] }}
              color={t.onHero}>
              {data ? formatMoney(data.total_balance_cents) : '—'}
            </Text>
            {data && (
              <Text variant="caption" color={t.onHero} style={{ opacity: 0.85 }}>
                {net >= 0 ? `You kept ${formatMoney(net)} this month` : `${formatMoney(-net)} more spent than earned this month`}
              </Text>
            )}
          </View>
          <View style={{ flexDirection: 'row', gap: space.md }}>
            <Flow label="Income" icon="arrow-down" value={data?.income_cents} />
            <Flow label="Spent" icon="arrow-up" value={data?.expense_cents} />
          </View>
        </HeroCard>

        <Card style={{ gap: space.lg }}>
          <Text variant="heading">Where it went</Text>
          {data && <CategoryBreakdown items={data.spending_by_category} total={data.expense_cents} />}
        </Card>

        <Card style={{ gap: space.lg }}>
          <Text variant="heading">Last 6 months</Text>
          {data && <TrendChart data={data.trend} />}
        </Card>

        <Card>
          <Text variant="heading">Recent</Text>
          {data?.recent.length === 0 && <Text variant="caption" style={{ marginTop: space.sm }}>Nothing yet. Tap + to add your first transaction.</Text>}
          {data?.recent.map((tx, i) => (
            <View key={tx.id} style={{ borderTopWidth: i === 0 ? 0 : 1, borderTopColor: t.border }}>
              <TransactionRow
                tx={tx}
                showDate={tx.date.slice(5).split('-').reverse().join('/')}
                account={accountById.get(tx.account_id)}
                category={tx.category_id ? categoryById.get(tx.category_id) : undefined}
                onPress={() => router.push({ pathname: '/transaction-form', params: { id: tx.id } })}
              />
            </View>
          ))}
        </Card>
      </Screen>
      <Fab onPress={() => router.push('/transaction-form')} />
    </>
  );
}

function Flow({ label, icon, value }: { label: string; icon: IconName; value?: number }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 20, padding: space.md }}>
      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={16} color={t.onHero} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="caption" color={t.onHero} style={{ opacity: 0.8 }}>{label}</Text>
        <Text variant="amount" color={t.onHero} numberOfLines={1}>
          {value === undefined ? '—' : formatMoney(value, 'EUR', { compact: Math.abs(value) >= 100000 })}
        </Text>
      </View>
    </View>
  );
}
