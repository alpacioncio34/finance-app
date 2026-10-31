import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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
import { elevation, font, radius, space, useTheme } from '@/lib/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Screen({
  children,
  refreshControl,
  header,
  title,
  inset,
}: {
  children: ReactNode;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  header?: ReactNode;
  /** Large page title shown at the top of tab screens. */
  title?: string;
  /** Pad for the status bar on tab screens that have no native header. */
  inset?: boolean;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      {header}
      <ScrollView
        refreshControl={refreshControl}
        contentContainerStyle={{
          paddingHorizontal: space.xl,
          paddingTop: title || inset ? insets.top + space.lg : space.lg,
          paddingBottom: insets.bottom + 120,
          gap: space.xl,
          width: '100%',
          maxWidth: 720,
          alignSelf: 'center',
        }}>
        {title && <Text variant="title" style={{ fontSize: 34, lineHeight: 38 }}>{title}</Text>}
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
  adjustsFontSizeToFit,
}: {
  children: ReactNode;
  variant?: 'title' | 'heading' | 'body' | 'label' | 'caption' | 'amount';
  color?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  adjustsFontSizeToFit?: boolean;
}) {
  const t = useTheme();
  return (
    <RNText numberOfLines={numberOfLines} adjustsFontSizeToFit={adjustsFontSizeToFit} style={[textStyles[variant], { color: color ?? (variant === 'caption' || variant === 'label' ? t.muted : t.text) }, style]}>
      {children}
    </RNText>
  );
}

const textStyles = StyleSheet.create({
  title: { fontFamily: font.displayHeavy, fontSize: 30, letterSpacing: -0.8 },
  heading: { fontFamily: font.display, fontSize: 18, letterSpacing: -0.2 },
  body: { fontFamily: font.body, fontSize: 15, lineHeight: 21 },
  label: { fontFamily: font.medium, fontSize: 13 },
  caption: { fontFamily: font.body, fontSize: 13, lineHeight: 18 },
  amount: { fontFamily: font.displaySemi, fontSize: 16, fontVariant: ['tabular-nums'] },
});

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return (
    <View style={[{ backgroundColor: t.card, borderRadius: radius.card, padding: space.lg, borderWidth: 1, borderColor: t.border }, elevation(t.shadow, 0.6), style]}>
      {children}
    </View>
  );
}

/** Gradient hero panel: one per screen, carries the headline number. */
export function HeroCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return (
    <LinearGradient
      colors={t.hero}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[{ borderRadius: 32, padding: space.xl, gap: space.lg, overflow: 'hidden' }, elevation(t.shadow, 1.6), style]}>
      {/* decorative rings */}
      <View pointerEvents="none" style={{ position: 'absolute', right: -60, top: -60, width: 190, height: 190, borderRadius: 95, backgroundColor: '#FFFFFF', opacity: 0.1 }} />
      <View pointerEvents="none" style={{ position: 'absolute', right: 30, bottom: -80, width: 150, height: 150, borderRadius: 75, backgroundColor: '#FFFFFF', opacity: 0.07 }} />
      {children}
    </LinearGradient>
  );
}

/** Rounded square with a tinted background and a coloured icon (or initial). */
export function IconTile({ icon, color, size = 44, label }: { icon?: string; color: string; size?: number; label?: string }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.36, backgroundColor: color + '24', alignItems: 'center', justifyContent: 'center' }}>
      {icon ? (
        <Ionicons name={icon as IconName} size={size * 0.5} color={color} />
      ) : (
        <RNText style={{ color, fontFamily: font.displayHeavy, fontSize: size * 0.42 }}>{(label ?? '?').charAt(0).toUpperCase()}</RNText>
      )}
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
  const fg = variant === 'primary' ? t.onAccent : variant === 'danger' ? t.expense : t.accent;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => ({
        backgroundColor: bg,
        borderRadius: radius.control,
        paddingVertical: 15,
        paddingHorizontal: space.lg,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: space.sm,
        opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
        borderWidth: variant === 'danger' ? 1 : 0,
        borderColor: t.expense,
      })}>
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
      <RNText style={{ color: fg, fontFamily: font.semi, fontSize: 15 }}>{title}</RNText>
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
          borderRadius: radius.control,
          borderWidth: 1,
          borderColor: t.border,
          paddingHorizontal: space.md,
          paddingVertical: 13,
          fontFamily: font.body,
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
    <View style={{ flexDirection: 'row', backgroundColor: t.track, borderRadius: radius.control, padding: 4 }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: radius.control - 4,
              alignItems: 'center',
              backgroundColor: active ? t.card : 'transparent',
            }}>
            <RNText style={{ fontFamily: active ? font.semi : font.medium, color: active ? (o.color ?? t.text) : t.muted }}>{o.label}</RNText>
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
              paddingVertical: 9,
              paddingHorizontal: 12,
              borderRadius: radius.chip,
              borderWidth: 1,
              borderColor: active ? c : t.border,
              backgroundColor: active ? c + '22' : 'transparent',
            }}>
            {o.icon && <Ionicons name={o.icon} size={14} color={active ? c : t.muted} />}
            <RNText style={{ color: active ? c : t.text, fontFamily: active ? font.semi : font.body }}>{o.label}</RNText>
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
      <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: color }} />
    </View>
  );
}

export function MonthSwitcher({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  const t = useTheme();
  const arrow = (dir: -1 | 1) => (
    <Pressable
      hitSlop={10}
      accessibilityLabel={dir < 0 ? 'Previous month' : 'Next month'}
      onPress={() => onChange(shiftMonth(month, dir))}
      style={{ width: 36, height: 36, borderRadius: radius.control, borderWidth: 1, borderColor: t.border, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={dir < 0 ? 'chevron-back' : 'chevron-forward'} size={18} color={t.text} />
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      <Text variant="heading" style={{ flex: 1 }}>{monthLabel(month)}</Text>
      {arrow(-1)}
      {arrow(1)}
    </View>
  );
}

export function Empty({ icon, title, hint }: { icon: IconName; title: string; hint?: string }) {
  const t = useTheme();
  return (
    <View style={{ paddingVertical: space.lg, gap: space.xs }}>
      <Ionicons name={icon} size={22} color={t.accent} style={{ marginBottom: space.xs }} />
      <Text variant="heading">{title}</Text>
      {hint && <Text variant="caption">{hint}</Text>}
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
      accessibilityRole="button"
      accessibilityLabel="Add"
      style={({ pressed }) => ({
        position: 'absolute',
        right: space.xl,
        bottom: insets.bottom + space.xl,
        width: 60,
        height: 60,
        borderRadius: radius.fab,
        backgroundColor: t.accent,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.85 : 1,
        ...elevation(t.accent, 2.5),
      })}>
      <Ionicons name={icon} size={30} color={t.onAccent} />
    </Pressable>
  );
}
