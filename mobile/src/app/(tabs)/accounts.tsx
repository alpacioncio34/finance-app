import { router } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, View } from 'react-native';

import { Badge, Button, Empty, ErrorBanner, IconTile, Notice, Panel, Row, RowGroup, Screen, Section, Text } from '@/components/ui';
import { api, type Account, type BankConnection } from '@/lib/api';
import { confirm } from '@/lib/confirm';
import { ACCOUNT_TYPES } from '@/lib/constants';
import { formatMoney, timeAgo } from '@/lib/format';
import { space, useTheme } from '@/lib/theme';
import { useQuery } from '@/lib/useQuery';

export default function Accounts() {
  const t = useTheme();
  const { data, error, loading, refetch } = useQuery(() => Promise.all([api.accounts(), api.bankConnections()]));
  const [accounts, connections] = data ?? [[], []];
  // Which connection is syncing or disconnecting right now, and the last message about a connection
  const [busy, setBusy] = useState<number | null>(null);
  const [message, setMessage] = useState<{ id: number; text: string; failed: boolean } | null>(null);

  const total = accounts.reduce((s, a) => s + a.balance_cents, 0);
  const manual = accounts.filter((a) => a.source === 'manual');
  const fromBank = accounts.length - manual.length;

  async function run(conn: BankConnection, action: () => Promise<string>) {
    setBusy(conn.id);
    setMessage(null);
    try {
      setMessage({ id: conn.id, text: await action(), failed: false });
    } catch (e) {
      setMessage({ id: conn.id, text: e instanceof Error ? e.message : String(e), failed: true });
    } finally {
      setBusy(null);
      refetch();
    }
  }

  const sync = (conn: BankConnection) =>
    run(conn, async () => {
      const { imported } = await api.syncBankConnection(conn.id);
      return imported === 0 ? 'Already up to date.' : `${imported} new transaction${imported === 1 ? '' : 's'}.`;
    });

  async function disconnect(conn: BankConnection) {
    const name = conn.institution_name;
    if (!(await confirm(`Disconnect ${name}?`, 'Its accounts stay here with everything imported so far. They stop updating, and you can add to them by hand.', 'Disconnect'))) return;
    await run(conn, async () => {
      await api.disconnectBank(conn.id);
      return `${name} disconnected.`;
    });
  }

  const accountRow = (a: Account) => {
    const type = ACCOUNT_TYPES.find((x) => x.value === a.type);
    const bank = a.source === 'bank';
    return (
      <Row
        key={a.id}
        chevron
        onPress={() => router.push({ pathname: '/account-form', params: { id: a.id } })}
        leading={<IconTile icon={type?.icon ?? 'wallet'} color={bank ? t.bank : t.accent} background={bank ? t.bankSoft : t.accentSoft} />}
        title={a.name}
        subtitle={type?.label}
        trailing={<Text variant="amount" color={a.balance_cents < 0 ? t.expense : t.text}>{formatMoney(a.balance_cents, a.currency)}</Text>}
      />
    );
  };

  return (
    <Screen title="Accounts" refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={refetch} />}>
      {error && <ErrorBanner message={error} onRetry={refetch} />}

      {data && accounts.length === 0 ? (
        <Empty icon="wallet-outline" title="No accounts yet" hint="There are two kinds. A connected bank account fills itself in and is read-only. A manual account is one you keep by hand, like cash.">
          <Button title="Connect a bank" variant="bank" icon="link" onPress={() => router.push('/connect-bank')} />
          <Button title="Add an account by hand" variant="secondary" icon="create-outline" onPress={() => router.push('/account-form')} />
        </Empty>
      ) : (
        <Panel>
          <View>
            <Text variant="label" color={t.onPanelMuted}>Net worth</Text>
            <Text variant="display" numberOfLines={1} adjustsFontSizeToFit color={t.onPanel}>{data ? formatMoney(total) : ' '}</Text>
          </View>
          <Text variant="caption" color={t.onPanelMuted}>
            {data ? `${fromBank} from a bank, ${manual.length} kept by hand` : ' '}
          </Text>
        </Panel>
      )}

      {/* A message about a bank that is no longer listed (just disconnected) */}
      {message && !connections.some((c) => c.id === message.id) && (
        <Notice tone={message.failed ? 'danger' : 'neutral'} icon={message.failed ? 'alert-circle' : 'checkmark-circle'}>{message.text}</Notice>
      )}

      {connections.length > 0 && (
        <Section title="From your bank" action={<Button title="Connect another" variant="ghost" size="small" icon="add" onPress={() => router.push('/connect-bank')} />}>
          {connections.map((conn) => {
            const linked = conn.status === 'linked';
            const note = message?.id === conn.id ? message : null;
            return (
              <RowGroup key={conn.id}>
                <Row
                  leading={<IconTile icon="business" color={t.bank} background={t.bankSoft} />}
                  title={conn.institution_name}
                  subtitle={
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
                      {linked ? <Badge label="Read-only" tone="bank" icon="link" /> : <Badge label="Needs reconnecting" tone="warn" icon="warning" />}
                      <Text variant="caption">{conn.last_synced_at ? `Updated ${timeAgo(conn.last_synced_at)}` : 'Not updated yet'}</Text>
                    </View>
                  }
                />
                {accounts.filter((a) => a.connection_id === conn.id).map(accountRow)}
                <View style={{ padding: space.md, paddingHorizontal: space.lg, gap: space.sm }}>
                  {note && <Text variant="caption" color={note.failed ? t.expense : t.muted}>{note.text}</Text>}
                  <View style={{ flexDirection: 'row', gap: space.sm }}>
                    {linked ? (
                      <Button title="Update now" variant="secondary" size="small" icon="refresh" loading={busy === conn.id} onPress={() => sync(conn)} />
                    ) : (
                      <Button title="Reconnect" variant="bank" size="small" icon="link" onPress={() => router.push('/connect-bank')} />
                    )}
                    <Button title="Disconnect" variant="ghost" size="small" disabled={busy === conn.id} onPress={() => disconnect(conn)} />
                  </View>
                </View>
              </RowGroup>
            );
          })}
        </Section>
      )}

      {manual.length > 0 && (
        <Section title="Kept by hand" action={<Button title="Add" variant="ghost" size="small" icon="add" onPress={() => router.push('/account-form')} />}>
          <RowGroup>{manual.map(accountRow)}</RowGroup>
        </Section>
      )}

      {accounts.length > 0 && connections.length === 0 && (
        <Notice tone="bank" icon="link" title="Connect a bank" action={<Button title="Choose a bank" variant="bank" size="small" onPress={() => router.push('/connect-bank')} />}>
          Bring in balances and transactions automatically. Access is read-only: the app can never move money.
        </Notice>
      )}
      {accounts.length > 0 && manual.length === 0 && (
        <Button title="Add an account by hand" variant="secondary" icon="create-outline" onPress={() => router.push('/account-form')} />
      )}
    </Screen>
  );
}
