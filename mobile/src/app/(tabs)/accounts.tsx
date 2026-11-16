import { router } from 'expo-router';
import { RefreshControl, View } from 'react-native';

import { Button, Empty, ErrorBanner, IconTile, Panel, Row, RowGroup, Screen, Section, Text } from '@/components/ui';
import { db } from '@/lib/db';
import { ACCOUNT_TYPES } from '@/lib/constants';
import { formatMoney } from '@/lib/format';
import { useTheme } from '@/lib/theme';
import type { AccountView } from '@/lib/types';
import { useQuery } from '@/lib/useQuery';

export default function Accounts() {
  const t = useTheme();
  const { data: accounts, error, loading, refetch } = useQuery(() => db.accounts());
  const total = accounts?.reduce((s, a) => s + a.balance_cents, 0) ?? 0;

  const accountRow = (a: AccountView) => {
    const type = ACCOUNT_TYPES.find((x) => x.value === a.type);
    return (
      <Row
        key={a.id}
        chevron
        onPress={() => router.push({ pathname: '/account-form', params: { id: a.id } })}
        leading={<IconTile icon={type?.icon ?? 'wallet'} color={t.accent} background={t.accentSoft} />}
        title={a.name}
        subtitle={type?.label}
        trailing={<Text variant="amount" color={a.balance_cents < 0 ? t.expense : t.text}>{formatMoney(a.balance_cents, a.currency)}</Text>}
      />
    );
  };

  return (
    <Screen
      title="Accounts"
      action={<Button title="Add" variant="ghost" size="small" icon="add" onPress={() => router.push('/account-form')} />}
      refreshControl={<RefreshControl refreshing={loading && !!accounts} onRefresh={refetch} />}>
      {error && <ErrorBanner message={error} onRetry={refetch} />}

      {accounts && accounts.length === 0 ? (
        <Empty icon="wallet-outline" title="No accounts yet" hint="An account is anywhere you keep money: a current account, savings, your wallet or a credit card.">
          <Button title="Add an account" icon="create-outline" onPress={() => router.push('/account-form')} />
        </Empty>
      ) : (
        <>
          <Panel>
            <View>
              <Text variant="label" color={t.onPanelMuted}>Net worth</Text>
              <Text variant="display" numberOfLines={1} adjustsFontSizeToFit color={t.onPanel}>{accounts ? formatMoney(total) : ' '}</Text>
            </View>
            <Text variant="caption" color={t.onPanelMuted}>
              {accounts ? `${accounts.length} account${accounts.length === 1 ? '' : 's'} on this phone` : ' '}
            </Text>
          </Panel>

          {accounts && accounts.length > 0 && (
            <Section title="Your accounts">
              <RowGroup>{accounts.map(accountRow)}</RowGroup>
            </Section>
          )}
        </>
      )}
    </Screen>
  );
}
