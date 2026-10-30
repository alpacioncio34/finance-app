import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';

import { Button, ChipPicker, Field, Input, Screen, Text } from '@/components/ui';
import { api, type AccountType } from '@/lib/api';
import { ACCOUNT_TYPES } from '@/lib/constants';
import { parseAmountToCents } from '@/lib/format';
import { useTheme } from '@/lib/theme';

export default function AccountForm() {
  const t = useTheme();
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('checking');
  const [balance, setBalance] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) return setError('Give the account a name.');
    const cents = balance.trim() ? parseAmountToCents(balance) : 0;
    if (cents === null) return setError('Starting balance is not a valid amount.');
    setError(null);
    setSaving(true);
    try {
      await api.createAccount({ name: name.trim(), type, currency: 'EUR', initial_balance_cents: cents });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <Field label="Name">
          <Input value={name} onChangeText={setName} placeholder="e.g. BBVA, Wallet, Revolut" autoFocus maxLength={80} />
        </Field>
        <Field label="Type">
          <ChipPicker value={type} onChange={setType} options={ACCOUNT_TYPES} />
        </Field>
        <Field label="Current balance (€)">
          <Input value={balance} onChangeText={setBalance} placeholder="0,00" keyboardType="numbers-and-punctuation" />
        </Field>
        <Text variant="caption">
          This is the balance today. New transactions you add will move it up or down. Use a negative number for credit card debt.
        </Text>
        {error && <Text color={t.expense}>{error}</Text>}
        <Button title="Create account" icon="checkmark" onPress={save} loading={saving} />
      </Screen>
    </KeyboardAvoidingView>
  );
}
