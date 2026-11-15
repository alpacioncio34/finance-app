import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { IconTile, Row, Text } from '@/components/ui';
import type { Account, Category, Transaction } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import { useTheme } from '@/lib/theme';

/** One transaction as a line of a RowGroup. */
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
  const isIncome = tx.kind === 'income';
  const fromBank = tx.external_id !== null;
  const meta = [showDate, category?.name ?? 'No category', account?.name].filter(Boolean).join(', ');
  const amount = formatMoney(isIncome ? tx.amount_cents : -tx.amount_cents, account?.currency, { signed: true });
  return (
    <Row
      onPress={onPress}
      accessibilityLabel={`${tx.description || category?.name || 'Transaction'}, ${amount}${fromBank ? ', from your bank' : ''}`}
      leading={<IconTile icon={category?.icon ?? 'help'} color={category?.color ?? t.muted} />}
      title={tx.description || category?.name || 'Transaction'}
      subtitle={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          {fromBank && <Ionicons name="link" size={12} color={t.bank} />}
          <Text variant="caption" numberOfLines={1} style={{ flexShrink: 1 }}>{meta}</Text>
        </View>
      }
      trailing={<Text variant="amount" color={isIncome ? t.income : t.text}>{amount}</Text>}
    />
  );
}
