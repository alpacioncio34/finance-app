import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, RefreshControl, View } from 'react-native';

import { Card, Empty, ErrorBanner, Fab, HeroCard, IconTile, Screen, Text } from '@/components/ui';
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
      <Screen title="Accounts" refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={refetch} />}>
        {error && <ErrorBanner message={error} onRetry={refetch} />}
        <HeroCard>
          <View style={{ gap: space.xs }}>
            <Text variant="label" color={t.onHero} style={{ opacity: 0.8 }}>Net worth</Text>
            <Text variant="title" numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 46, lineHeight: 52, letterSpacing: -1.5 }} color={t.onHero}>{formatMoney(total)}</Text>
            <Text variant="caption" color={t.onHero} style={{ opacity: 0.85 }}>{data?.length ?? 0} account{data?.length === 1 ? '' : 's'}</Text>
          </View>
        </HeroCard>

        {data?.length === 0 && <Empty icon="wallet-outline" title="No accounts yet" hint="Add your bank account, savings and cash to start tracking." />}

        <View style={{ gap: space.md }}>
          {data?.map((a) => {
            const type = ACCOUNT_TYPES.find((x) => x.value === a.type);
            return (
              <Pressable key={a.id} accessibilityHint="Long-press to delete" onLongPress={() => remove(a)} delayLongPress={400}>
                <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                  <IconTile icon={type?.icon ?? 'wallet'} color={t.accent} size={48} />
                  <View style={{ flex: 1 }}>
                    <Text variant="heading">{a.name}</Text>
                    <Text variant="caption">{type?.label}, {a.external_id ? 'synced' : 'added by hand'}</Text>
                  </View>
                  <Text variant="amount" color={a.balance_cents < 0 ? t.expense : t.text} style={{ fontSize: 18 }}>
                    {formatMoney(a.balance_cents, a.currency)}
                  </Text>
                </Card>
              </Pressable>
            );
          })}
        </View>
        {!!data?.length && <Text variant="caption">Long-press an account to delete it.</Text>}

        <Card style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start', backgroundColor: t.accentSoft, borderColor: t.accentSoft }}>
          <Ionicons name="link-outline" size={22} color={t.accent} />
          <View style={{ flex: 1 }}>
            <Text variant="heading" color={t.accent}>Bank sync</Text>
            <Text variant="caption">Not available yet. Soon you'll be able to connect your bank and import transactions automatically.</Text>
          </View>
        </Card>
      </Screen>
      <Fab onPress={() => router.push('/account-form')} />
    </>
  );
}
