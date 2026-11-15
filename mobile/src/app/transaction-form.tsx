import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';

import { Button, ChipPicker, Field, Input, Loader, Notice, Screen, Segmented, type IconName } from '@/components/ui';
import { api, type Transaction, type TxKind } from '@/lib/api';
import { confirm } from '@/lib/confirm';
import { centsToInput, isValidISODate, parseAmountToCents, todayISO } from '@/lib/format';
import { useLookups } from '@/lib/lookups';
import { font, space, useTheme } from '@/lib/theme';

export default function TransactionForm() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editingId = id ? Number(id) : null;
  const { accounts, categories, accountById, loading: lookupsLoading } = useLookups();

  const [existing, setExisting] = useState<Transaction | null>(null);
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

  // Load existing transaction when editing
  useEffect(() => {
    if (!editingId) return;
    api
      .transaction(editingId)
      .then((tx) => {
        setExisting(tx);
        setKind(tx.kind);
        setAmount(centsToInput(tx.amount_cents));
        setDescription(tx.description);
        setDate(tx.date);
        setAccountId(tx.account_id);
        setCategoryId(tx.category_id);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [editingId]);

  // Transactions can only be typed into manual accounts: bank accounts are filled by the bank
  const manualAccounts = accounts.filter((a) => a.source === 'manual');
  // The bank imported this one: only its category and description are yours to change
  const fromBank = !!existing?.external_id;

  // Default to the first manual account
  useEffect(() => {
    if (!editingId && accountId === null && manualAccounts.length > 0) setAccountId(manualAccounts[0].id);
  }, [editingId, manualAccounts, accountId]);

  const visibleCategories = categories.filter((c) => c.kind === kind);

  function changeKind(k: TxKind) {
    setKind(k);
    setCategoryId(null);
  }

  async function save() {
    setError(null);
    setSaving(true);
    try {
      if (editingId && fromBank) {
        await api.updateTransaction(editingId, { category_id: categoryId, description: description.trim() });
      } else {
        const cents = parseAmountToCents(amount);
        const badAmount = !cents || cents <= 0;
        const badDate = !isValidISODate(date);
        setAmountError(badAmount ? 'Enter an amount greater than 0.' : null);
        setDateError(badDate ? 'Use the form YYYY-MM-DD, for example 2026-10-29.' : null);
        if (badAmount || badDate || !accountId) return setSaving(false);
        const payload = { kind, amount_cents: cents, description: description.trim(), date, account_id: accountId, category_id: categoryId };
        if (editingId) await api.updateTransaction(editingId, payload);
        else await api.createTransaction(payload);
      }
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  }

  async function remove() {
    if (editingId && (await confirm('Delete transaction?', 'This cannot be undone.'))) {
      try {
        await api.deleteTransaction(editingId);
        router.back();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    }
  }

  const loadingExisting = !!editingId && !existing;
  const noAccounts = !editingId && !lookupsLoading && manualAccounts.length === 0;
  const onlyBankAccounts = noAccounts && accounts.length > 0;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: fromBank ? 'Bank transaction' : editingId ? 'Edit transaction' : 'New transaction' }} />
      <Screen
        footer={
          !loadingExisting &&
          !noAccounts && (
            <>
              <Button title={editingId ? 'Save changes' : 'Add transaction'} onPress={save} loading={saving} />
              {editingId && !fromBank && <Button title="Delete transaction" variant="danger" icon="trash-outline" onPress={remove} disabled={saving} />}
            </>
          )
        }>
        {error && <Notice tone="danger" icon="alert-circle">{error}</Notice>}
        {loadingExisting && !error && <Loader />}

        {noAccounts && (
          <Notice
            tone="accent"
            icon="wallet-outline"
            title={onlyBankAccounts ? 'Bank accounts fill themselves in' : 'You need an account first'}
            action={<Button title="Add an account by hand" size="small" icon="create-outline" onPress={() => router.replace('/account-form')} />}>
            {onlyBankAccounts
              ? 'Transactions in a connected bank account come from the bank. To record something yourself, such as cash, add an account you keep by hand.'
              : 'A transaction belongs to an account, such as your wallet or a savings jar.'}
          </Notice>
        )}

        {!loadingExisting && !noAccounts && (
          <>
            {fromBank && (
              <Notice tone="bank" icon="link" title={`From ${accountById.get(existing!.account_id)?.institution_name ?? 'your bank'}`}>
                The amount, date and account come from the bank and can&apos;t be changed. The category and description are yours.
              </Notice>
            )}

            <Segmented<TxKind>
              value={kind}
              onChange={changeKind}
              disabled={fromBank}
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
                editable={!fromBank}
                invalid={!!amountError}
                style={{ fontFamily: font.displayHeavy, fontSize: 30, color: fromBank ? t.muted : kind === 'income' ? t.income : t.text }}
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
              {fromBank ? (
                <Input value={accountById.get(existing!.account_id)?.name ?? ''} editable={false} />
              ) : (
                <ChipPicker value={accountId} onChange={setAccountId} options={manualAccounts.map((a) => ({ value: a.id, label: a.name }))} />
              )}
            </Field>

            <Field label="Date" error={dateError}>
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <View style={{ flex: 1 }}>
                  <Input value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" autoCapitalize="none" editable={!fromBank} invalid={!!dateError} />
                </View>
                {!fromBank && <Button title="Today" variant="secondary" onPress={() => setDate(todayISO())} />}
              </View>
            </Field>
          </>
        )}
      </Screen>
    </KeyboardAvoidingView>
  );
}
