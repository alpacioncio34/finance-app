import { router } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, View } from 'react-native';

import { CategoryBreakdown, TrendChart } from '@/components/charts';
import { TransactionRow } from '@/components/TransactionRow';
import { Button, Card, Empty, ErrorBanner, Fab, IconButton, MonthSwitcher, Panel, PanelBar, RowGroup, Screen, Section, Text } from '@/components/ui';
import { db } from '@/lib/db';
import { currentMonth, formatMoney, monthLabel } from '@/lib/format';
import { useLookups } from '@/lib/lookups';
import { space, useTheme } from '@/lib/theme';
import { useQuery } from '@/lib/useQuery';

export default function Overview() {
  const t = useTheme();
  const [month, setMonth] = useState(currentMonth());
  const { data, error, loading, refetch } = useQuery(() => db.dashboard(month), [month]);
  const { accounts, accountById, categoryById, loading: lookupsLoading } = useLookups();

  const income = data?.income_cents ?? 0;
  const spent = data?.expense_cents ?? 0;
  const net = income - spent;
  const noAccounts = !lookupsLoading && accounts.length === 0;

  return (
    <>
      <Screen
        title="Overview"
        action={<IconButton icon="settings-outline" label="Settings" onPress={() => router.push('/settings')} />}
        refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={refetch} />}>
        {error && <ErrorBanner message={error} onRetry={refetch} />}

        {noAccounts ? (
          <Empty icon="wallet-outline" title="Start with an account" hint="Add an account, such as your wallet or current account, then record your transactions. Everything is saved on this phone.">
            <Button title="Add an account" icon="create-outline" onPress={() => router.push('/account-form')} />
          </Empty>
        ) : (
          <>
            <Panel>
              <View>
                <Text variant="label" color={t.onPanelMuted}>Total balance</Text>
                <Text variant="display" numberOfLines={1} adjustsFontSizeToFit color={t.onPanel}>
                  {data ? formatMoney(data.total_balance_cents) : ' '}
                </Text>
              </View>
              <View style={{ gap: space.sm }}>
                <PanelBar used={spent} total={income} label={`Spent ${formatMoney(spent)} of ${formatMoney(income)} income`} />
                <Text variant="caption" color={t.onPanelMuted}>
                  {!data
                    ? ' '
                    : income === 0 && spent === 0
                      ? `Nothing recorded in ${monthLabel(month)}`
                      : net >= 0
                        ? `${formatMoney(net)} of this month's income is left`
                        : `Spent ${formatMoney(-net)} more than came in`}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: space.xl }}>
                <Stat label="Came in" value={data ? formatMoney(income) : ' '} />
                <Stat label="Went out" value={data ? formatMoney(spent) : ' '} />
              </View>
            </Panel>

            <MonthSwitcher month={month} onChange={setMonth} />

            <Section title="Where it went">
              <Card>{data && <CategoryBreakdown items={data.spending_by_category} total={data.expense_cents} />}</Card>
            </Section>

            <Section title="Six months">
              <Card>{data && <TrendChart data={data.trend} />}</Card>
            </Section>

            <Section title="Latest" action={<Button title="See all" variant="ghost" size="small" onPress={() => router.push('/transactions')} />}>
              {data?.recent.length === 0 ? (
                <Text variant="caption">Nothing yet. Tap + to add your first transaction.</Text>
              ) : (
                <RowGroup>
                  {data?.recent.map((tx) => (
                    <TransactionRow
                      key={tx.id}
                      tx={tx}
                      showDate={tx.date.slice(5).split('-').reverse().join('/')}
                      account={accountById.get(tx.account_id)}
                      category={tx.category_id ? categoryById.get(tx.category_id) : undefined}
                      onPress={() => router.push({ pathname: '/transaction-form', params: { id: tx.id } })}
                    />
                  ))}
                </RowGroup>
              )}
            </Section>
          </>
        )}
      </Screen>
      {!noAccounts && <Fab label="Add transaction" onPress={() => router.push('/transaction-form')} />}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <Text variant="caption" color={t.onPanelMuted}>{label}</Text>
      <Text variant="amount" color={t.onPanel} numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 18 }}>{value}</Text>
    </View>
  );
}
