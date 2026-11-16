import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';

import { Button, ChipPicker, Field, Input, Loader, Notice, Screen, Segmented, type IconName } from '@/components/ui';
import { db } from '@/lib/db';
import { confirm } from '@/lib/confirm';
import { centsToInput, isValidISODate, parseAmountToCents, todayISO } from '@/lib/format';
import { useLookups } from '@/lib/lookups';
import { font, space, useTheme } from '@/lib/theme';
import type { TransactionInput, TxKind } from '@/lib/types';

export default function TransactionForm() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editingId = id ? Number(id) : null;
  const { accounts, categories, loading: lookupsLoading } = useLookups();

  const [loadingExisting, setLoadingExisting] = useState(!!editingId);
  const [kind, setKind] = useState<TxKind>('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(todayISO());
  const [accountId, setAccountId] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Load the transaction when editing
  useEffect(() => {
    if (!editingId) return;
    db.transaction(editingId)
      .then((tx) => {
        setKind(tx.kind);
        setAmount(centsToInput(tx.amount_cents));
        setDescription(tx.description);
        setDate(tx.date);
        setAccountId(tx.account_id);
        setCategoryId(tx.category_id);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoadingExisting(false));
  }, [editingId]);

  // Default to the first account for a new transaction
  useEffect(() => {
    if (!editingId && accountId === null && accounts.length > 0) setAccountId(accounts[0].id);
  }, [editingId, accounts, accountId]);

  const visibleCategories = categories.filter((c) => c.kind === kind);
  const noAccounts = !editingId && !lookupsLoading && accounts.length === 0;

  function changeKind(k: TxKind) {
    setKind(k);
    setCategoryId(null);
  }

  async function save() {
    setError(null);
    const cents = parseAmountToCents(amount);
    const badAmount = !cents || cents <= 0;
    const badDate = !isValidISODate(date);
    setAmountError(badAmount ? 'Enter an amount greater than 0.' : null);
    setDateError(badDate ? 'Use the form YYYY-MM-DD, for example 2026-10-29.' : null);
    if (badAmount || badDate || !accountId || !cents) return;

    setSaving(true);
    const payload: TransactionInput = {
      account_id: accountId,
      category_id: categoryId,
      kind,
      amount_cents: cents,
      date,
      description: description.trim(),
    };
    try {
      if (editingId) await db.updateTransaction(editingId, payload);
      else await db.createTransaction(payload);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  }

  async function remove() {
    if (editingId && (await confirm('Delete transaction?', 'This cannot be undone.'))) {
      try {
        await db.deleteTransaction(editingId);
        router.back();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: editingId ? 'Edit transaction' : 'New transaction' }} />
      <Screen
        footer={
          !loadingExisting &&
          !noAccounts && (
            <>
              <Button title={editingId ? 'Save changes' : 'Add transaction'} onPress={save} loading={saving} />
              {editingId && <Button title="Delete transaction" variant="danger" icon="trash-outline" onPress={remove} disabled={saving} />}
            </>
          )
        }>
        {error && <Notice tone="danger" icon="alert-circle">{error}</Notice>}
        {loadingExisting && !error && <Loader />}

        {noAccounts && (
          <Notice
            tone="accent"
            icon="wallet-outline"
            title="You need an account first"
            action={<Button title="Add an account" size="small" icon="create-outline" onPress={() => router.replace('/account-form')} />}>
            A transaction belongs to an account, such as your wallet or your current account.
          </Notice>
        )}

        {!loadingExisting && !noAccounts && (
          <>
            <Segmented<TxKind>
              value={kind}
              onChange={changeKind}
              options={[
                { value: 'expense', label: 'Spent', color: t.expense },
                { value: 'income', label: 'Income', color: t.income },
              ]}
            />

            <Field label="Amount in euros" error={amountError}>
              <Input
                value={amount}
                onChangeText={setAmount}
                placeholder="0,00"
                keyboardType="decimal-pad"
                autoFocus={!editingId}
                invalid={!!amountError}
                style={{ fontFamily: font.displayHeavy, fontSize: 30, color: kind === 'income' ? t.income : t.text }}
              />
            </Field>

            <Field label="Description">
              <Input value={description} onChangeText={setDescription} placeholder="e.g. Mercadona" maxLength={200} />
            </Field>

            <Field label="Category" hint="Tap the selected one again to leave it without a category.">
              <ChipPicker
                value={categoryId}
                onChange={(v) => setCategoryId(v === categoryId ? null : v)}
                options={visibleCategories.map((c) => ({ value: c.id, label: c.name, color: c.color, icon: c.icon as IconName }))}
              />
            </Field>

            <Field label="Account">
              <ChipPicker value={accountId} onChange={setAccountId} options={accounts.map((a) => ({ value: a.id, label: a.name }))} />
            </Field>

            <Field label="Date" error={dateError}>
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <View style={{ flex: 1 }}>
                  <Input value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" autoCapitalize="none" invalid={!!dateError} />
                </View>
                <Button title="Today" variant="secondary" onPress={() => setDate(todayISO())} />
              </View>
            </Field>
          </>
        )}
      </Screen>
    </KeyboardAvoidingView>
  );
}
