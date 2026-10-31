import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';

import { Button, ChipPicker, Field, Input, Screen, Text, type IconName } from '@/components/ui';
import { api } from '@/lib/api';
import { confirm } from '@/lib/confirm';
import { centsToInput, currentMonth, monthLabel, parseAmountToCents } from '@/lib/format';
import { useLookups } from '@/lib/lookups';
import { useTheme } from '@/lib/theme';

export default function BudgetForm() {
  const t = useTheme();
  const params = useLocalSearchParams<{ month?: string; category_id?: string; id?: string; limit?: string }>();
  const month = params.month ?? currentMonth();
  const editingId = params.id ? Number(params.id) : null;
  const { categories } = useLookups();

  const [categoryId, setCategoryId] = useState<number | null>(params.category_id ? Number(params.category_id) : null);
  const [limit, setLimit] = useState(params.limit ? centsToInput(Number(params.limit)) : '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!categoryId) return setError('Pick a category.');
    const cents = parseAmountToCents(limit);
    if (!cents || cents <= 0) return setError('Enter a monthly limit greater than 0.');
    setError(null);
    setSaving(true);
    try {
      // POST upserts: creates or updates the limit for this category + month
      await api.setBudget({ category_id: categoryId, month, limit_cents: cents });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (editingId && (await confirm('Remove budget?', 'Your transactions are not affected.'))) {
      await api.deleteBudget(editingId);
      router.back();
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: `${editingId ? 'Edit' : 'New'} budget · ${monthLabel(month)}` }} />
      <Screen>
        <Field label="Category">
          <ChipPicker
            value={categoryId}
            onChange={editingId ? () => {} : setCategoryId}
            options={categories
              .filter((c) => c.kind === 'expense' && (!editingId || c.id === categoryId))
              .map((c) => ({ value: c.id, label: c.name, color: c.color, icon: c.icon as IconName }))}
          />
        </Field>
        <Field label="Monthly limit in euros">
          <Input value={limit} onChangeText={setLimit} placeholder="0,00" keyboardType="decimal-pad" autoFocus />
        </Field>
        {error && <Text color={t.expense}>{error}</Text>}
        <Button title="Save budget" onPress={save} loading={saving} />
        {editingId && <Button title="Remove budget" variant="danger" icon="trash-outline" onPress={remove} />}
      </Screen>
    </KeyboardAvoidingView>
  );
}
