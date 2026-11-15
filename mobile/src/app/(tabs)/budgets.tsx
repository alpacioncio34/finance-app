import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, View } from 'react-native';

import { Button, Card, Empty, ErrorBanner, Fab, IconTile, MonthSwitcher, Panel, PanelBar, ProgressBar, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { currentMonth, formatMoney, monthLabel, shiftMonth } from '@/lib/format';
import { space, useTheme } from '@/lib/theme';
import { useQuery } from '@/lib/useQuery';

export default function Budgets() {
  const t = useTheme();
  const [month, setMonth] = useState(currentMonth());
  const { data, error, loading, refetch } = useQuery(() => api.budgets(month), [month]);
  const [copying, setCopying] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  const totalLimit = data?.reduce((s, b) => s + b.limit_cents, 0) ?? 0;
  const totalSpent = data?.reduce((s, b) => s + b.spent_cents, 0) ?? 0;
  const prev = shiftMonth(month, -1);

  async function copyFromPrevious() {
    setCopying(true);
    setCopyError(null);
    try {
      const copied = await api.copyBudgets(prev, month);
      if (copied.length === 0) setCopyError(`There are no budgets in ${monthLabel(prev)} to copy.`);
      await refetch();
    } catch (e) {
      setCopyError(e instanceof Error ? e.message : String(e));
    } finally {
      setCopying(false);
    }
  }

  return (
    <>
      <Screen title="Budgets" refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={refetch} />}>
        {error && <ErrorBanner message={error} onRetry={refetch} />}

        {data && data.length > 0 && (
          <Panel>
            <View>
              <Text variant="label" color={t.onPanelMuted}>
                {totalSpent <= totalLimit ? 'Left to spend' : 'Over budget by'}
              </Text>
              <Text variant="display" numberOfLines={1} adjustsFontSizeToFit color={totalSpent <= totalLimit ? t.onPanel : t.panelWarn}>
                {formatMoney(Math.abs(totalLimit - totalSpent))}
              </Text>
            </View>
            <View style={{ gap: space.sm }}>
              <PanelBar used={totalSpent} total={totalLimit} label={`Spent ${formatMoney(totalSpent)} of ${formatMoney(totalLimit)}`} />
              <Text variant="caption" color={t.onPanelMuted}>
                {formatMoney(totalSpent)} spent of {formatMoney(totalLimit)} budgeted
              </Text>
            </View>
          </Panel>
        )}

        <MonthSwitcher month={month} onChange={setMonth} />

        {data?.length === 0 && (
          <Empty icon="speedometer-outline" title={`No budgets for ${monthLabel(month)}`} hint="Set a monthly limit per category and see how close you are to it.">
            <Button title="Set a budget" icon="add" onPress={() => router.push({ pathname: '/budget-form', params: { month } })} />
            <Button title={`Copy from ${monthLabel(prev)}`} variant="secondary" icon="copy-outline" onPress={copyFromPrevious} loading={copying} />
            {copyError && <Text variant="caption" color={t.expense}>{copyError}</Text>}
          </Empty>
        )}

        <View style={{ gap: space.md }}>
          {data?.map((b) => {
            const pct = b.limit_cents ? b.spent_cents / b.limit_cents : 0;
            const barColor = pct > 1 ? t.expense : pct > 0.85 ? t.warn : b.category_color;
            return (
              <Pressable
                key={b.id}
                accessibilityRole="button"
                accessibilityLabel={`${b.category_name}, ${Math.round(pct * 100)} percent used`}
                onPress={() => router.push({ pathname: '/budget-form', params: { month, category_id: b.category_id, id: b.id, limit: b.limit_cents } })}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                <Card style={{ gap: space.md }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                    <IconTile color={b.category_color} label={b.category_name} size={38} />
                    <Text variant="heading" style={{ flex: 1 }} numberOfLines={1}>{b.category_name}</Text>
                    <Text variant="amount" color={pct > 1 ? t.expense : t.text}>
                      {pct > 1 ? `${formatMoney(b.spent_cents - b.limit_cents)} over` : `${formatMoney(b.limit_cents - b.spent_cents)} left`}
                    </Text>
                  </View>
                  <ProgressBar value={b.spent_cents} max={b.limit_cents} color={barColor} />
                  <Text variant="caption">
                    {formatMoney(b.spent_cents)} of {formatMoney(b.limit_cents)}
                  </Text>
                </Card>
              </Pressable>
            );
          })}
        </View>
      </Screen>
      {!!data?.length && <Fab label="Set a budget" onPress={() => router.push({ pathname: '/budget-form', params: { month } })} />}
    </>
  );
}
