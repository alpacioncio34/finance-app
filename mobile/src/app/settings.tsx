import { useState } from 'react';

import { Button, Card, IconTile, Row, RowGroup, Screen, Text } from '@/components/ui';
import { API_URL } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { confirm } from '@/lib/confirm';
import { space, useTheme } from '@/lib/theme';

export default function Settings() {
  const t = useTheme();
  const { user, signOut } = useAuth();
  const [busy, setBusy] = useState(false);

  async function leave() {
    if (!(await confirm('Sign out?', 'Your data stays on the server. You can sign back in at any time.', 'Sign out'))) return;
    setBusy(true);
    // The root layout shows the sign-in screen as soon as the session ends
    await signOut();
  }

  return (
    <Screen>
      <RowGroup>
        <Row
          leading={<IconTile color={t.accent} background={t.accentSoft} label={user?.email} />}
          title={user?.email ?? ''}
          subtitle="Signed in"
        />
      </RowGroup>

      <Card style={{ gap: space.xs }}>
        <Text variant="label">Server</Text>
        <Text>{API_URL}</Text>
        <Text variant="caption">Set EXPO_PUBLIC_API_URL to point the app at another backend.</Text>
      </Card>

      <Button title="Sign out" variant="danger" icon="log-out-outline" onPress={leave} loading={busy} />
    </Screen>
  );
}
