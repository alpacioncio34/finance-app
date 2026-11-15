import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Badge, Button, Card, ErrorBanner, IconTile, Loader, Notice, Row, RowGroup, Screen, Section, Text } from '@/components/ui';
import { api, ApiError, type BankLinkStart, type Institution } from '@/lib/api';
import { bankReturnUrl } from '@/lib/bankReturn';
import { space, useTheme } from '@/lib/theme';
import { useQuery } from '@/lib/useQuery';

/**
 * Connect a bank, in three steps:
 * 1. pick a bank           -> the API starts a link and returns the bank's approval page
 * 2. approve at the bank   -> opened in the system browser; this app never sees bank credentials
 * 3. finish                -> the API imports the accounts and recent transactions
 */
export default function ConnectBank() {
  const t = useTheme();
  const { data: banks, error: loadError, refetch } = useQuery(() => api.institutions());
  const [starting, setStarting] = useState<string | null>(null); // id of the bank being prepared
  const [link, setLink] = useState<BankLinkStart | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function choose(bank: Institution) {
    setError(null);
    setStarting(bank.id);
    try {
      setLink(await api.startBankConnection(bank.id, bankReturnUrl()));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setStarting(null);
    }
  }

  async function approve() {
    if (!link) return;
    setError(null);
    setWorking(true);
    try {
      // Opened straight from the button press: browsers block popups that open later than that.
      await WebBrowser.openAuthSessionAsync(link.auth_url, bankReturnUrl());
      // Whatever the browser reports, the API is the one that knows whether the bank approved.
      await api.completeBankConnection(link.connection.id);
      router.replace('/accounts');
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) setError("The bank didn't confirm access, so nothing was connected. You can try again.");
      else if (e instanceof ApiError && e.status === 404) {
        // Cancelled at the bank: the unfinished link is gone, so go back to the list
        setLink(null);
        setError('You cancelled at the bank. Nothing was connected.');
      } else setError(e instanceof Error ? e.message : String(e));
      setWorking(false);
    }
  }

  const sandbox = banks?.some((b) => b.provider === 'sandbox');

  if (link) {
    const name = link.connection.institution_name;
    return (
      <Screen
        footer={
          <>
            <Button title={working ? 'Waiting for the bank' : `Continue to ${name}`} variant="bank" icon="open-outline" onPress={approve} loading={working} />
            <Button title="Choose another bank" variant="ghost" onPress={() => setLink(null)} disabled={working} />
          </>
        }>
        <View style={{ gap: space.md }}>
          <IconTile icon="business" color={t.bank} background={t.bankSoft} size={52} />
          <Text variant="title">{name}</Text>
          <Text color={t.muted}>You&apos;ll approve access on the bank&apos;s own page, then come back here.</Text>
        </View>

        <RowGroup>
          <Row leading={<IconTile icon="eye-outline" color={t.bank} background={t.bankSoft} size={36} />} title="Can see" wrap subtitle="Your accounts, balances and transactions" />
          <Row leading={<IconTile icon="lock-closed-outline" color={t.accent} background={t.accentSoft} size={36} />} title="Can't do" wrap subtitle="Move money, make payments or see your bank password" />
        </RowGroup>

        <Text variant="caption">
          Connected accounts are read-only here. Their balance always matches the bank, and you can still set the category of each transaction.
        </Text>

        {error && <Notice tone="danger" icon="alert-circle">{error}</Notice>}
      </Screen>
    );
  }

  return (
    <Screen>
      {sandbox && (
        <Notice tone="warn" icon="flask-outline" title="Sandbox banks">
          These are pretend banks with made-up data, for trying the feature. No real bank is contacted.
        </Notice>
      )}
      {loadError && <ErrorBanner message={loadError} onRetry={refetch} />}
      {error && <Notice tone="danger" icon="alert-circle">{error}</Notice>}
      {!banks && !loadError && <Loader />}

      {banks && (
        <Section title="Choose your bank">
          {banks.length === 0 ? (
            <Card>
              <Text variant="caption">No banks are available right now.</Text>
            </Card>
          ) : (
            <RowGroup>
              {banks.map((bank) => (
                <Row
                  key={bank.id}
                  onPress={starting ? undefined : () => choose(bank)}
                  chevron={starting !== bank.id}
                  leading={<IconTile icon="business" color={t.bank} background={t.bankSoft} />}
                  title={bank.name}
                  subtitle={bank.country}
                  trailing={starting === bank.id ? <ActivityIndicator color={t.bank} /> : bank.provider === 'sandbox' ? <Badge label="Test" tone="warn" /> : undefined}
                />
              ))}
            </RowGroup>
          )}
        </Section>
      )}
    </Screen>
  );
}
