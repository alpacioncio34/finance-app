import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';

import { Button, ChipPicker, Field, Input, Screen, Segmented, Text, type IconName } from '@/components/ui';
import { api, type TxKind } from '@/lib/api';
import { confirm } from '@/lib/confirm';
import { centsToInput, isValidISODate, parseAmountToCents, todayISO } from '@/lib/format';
import { useLookups } from '@/lib/lookups';
import { space, useTheme } from '@/lib/theme';

export default function TransactionForm() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editingId = id ? Number(id) : null;
  const { accounts, categories, loading: lookupsLoading } = useLookups();

  const [kind, setKind] = useState<TxKind>('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(todayISO());
  const [accountId, setAccountId] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Load existing transaction when editing
  useEffect(() => {
    if (!editingId) return;
    api.transaction(editingId).then((tx) => {
      setKind(tx.kind);
      setAmount(centsToInput(tx.amount_cents));
      setDescription(tx.description);
      setDate(tx.date);
      setAccountId(tx.account_id);
      setCategoryId(tx.category_id);
    });
  }, [editingId]);

  // Default to the first account
  useEffect(() => {
    if (accountId === null && accounts.length > 0) setAccountId(accounts[0].id);
  }, [accounts, accountId]);

  const visibleCategories = categories.filter((c) => c.kind === kind);

  function changeKind(k: TxKind) {
    setKind(k);
    setCategoryId(null);
  }

  async function save() {
    const cents = parseAmountToCents(amount);
    if (!cents || cents <= 0) return setError('Enter an amount greater than 0.');
    if (!accountId) return setError('Pick an account (create one in the Accounts tab first).');
    if (!isValidISODate(date)) return setError('Date must look like 2026-10-29.');
    setError(null);
    setSaving(true);
    try {
      const payload = { kind, amount_cents: cents, description: description.trim(), date, account_id: accountId, category_id: categoryId };
      if (editingId) await api.updateTransaction(editingId, payload);
      else await api.createTransaction(payload);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (editingId && (await confirm('Delete transaction?', 'This cannot be undone.'))) {
      await api.deleteTransaction(editingId);
      router.back();
    }
  }

  const noAccounts = !lookupsLoading && accounts.length === 0;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: editingId ? 'Edit transaction' : 'New transaction' }} />
      <Screen>
        <Segmented<TxKind>
          value={kind}
          onChange={changeKind}
          options={[
            { value: 'expense', label: 'Expense', color: t.expense },
            { value: 'income', label: 'Income', color: t.income },
          ]}
        />

        <Field label="Amount (€)">
          <Input
            value={amount}
            onChangeText={setAmount}
            placeholder="0,00"
            keyboardType="decimal-pad"
            autoFocus={!editingId}
            style={{ fontSize: 28, fontWeight: '700', color: kind === 'income' ? t.income : t.text }}
          />
        </Field>

        <Field label="Description">
          <Input value={description} onChangeText={setDescription} placeholder="e.g. Mercadona" maxLength={200} />
        </Field>

        <Field label="Category">
          <ChipPicker
            value={categoryId}
            onChange={(v) => setCategoryId(v === categoryId ? null : v)}
            options={visibleCategories.map((c) => ({ value: c.id, label: c.name, color: c.color, icon: c.icon as IconName }))}
          />
        </Field>

        <Field label="Account">
          {noAccounts ? (
            <Button title="Create an account first" variant="secondary" icon="wallet-outline" onPress={() => router.replace('/account-form')} />
          ) : (
            <ChipPicker value={accountId} onChange={setAccountId} options={accounts.map((a) => ({ value: a.id, label: a.name }))} />
          )}
        </Field>

        <Field label="Date">
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Input value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" style={{ flex: 1 }} autoCapitalize="none" />
            <Button title="Today" variant="secondary" onPress={() => setDate(todayISO())} />
          </View>
        </Field>

        {error && <Text color={t.expense}>{error}</Text>}

        <Button title={editingId ? 'Save changes' : 'Add transaction'} icon="checkmark" onPress={save} loading={saving} disabled={noAccounts} />
        {editingId && <Button title="Delete" variant="danger" icon="trash-outline" onPress={remove} />}
      </Screen>
    </KeyboardAvoidingView>
  );
}
