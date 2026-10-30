import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';

import { useTheme } from '@/lib/theme';

export default function RootLayout() {
  const scheme = useColorScheme();
  const t = useTheme();
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;

  return (
    <ThemeProvider
      value={{ ...base, colors: { ...base.colors, background: t.bg, card: t.card, text: t.text, border: t.border, primary: t.accent } }}>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShadowVisible: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="transaction-form" options={{ presentation: 'modal', title: 'Transaction' }} />
        <Stack.Screen name="account-form" options={{ presentation: 'modal', title: 'New account' }} />
        <Stack.Screen name="budget-form" options={{ presentation: 'modal', title: 'Budget' }} />
      </Stack>
    </ThemeProvider>
  );
}
