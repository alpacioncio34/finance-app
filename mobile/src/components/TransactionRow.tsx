import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { Text, type IconName } from '@/components/ui';
import type { Account, Category, Transaction } from '@/lib/api';
import { dayLabel, formatMoney } from '@/lib/format';
import { space, useTheme } from '@/lib/theme';

export function TransactionRow({
  tx,
  category,
  account,
  onPress,
}: {
  tx: Transaction;
  category?: Category;
  account?: Account;
  onPress?: () => void;
}) {
  const t = useTheme();
  const color = category?.color ?? t.muted;
  const isIncome = tx.kind === 'income';
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm }}>
        <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: color + '22', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={(category?.icon as IconName) ?? 'pricetag'} size={18} color={color} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text numberOfLines={1}>{tx.description || category?.name || 'Transaction'}</Text>
          <Text variant="caption" numberOfLines={1}>
            {dayLabel(tx.date)}
            {category ? ` · ${category.name}` : ''}
            {account ? ` · ${account.name}` : ''}
          </Text>
        </View>
        <Text variant="amount" color={isIncome ? t.income : t.text}>
          {formatMoney(isIncome ? tx.amount_cents : -tx.amount_cents, account?.currency, { signed: true })}
        </Text>
      </View>
    </Pressable>
  );
}
