import { Pressable, View } from 'react-native';

import { IconTile, Text } from '@/components/ui';
import type { Account, Category, Transaction } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import { space, useTheme } from '@/lib/theme';

export function TransactionRow({
  tx,
  category,
  account,
  onPress,
  showDate,
}: {
  tx: Transaction;
  category?: Category;
  account?: Account;
  onPress?: () => void;
  /** Show the date in the subtitle (hidden where rows are already grouped by day). */
  showDate?: string;
}) {
  const t = useTheme();
  const color = category?.color ?? t.muted;
  const isIncome = tx.kind === 'income';
  const meta = [showDate, category?.name, account?.name].filter(Boolean).join(', ');
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md }}>
        <IconTile icon={category?.icon} color={color} label={category?.name} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text numberOfLines={1}>{tx.description || category?.name || 'Transaction'}</Text>
          {!!meta && <Text variant="caption" numberOfLines={1}>{meta}</Text>}
        </View>
        <Text variant="amount" color={isIncome ? t.income : t.text}>
          {formatMoney(isIncome ? tx.amount_cents : -tx.amount_cents, account?.currency, { signed: true })}
        </Text>
      </View>
    </Pressable>
  );
}
