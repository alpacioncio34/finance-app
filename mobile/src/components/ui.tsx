import { Ionicons } from '@expo/vector-icons';
import { Children, useState, type ComponentProps, type ReactNode } from 'react';
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

import { monthLabel, shiftMonth } from '@/lib/format';
import { elevation, font, radius, space, useTheme } from '@/lib/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];
export type Tone = 'neutral' | 'accent' | 'bank' | 'warn' | 'danger';

/** Background + foreground for a tone, used by badges, notices and icon tiles. */
export function useTone(tone: Tone): { bg: string; fg: string } {
  const t = useTheme();
  switch (tone) {
    case 'accent':
      return { bg: t.accentSoft, fg: t.accent };
    case 'bank':
      return { bg: t.bankSoft, fg: t.bank };
    case 'warn':
      return { bg: t.warnSoft, fg: t.warn };
    case 'danger':
      return { bg: t.expenseSoft, fg: t.expense };
    default:
      return { bg: t.track, fg: t.muted };
  }
}

// ---------- Layout ----------

export function Screen({
  children,
  refreshControl,
  title,
  action,
  inset,
  footer,
}: {
  children: ReactNode;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  /** Large page title shown at the top of tab screens. */
  title?: string;
  /** Shown on the right of the title, e.g. an IconButton. */
  action?: ReactNode;
  /** Pad for the status bar on screens that have no native header and no title. */
  inset?: boolean;
  /** Pinned under the scroll area, e.g. a form's save button. */
  footer?: ReactNode;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView
        refreshControl={refreshControl}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: space.lg + 4,
          paddingTop: title || inset ? insets.top + space.lg : space.lg,
          paddingBottom: footer ? space.xl : insets.bottom + 110,
          gap: space.xl,
          width: '100%',
          maxWidth: 640,
          alignSelf: 'center',
        }}>
        {title && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <Text variant="title" style={{ flex: 1 }}>{title}</Text>
            {action}
          </View>
        )}
        {children}
      </ScrollView>
      {footer && (
        <View style={{ borderTopWidth: 1, borderTopColor: t.border, backgroundColor: t.bg }}>
          <View style={{ padding: space.lg, paddingBottom: insets.bottom + space.lg, gap: space.sm, width: '100%', maxWidth: 640, alignSelf: 'center' }}>
            {footer}
          </View>
        </View>
      )}
    </View>
  );
}

/** A titled block of a screen, with an optional action on the right of the heading. */
export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <View style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 28 }}>
        <Text variant="heading" style={{ flex: 1 }}>{title}</Text>
        {action}
      </View>
      {children}
    </View>
  );
}

// ---------- Text ----------

export function Text({
  children,
  variant = 'body',
  color,
  style,
  numberOfLines,
  adjustsFontSizeToFit,
}: {
  children: ReactNode;
  variant?: 'display' | 'title' | 'heading' | 'body' | 'label' | 'caption' | 'amount';
  color?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  adjustsFontSizeToFit?: boolean;
}) {
  const t = useTheme();
  const quiet = variant === 'caption' || variant === 'label';
  return (
    <RNText numberOfLines={numberOfLines} adjustsFontSizeToFit={adjustsFontSizeToFit} style={[textStyles[variant], { color: color ?? (quiet ? t.muted : t.text) }, style]}>
      {children}
    </RNText>
  );
}

const textStyles = StyleSheet.create({
  // The one big number on a screen
  display: { fontFamily: font.displayHeavy, fontSize: 44, lineHeight: 50, letterSpacing: -1.6, fontVariant: ['tabular-nums'] },
  title: { fontFamily: font.displayHeavy, fontSize: 30, lineHeight: 36, letterSpacing: -0.8 },
  heading: { fontFamily: font.display, fontSize: 18, lineHeight: 24, letterSpacing: -0.2 },
  body: { fontFamily: font.body, fontSize: 15, lineHeight: 21 },
  label: { fontFamily: font.medium, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: font.body, fontSize: 13, lineHeight: 18 },
  amount: { fontFamily: font.displaySemi, fontSize: 16, fontVariant: ['tabular-nums'] },
});

// ---------- Surfaces ----------

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return (
    <View style={[{ backgroundColor: t.card, borderRadius: radius.card, padding: space.lg, borderWidth: 1, borderColor: t.border }, style]}>
      {children}
    </View>
  );
}

