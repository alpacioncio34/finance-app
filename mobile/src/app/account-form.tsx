import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';

import { Button, ChipPicker, Field, Input, Loader, Notice, Screen } from '@/components/ui';
import { db } from '@/lib/db';
import { confirm } from '@/lib/confirm';
import { ACCOUNT_TYPES } from '@/lib/constants';
import { centsToInput, parseAmountToCents } from '@/lib/format';
import type { AccountType, AccountView } from '@/lib/types';

/** New account, or (with an `id` param) edit an existing one. */
export default function AccountForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editingId = id ? Number(id) : null;

  const [account, setAccount] = useState<AccountView | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('checking');
  const [balance, setBalance] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editingId) return;
    db.account(editingId)
      .then((a) => {
        setAccount(a);
        setName(a.name);
        setType(a.type);
        setBalance(centsToInput(a.initial_balance_cents));
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [editingId]);

  async function save() {
    const cents = balance.trim() ? parseAmountToCents(balance) : 0;
    setNameError(name.trim() ? null : 'Give the account a name.');
    setBalanceError(cents === null ? 'Enter an amount like 1250,00.' : null);
    if (!name.trim() || cents === null) return;
    setError(null);
    setSaving(true);
    try {
      if (!editingId) await db.createAccount({ name: name.trim(), type, currency: 'EUR', initial_balance_cents: cents });
      else await db.updateAccount(editingId, { name: name.trim(), type, initial_balance_cents: cents });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  }

  async function remove() {
    if (!editingId || !account) return;
    if (!(await confirm(`Delete "${account.name}"?`, 'This also deletes all of its transactions.'))) return;
    try {
      await db.deleteAccount(editingId);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const loadingExisting = !!editingId && !account && !error;

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
        {loadingExisting && <Loader />}

        {!loadingExisting && (
          <>
            <Field label="Name" error={nameError}>
              <Input value={name} onChangeText={setName} placeholder="e.g. Wallet, Current account, Savings jar" autoFocus={!editingId} maxLength={80} invalid={!!nameError} />
            </Field>
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
      </Screen>
    </KeyboardAvoidingView>
  );
}
