/**
 * Dependency-free charts built from plain Views. Good enough for an MVP;
 * swap for victory-native or react-native-gifted-charts later if you need more.
 */
import { View } from 'react-native';

import { Text } from '@/components/ui';
import { formatMoney, monthLabel } from '@/lib/format';
import { space, useTheme } from '@/lib/theme';

export function CategoryBreakdown({
  items,
  total,
}: {
  items: { name: string; color: string; amount_cents: number }[];
  total: number;
}) {
  const t = useTheme();
  if (total <= 0) return <Text variant="caption">No spending this month yet.</Text>;

  return (
    <View style={{ gap: space.lg }}>
      {/* One bar, full width: each category's share of the month */}
      <View style={{ flexDirection: 'row', height: 22, borderRadius: 6, overflow: 'hidden', backgroundColor: t.track, gap: 2 }}>
        {items.map((i) => (
          <View key={i.name} accessibilityLabel={`${i.name} ${formatMoney(i.amount_cents)}`} style={{ flex: i.amount_cents, backgroundColor: i.color }} />
        ))}
      </View>
      <View style={{ gap: space.md }}>
        {items.map((i) => {
          const pct = Math.round((i.amount_cents / total) * 100);
          return (
            <View key={i.name} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: i.color }} />
              <Text style={{ flex: 1 }} numberOfLines={1}>{i.name}</Text>
              <Text variant="caption" style={{ width: 36, textAlign: 'right' }}>{pct}%</Text>
              <Text variant="amount" style={{ minWidth: 88, textAlign: 'right' }}>{formatMoney(i.amount_cents)}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export function TrendChart({
  data,
  height = 130,
}: {
  data: { month: string; income_cents: number; expense_cents: number }[];
  height?: number;
}) {
  const t = useTheme();
  const max = Math.max(1, ...data.flatMap((d) => [d.income_cents, d.expense_cents]));

  return (
    <View style={{ gap: space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height, gap: space.sm, borderBottomWidth: 1, borderBottomColor: t.border }}>
        {data.map((d) => (
          <View key={d.month} style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 3, height: '100%' }}>
            <View
              accessibilityLabel={`${monthLabel(d.month)} income ${formatMoney(d.income_cents)}`}
              style={{ width: '38%', maxWidth: 20, height: `${(d.income_cents / max) * 100}%`, minHeight: 2, backgroundColor: t.income, borderTopLeftRadius: 3, borderTopRightRadius: 3 }}
            />
            <View
              accessibilityLabel={`${monthLabel(d.month)} expenses ${formatMoney(d.expense_cents)}`}
              style={{ width: '38%', maxWidth: 20, height: `${(d.expense_cents / max) * 100}%`, minHeight: 2, backgroundColor: t.expense, borderTopLeftRadius: 3, borderTopRightRadius: 3 }}
            />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        {data.map((d) => (
          <Text key={d.month} variant="caption" style={{ flex: 1, textAlign: 'center' }}>
            {monthLabel(d.month, 'short')}
          </Text>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: space.lg }}>
        <Legend color={t.income} label="Income" />
        <Legend color={t.expense} label="Spent" />
      </View>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: color }} />
      <Text variant="caption">{label}</Text>
    </View>
  );
}