/** A card whose children are rows separated by hairlines. Use it for any list of like things. */
export function RowGroup({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  const rows = Children.toArray(children);
  return (
    <Card style={[{ paddingVertical: 0, paddingHorizontal: 0, overflow: 'hidden' }, style]}>
      {rows.map((row, i) => (
        <View key={i} style={{ borderTopWidth: i === 0 ? 0 : 1, borderTopColor: t.border }}>
          {row}
        </View>
      ))}
    </Card>
  );
}

/** One line of a RowGroup: leading tile, title + subtitle, trailing value. Pressable when `onPress` is set. */
export function Row({
  leading,
  title,
  subtitle,
  trailing,
  onPress,
  chevron,
  wrap,
  accessibilityLabel,
}: {
  leading?: ReactNode;
  title: string;
  subtitle?: ReactNode;
  /** Let a long subtitle run onto more lines instead of cutting it off. */
  wrap?: boolean;
  trailing?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  accessibilityLabel?: string;
}) {
  const t = useTheme();
  const content = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, paddingHorizontal: space.lg, minHeight: 64 }}>
      {leading}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: font.medium }} numberOfLines={1}>{title}</Text>
        {typeof subtitle === 'string' ? <Text variant="caption" numberOfLines={wrap ? undefined : 1}>{subtitle}</Text> : subtitle}
      </View>
      {trailing}
      {chevron && <Ionicons name="chevron-forward" size={16} color={t.muted} />}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={({ pressed }) => ({ backgroundColor: pressed ? t.track : 'transparent' })}>
      {content}
    </Pressable>
  );
}

/** The dark summary block at the top of a tab: one per screen, carries the headline number. */
export function Panel({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return (
    <View style={[{ backgroundColor: t.panel, borderRadius: radius.panel, padding: space.xl, gap: space.lg }, style]}>
      {children}
    </View>
  );
}

/** A two-part bar for a Panel: how much of `total` is `used`. Turns pink when `used` exceeds `total`. */
export function PanelBar({ used, total, label }: { used: number; total: number; label: string }) {
  const t = useTheme();
  const over = used > total;
  const pct = total > 0 ? Math.min(used / total, 1) : used > 0 ? 1 : 0;
  return (
    <View accessibilityLabel={label} style={{ height: 10, borderRadius: 5, backgroundColor: over ? t.panelWarn : t.panelAccent, overflow: 'hidden', opacity: total <= 0 && used <= 0 ? 0.35 : 1 }}>
      {!over && <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: t.panelTrack }} />}
    </View>
  );
}

/** Rounded square with a tinted background and a coloured icon (or initial). */
export function IconTile({ icon, color, size = 44, label, background }: { icon?: string; color: string; size?: number; label?: string; background?: string }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.32, backgroundColor: background ?? color + '22', alignItems: 'center', justifyContent: 'center' }}>
      {icon ? (
        <Ionicons name={icon as IconName} size={size * 0.48} color={color} />
      ) : (
        <RNText style={{ color, fontFamily: font.displayHeavy, fontSize: size * 0.42 }}>{(label ?? '?').charAt(0).toUpperCase()}</RNText>
      )}
    </View>
  );
}

/** Small pill that names a state, e.g. "Bank" or "Read-only". */
export function Badge({ label, tone = 'neutral', icon }: { label: string; tone?: Tone; icon?: IconName }) {
  const c = useTone(tone);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: c.bg, borderRadius: radius.chip, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' }}>
      {icon && <Ionicons name={icon} size={12} color={c.fg} />}
      <RNText style={{ color: c.fg, fontFamily: font.semi, fontSize: 12 }}>{label}</RNText>
    </View>
  );
}

/** Inline message box. Use tone 'danger' for errors, 'bank' for bank-related information. */
export function Notice({ tone = 'neutral', icon, title, children, action }: { tone?: Tone; icon?: IconName; title?: string; children?: ReactNode; action?: ReactNode }) {
  const c = useTone(tone);
  return (
    <View accessibilityRole={tone === 'danger' ? 'alert' : undefined} style={{ flexDirection: 'row', gap: space.md, backgroundColor: c.bg, borderRadius: radius.card, padding: space.lg }}>
      {icon && <Ionicons name={icon} size={20} color={c.fg} style={{ marginTop: 1 }} />}
      <View style={{ flex: 1, gap: space.xs }}>
        {title && <Text style={{ fontFamily: font.semi }} color={c.fg}>{title}</Text>}
        {typeof children === 'string' ? <Text variant="caption">{children}</Text> : children}
        {action && <View style={{ marginTop: space.sm, alignSelf: 'flex-start' }}>{action}</View>}
      </View>
    </View>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Notice tone="danger" icon="alert-circle" title="That didn't work" action={onRetry && <Button title="Try again" variant="secondary" size="small" onPress={onRetry} icon="refresh" />}>
      {message}
    </Notice>
  );
}

export function Empty({ icon, title, hint, children }: { icon: IconName; title: string; hint?: string; children?: ReactNode }) {
  const t = useTheme();
  return (
    <Card style={{ gap: space.sm, alignItems: 'flex-start' }}>
      <IconTile icon={icon} color={t.accent} background={t.accentSoft} size={40} />
      <Text variant="heading">{title}</Text>
      {hint && <Text variant="caption">{hint}</Text>}
      {children && <View style={{ marginTop: space.sm, alignSelf: 'stretch', gap: space.sm }}>{children}</View>}
    </Card>
  );
}

export function Loader() {
  const t = useTheme();
  return (
    <View style={{ paddingVertical: space.xxl, alignItems: 'center' }}>
      <ActivityIndicator color={t.accent} />
    </View>
  );
}

