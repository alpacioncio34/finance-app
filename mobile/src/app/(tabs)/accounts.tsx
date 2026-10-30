import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, RefreshControl, View } from 'react-native';

import { Card, Empty, ErrorBanner, Fab, Screen, Text } from '@/components/ui';
import { api, type Account } from '@/lib/api';
import { confirm } from '@/lib/confirm';
import { ACCOUNT_TYPES } from '@/lib/constants';
import { formatMoney } from '@/lib/format';
import { space, useTheme } from '@/lib/theme';
import { useQuery } from '@/lib/useQuery';

export default function Accounts() {
  const t = useTheme();
  const { data, error, loading, refetch } = useQuery(api.accounts);
  const total = data?.reduce((s, a) => s + a.balance_cents, 0) ?? 0;

  async function remove(a: Account) {
    if (await confirm(`Delete "${a.name}"?`, 'This also deletes all of its transactions.')) {
      await api.deleteAccount(a.id);
      refetch();
    }
  }

  return (
    <>
      <Screen refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={refetch} />}>
        {error && <ErrorBanner message={error} onRetry={refetch} />}
        <View style={{ gap: space.xs }}>
          <Text variant="label">Net worth</Text>
          <Text variant="title" color={total < 0 ? t.expense : t.text}>{formatMoney(total)}</Text>
        </View>

        {data?.length === 0 && <Empty icon="wallet-outline" title="No accounts yet" hint="Add your bank account, savings and cash to start tracking." />}

        <Card style={{ paddingVertical: space.xs }}>
          {data?.map((a, i) => {
            const type = ACCOUNT_TYPES.find((x) => x.value === a.type);
            return (
              <Pressable key={a.id} onLongPress={() => remove(a)} delayLongPress={400}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: space.md,
                    paddingVertical: space.md,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: t.border,
                  }}>
                  <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: t.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={type?.icon ?? 'wallet'} size={20} color={t.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text variant="heading">{a.name}</Text>
                    <Text variant="caption">{type?.label}{a.external_id ? ' · synced' : ' · manual'}</Text>
                  </View>
                  <Text variant="amount" color={a.balance_cents < 0 ? t.expense : t.text}>
                    {formatMoney(a.balance_cents, a.currency)}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </Card>
        {!!data?.length && <Text variant="caption" style={{ textAlign: 'center' }}>Long-press an account to delete it.</Text>}

        <Card style={{ flexDirection: 'row', gap: space.md, alignItems: 'center', backgroundColor: t.accentSoft, borderColor: t.accentSoft }}>
          <Ionicons name="link-outline" size={22} color={t.accent} />
          <View style={{ flex: 1 }}>
            <Text variant="heading" color={t.accent}>Bank sync</Text>
            <Text variant="caption">Coming later: connect your bank via Open Banking (PSD2) to import transactions automatically.</Text>
          </View>
        </Card>
      </Screen>
      <Fab onPress={() => router.push('/account-form')} />
    </>
  );
}
