import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
  type RefreshControlProps,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { API_URL } from '@/lib/api';
import { monthLabel, shiftMonth } from '@/lib/format';
import { radius, space, useTheme } from '@/lib/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Screen({
  children,
  refreshControl,
  header,
}: {
  children: ReactNode;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  header?: ReactNode;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      {header}
      <ScrollView
        refreshControl={refreshControl}
        contentContainerStyle={{
          padding: space.lg,
          paddingBottom: insets.bottom + 96,
          gap: space.lg,
          width: '100%',
          maxWidth: 720,
          alignSelf: 'center',
        }}>
        {children}
      </ScrollView>
    </View>
  );
}

export function Text({
  children,
  variant = 'body',
  color,
  style,
  numberOfLines,
}: {
  children: ReactNode;
  variant?: 'title' | 'heading' | 'body' | 'label' | 'caption' | 'amount';
  color?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  const t = useTheme();
  return (
    <RNText numberOfLines={numberOfLines} style={[textStyles[variant], { color: color ?? (variant === 'caption' || variant === 'label' ? t.muted : t.text) }, style]}>
      {children}
    </RNText>
  );
}

const textStyles = StyleSheet.create({
  title: { fontSize: 30, fontWeight: '700', letterSpacing: -0.6, fontVariant: ['tabular-nums'] },
  heading: { fontSize: 17, fontWeight: '600' },
  body: { fontSize: 15 },
  label: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6 },
  caption: { fontSize: 13 },
  amount: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
});

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return (
    <View style={[{ backgroundColor: t.card, borderRadius: radius.lg, padding: space.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: t.border }, style]}>
      {children}
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  loading,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
}) {
  const t = useTheme();
  const bg = variant === 'primary' ? t.accent : variant === 'danger' ? 'transparent' : t.accentSoft;
  const fg = variant === 'primary' ? t.card : variant === 'danger' ? t.expense : t.accent;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => ({
        backgroundColor: bg,
        borderRadius: radius.md,
        paddingVertical: 14,
        paddingHorizontal: space.lg,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: space.sm,
        opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        borderWidth: variant === 'danger' ? 1 : 0,
        borderColor: t.expense,
      })}>
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
      <RNText style={{ color: fg, fontWeight: '600', fontSize: 15 }}>{title}</RNText>
    </Pressable>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={{ gap: space.xs + 2 }}>
      <Text variant="label">{label}</Text>
      {children}
    </View>
  );
}

export function Input(props: TextInputProps) {
  const t = useTheme();
  return (
    <TextInput
      placeholderTextColor={t.muted}
      {...props}
      style={[
        {
          backgroundColor: t.card,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: t.border,
          paddingHorizontal: space.md,
          paddingVertical: 12,
          fontSize: 16,
          color: t.text,
        },
        props.style,
      ]}
    />
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; color?: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: t.track, borderRadius: radius.md, padding: 3 }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={{
              flex: 1,
              paddingVertical: 9,
              borderRadius: radius.md - 3,
              alignItems: 'center',
              backgroundColor: active ? t.card : 'transparent',
            }}>
            <RNText style={{ fontWeight: '600', color: active ? (o.color ?? t.text) : t.muted }}>{o.label}</RNText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Wrap-around list of selectable chips (categories, accounts…). */
export function ChipPicker<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; color?: string; icon?: IconName }[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
      {options.map((o) => {
        const active = o.value === value;
        const c = o.color ?? t.accent;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => onChange(o.value)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: active ? c : t.border,
              backgroundColor: active ? c + '22' : t.card,
            }}>
            {o.icon && <Ionicons name={o.icon} size={14} color={active ? c : t.muted} />}
            <RNText style={{ color: active ? c : t.text, fontWeight: active ? '600' : '400' }}>{o.label}</RNText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const t = useTheme();
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  return (
    <View style={{ height: 8, borderRadius: 4, backgroundColor: t.track, overflow: 'hidden' }}>
      <View style={{ width: `${pct * 100}%`, height: '100%', borderRadius: 4, backgroundColor: color }} />
    </View>
  );
}

export function MonthSwitcher({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  const t = useTheme();
  const arrow = (dir: -1 | 1) => (
    <Pressable hitSlop={12} onPress={() => onChange(shiftMonth(month, dir))} style={{ padding: 6 }}>
      <Ionicons name={dir < 0 ? 'chevron-back' : 'chevron-forward'} size={20} color={t.text} />
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      {arrow(-1)}
      <Text variant="heading">{monthLabel(month)}</Text>
      {arrow(1)}
    </View>
  );
}

export function Empty({ icon, title, hint }: { icon: IconName; title: string; hint?: string }) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: space.xl, gap: space.sm }}>
      <Ionicons name={icon} size={36} color={t.muted} />
      <Text variant="heading">{title}</Text>
      {hint && <Text variant="caption" style={{ textAlign: 'center' }}>{hint}</Text>}
    </View>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const t = useTheme();
  return (
    <Card style={{ borderColor: t.expense, gap: space.sm }}>
      <Text variant="heading" color={t.expense}>Can&apos;t reach the server</Text>
      <Text variant="caption">{message}</Text>
      <Text variant="caption">API: {API_URL}</Text>
      <Text variant="caption">Is the backend running? (uvicorn app.main:app --host 0.0.0.0 --port 8000)</Text>
      {onRetry && <Button title="Retry" variant="secondary" onPress={onRetry} icon="refresh" />}
    </Card>
  );
}

export function Fab({ onPress, icon = 'add' }: { onPress: () => void; icon?: IconName }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel="Add"
      style={({ pressed }) => ({
        position: 'absolute',
        right: space.xl,
        bottom: insets.bottom + space.xl,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: t.accent,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.85 : 1,
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 5,
      })}>
      <Ionicons name={icon} size={28} color={t.card} />
    </Pressable>
  );
}
