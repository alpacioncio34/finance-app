import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';

import { Button, ChipPicker, Field, Input, Loader, Notice, Screen } from '@/components/ui';
import { api, type Account, type AccountType } from '@/lib/api';
import { confirm } from '@/lib/confirm';
import { ACCOUNT_TYPES } from '@/lib/constants';
import { centsToInput, parseAmountToCents, timeAgo } from '@/lib/format';

/** New manual account, or (with an `id` param) edit an existing one. Bank accounts can only be renamed. */
export default function AccountForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editingId = id ? Number(id) : null;

  const [account, setAccount] = useState<Account | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('checking');
  const [balance, setBalance] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editingId) return;
    api
      .account(editingId)
      .then((a) => {
        setAccount(a);
        setName(a.name);
        setType(a.type);
        setBalance(centsToInput(a.initial_balance_cents));
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [editingId]);

  const fromBank = account?.source === 'bank';

  async function save() {
    const cents = balance.trim() ? parseAmountToCents(balance) : 0;
    setNameError(name.trim() ? null : 'Give the account a name.');
    setBalanceError(cents === null ? 'Enter an amount like 1250,00.' : null);
    if (!name.trim() || cents === null) return;
    setError(null);
    setSaving(true);
    try {
      if (!editingId) await api.createAccount({ name: name.trim(), type, currency: 'EUR', initial_balance_cents: cents });
      // The API only accepts a new name for bank accounts
      else if (fromBank) await api.updateAccount(editingId, { name: name.trim() });
      else await api.updateAccount(editingId, { name: name.trim(), type, initial_balance_cents: cents });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  }

  async function remove() {
    if (!editingId || !account) return;
    const consequence = fromBank
      ? 'Its imported transactions are deleted too. The bank stays connected, but this account stops updating.'
      : 'This also deletes all of its transactions.';
    if (!(await confirm(`Delete "${account.name}"?`, consequence))) return;
    try {
      await api.deleteAccount(editingId);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const loadingExisting = !!editingId && !account;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: editingId ? 'Edit account' : 'New account' }} />
      <Screen
        footer={
          !loadingExisting && (
            <>
              <Button title={editingId ? 'Save changes' : 'Create account'} onPress={save} loading={saving} />
              {editingId && <Button title="Delete account" variant="danger" icon="trash-outline" onPress={remove} disabled={saving} />}
            </>
          )
        }>
        {error && <Notice tone="danger" icon="alert-circle">{error}</Notice>}
        {loadingExisting && !error && <Loader />}

        {!loadingExisting && (
          <>
            {fromBank && (
              <Notice tone="bank" icon="link" title={`From ${account?.institution_name ?? 'your bank'}`}>
                {`The balance and transactions come from the bank, so only the name can be changed here.${account?.last_synced_at ? ` Updated ${timeAgo(account.last_synced_at)}.` : ''}`}
              </Notice>
            )}
            <Field label="Name" error={nameError}>
              <Input value={name} onChangeText={setName} placeholder="e.g. Wallet, Revolut, Savings jar" autoFocus={!editingId} maxLength={80} invalid={!!nameError} />
            </Field>
            {!fromBank && (
              <>
                <Field label="Type">
                  <ChipPicker value={type} onChange={setType} options={ACCOUNT_TYPES} />
                </Field>
                <Field
                  label={editingId ? 'Starting balance in euros' : 'Balance today in euros'}
                  error={balanceError}
                  hint={
                    editingId
                      ? 'What the account held before its first transaction here. Changing it shifts the current balance by the same amount.'
                      : 'Transactions you add later move it up or down. Use a negative number for credit card debt.'
                  }>
                  <Input value={balance} onChangeText={setBalance} placeholder="0,00" keyboardType="numbers-and-punctuation" invalid={!!balanceError} />
                </Field>
              </>
            )}
          </>
        )}
      </Screen>
    </KeyboardAvoidingView>
  );
}