// ---------- Controls ----------

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'regular',
  icon,
  disabled,
  loading,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'bank';
  size?: 'regular' | 'small';
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
}) {
  const t = useTheme();
  const colors = {
    primary: { bg: t.accent, fg: t.onAccent },
    bank: { bg: t.bank, fg: t.card },
    secondary: { bg: t.accentSoft, fg: t.accent },
    ghost: { bg: 'transparent', fg: t.accent },
    danger: { bg: t.expenseSoft, fg: t.expense },
  }[variant];
  const small = size === 'small';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => ({
        backgroundColor: colors.bg,
        borderRadius: small ? radius.chip : radius.control,
        minHeight: small ? 36 : 52,
        paddingHorizontal: small ? space.md : space.lg,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: space.sm,
        opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
      })}>
      {loading ? <ActivityIndicator size="small" color={colors.fg} /> : icon ? <Ionicons name={icon} size={small ? 15 : 18} color={colors.fg} /> : null}
      <RNText style={{ color: colors.fg, fontFamily: font.semi, fontSize: small ? 13 : 15 }}>{title}</RNText>
    </Pressable>
  );
}

/** Round icon-only button. `label` is read by screen readers. */
export function IconButton({ icon, label, onPress, tone = 'neutral' }: { icon: IconName; label: string; onPress: () => void; tone?: Tone }) {
  const t = useTheme();
  const c = useTone(tone);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: tone === 'neutral' ? t.card : c.bg,
        borderWidth: tone === 'neutral' ? 1 : 0,
        borderColor: t.border,
        opacity: pressed ? 0.6 : 1,
      })}>
      <Ionicons name={icon} size={18} color={tone === 'neutral' ? t.text : c.fg} />
    </Pressable>
  );
}

/** Label above a control, with an optional hint below and an error that replaces the hint. */
export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string | null; children: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ gap: space.xs + 2 }}>
      <Text variant="label">{label}</Text>
      {children}
      {error ? <Text variant="caption" color={t.expense}>{error}</Text> : hint ? <Text variant="caption">{hint}</Text> : null}
    </View>
  );
}

export function Input({ invalid, trailing, style, onFocus, onBlur, editable, ...props }: TextInputProps & { invalid?: boolean; trailing?: ReactNode }) {
  const t = useTheme();
  const [focused, setFocused] = useState(false);
  const locked = editable === false;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: locked ? t.track : t.card,
        borderRadius: radius.control,
        borderWidth: focused || invalid ? 2 : 1,
        borderColor: invalid ? t.expense : focused ? t.accent : t.border,
        // Keep the box the same size when the border gets thicker
        paddingHorizontal: space.md - (focused || invalid ? 1 : 0),
      }}>
      <TextInput
        placeholderTextColor={t.muted}
        editable={editable}
        {...props}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          { flex: 1, minWidth: 0, paddingVertical: focused || invalid ? 12 : 13, fontFamily: font.body, fontSize: 16, color: locked ? t.muted : t.text },
          // Removes the browser's own focus outline on web: the border above shows focus instead
          { outlineWidth: 0 } as TextStyle,
          style,
        ]}
      />
      {trailing}
    </View>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: { value: T; label: string; color?: string }[];
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: t.track, borderRadius: radius.control, padding: 4, opacity: disabled ? 0.6 : 1 }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active, disabled }}
            disabled={disabled}
            onPress={() => onChange(o.value)}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: radius.control - 4,
              alignItems: 'center',
              backgroundColor: active ? t.card : 'transparent',
            }}>
            <RNText style={{ fontFamily: active ? font.semi : font.medium, fontSize: 14, color: active ? (o.color ?? t.text) : t.muted }}>{o.label}</RNText>
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
  disabled,
}: {
  options: { value: T; label: string; color?: string; icon?: IconName }[];
  value: T | null;
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, opacity: disabled ? 0.6 : 1 }}>
      {options.map((o) => {
        const active = o.value === value;
        const c = o.color ?? t.accent;
        return (
          <Pressable
            key={String(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active, disabled }}
            disabled={disabled}
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
              backgroundColor: active ? c + '22' : t.card,
            }}>
            {o.icon && <Ionicons name={o.icon} size={14} color={active ? c : t.muted} />}
            <RNText style={{ color: active ? c : t.text, fontFamily: active ? font.semi : font.body, fontSize: 14 }}>{o.label}</RNText>
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

export function MonthSwitcher({ month, onChange, trailing }: { month: string; onChange: (m: string) => void; trailing?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
      <IconButton icon="chevron-back" label="Previous month" onPress={() => onChange(shiftMonth(month, -1))} />
      <Text variant="heading" style={{ flex: 1, textAlign: 'center' }}>{monthLabel(month)}</Text>
      <IconButton icon="chevron-forward" label="Next month" onPress={() => onChange(shiftMonth(month, 1))} />
      {trailing}
    </View>
  );
}

export function Fab({ onPress, icon = 'add', label = 'Add' }: { onPress: () => void; icon?: IconName; label?: string }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
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
        ...elevation(t.shadow, 2.5),
      })}>
      <Ionicons name={icon} size={30} color={t.onAccent} />
    </Pressable>
  );
}
