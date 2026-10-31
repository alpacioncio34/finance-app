import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, View } from 'react-native';

import { Button, Card, Empty, ErrorBanner, Fab, HeroCard, IconTile, MonthSwitcher, ProgressBar, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { currentMonth, formatMoney, monthLabel, shiftMonth } from '@/lib/format';
import { space, useTheme } from '@/lib/theme';
import { useQuery } from '@/lib/useQuery';

export default function Budgets() {
  const t = useTheme();
  const [month, setMonth] = useState(currentMonth());
  const { data, error, loading, refetch } = useQuery(() => api.budgets(month), [month]);
  const [copying, setCopying] = useState(false);

  const totalLimit = data?.reduce((s, b) => s + b.limit_cents, 0) ?? 0;
  const totalSpent = data?.reduce((s, b) => s + b.spent_cents, 0) ?? 0;
  const prev = shiftMonth(month, -1);

  async function copyFromPrevious() {
    setCopying(true);
    try {
      await api.copyBudgets(prev, month);
      await refetch();
    } finally {
      setCopying(false);
    }
  }

  return (
    <>
      <Screen title="Budgets" refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={refetch} />}>
        <MonthSwitcher month={month} onChange={setMonth} />
        {error && <ErrorBanner message={error} onRetry={refetch} />}

        {data && data.length > 0 && (
          <HeroCard style={{ gap: space.sm }}>
            <Text variant="label" color={t.onHero} style={{ opacity: 0.8 }}>Spent so far</Text>
            <Text variant="title" color={t.onHero} style={{ fontSize: 36, lineHeight: 42 }}>
              {formatMoney(totalSpent)} <Text variant="body" color={t.onHero} style={{ opacity: 0.8 }}>of {formatMoney(totalLimit)}</Text>
            </Text>
            <View style={{ height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' }}>
              <View style={{ width: `${Math.min(totalLimit ? (totalSpent / totalLimit) * 100 : 0, 100)}%`, height: '100%', backgroundColor: totalSpent > totalLimit ? '#FFB4A2' : '#FFFFFF' }} />
            </View>
            <Text variant="caption" color={t.onHero} style={{ opacity: 0.9 }}>
              {totalSpent <= totalLimit
                ? `${formatMoney(totalLimit - totalSpent)} left`
                : `${formatMoney(totalSpent - totalLimit)} over budget`}
            </Text>
          </HeroCard>
        )}

        {data?.length === 0 && (
          <Card style={{ gap: space.md }}>
            <Empty icon="speedometer-outline" title="No budgets for this month" hint="Set a monthly limit per category and track how close you are." />
            <Button title={`Copy from ${monthLabel(prev)}`} variant="secondary" icon="copy-outline" onPress={copyFromPrevious} loading={copying} />
          </Card>
        )}

        {data?.map((b) => {
          const pct = b.limit_cents ? b.spent_cents / b.limit_cents : 0;
          const barColor = pct > 1 ? t.expense : pct > 0.85 ? t.warn : b.category_color;
          return (
            <Pressable
              key={b.id}
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/budget-form', params: { month, category_id: b.category_id, id: b.id, limit: b.limit_cents } })}>
              <Card style={{ gap: space.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                  <IconTile color={b.category_color} label={b.category_name} size={38} />
                  <Text variant="heading" style={{ flex: 1 }}>{b.category_name}</Text>
                  <Text variant="amount" color={pct > 1 ? t.expense : t.text} style={{ fontSize: 15 }}>{Math.round(pct * 100)}%</Text>
                </View>
                <ProgressBar value={b.spent_cents} max={b.limit_cents} color={barColor} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text variant="caption">{formatMoney(b.spent_cents)} spent</Text>
                  <Text variant="caption" color={pct > 1 ? t.expense : t.muted}>
                    {pct > 1 ? `${formatMoney(b.spent_cents - b.limit_cents)} over` : `${formatMoney(b.limit_cents - b.spent_cents)} left of ${formatMoney(b.limit_cents)}`}
                  </Text>
                </View>
              </Card>
            </Pressable>
          );
        })}
      </Screen>
      <Fab onPress={() => router.push({ pathname: '/budget-form', params: { month } })} />
    </>
  );
}
