import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { Button, Card, Notice, Screen, Text } from '@/components/ui';
import { db } from '@/lib/db';
import { confirm } from '@/lib/confirm';
import { space } from '@/lib/theme';

export default function Settings() {
  const [stats, setStats] = useState<{ accounts: number; transactions: number; budgets: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    db.stats().then(setStats).catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  async function eraseAll() {
    if (!(await confirm('Erase all data?', 'Every account, transaction and budget on this device is deleted. This cannot be undone.', 'Erase everything'))) return;
    setBusy(true);
    try {
      await db.eraseAll();
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Card style={{ gap: space.xs }}>
        <Text variant="label">Stored on this device</Text>
        <Text>
          {stats
            ? `${stats.accounts} account${stats.accounts === 1 ? '' : 's'}, ${stats.transactions} transaction${stats.transactions === 1 ? '' : 's'}, ${stats.budgets} budget${stats.budgets === 1 ? '' : 's'}`
            : ' '}
        </Text>
        <Text variant="caption">
          {Platform.OS === 'web'
            ? 'In this browser only. Clearing site data for this page deletes it.'
            : 'Nothing is sent anywhere. Uninstalling the app deletes it.'}
        </Text>
      </Card>

      {error && <Notice tone="danger" icon="alert-circle">{error}</Notice>}

      <Button title="Erase all data" variant="danger" icon="trash-outline" onPress={eraseAll} loading={busy} />
    </Screen>
  );
}
