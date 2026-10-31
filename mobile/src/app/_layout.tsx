import {
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
} from '@expo-google-fonts/bricolage-grotesque';
import { InstrumentSans_400Regular, InstrumentSans_500Medium, InstrumentSans_600SemiBold } from '@expo-google-fonts/instrument-sans';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';

import { font, useTheme } from '@/lib/theme';

export default function RootLayout() {
  const scheme = useColorScheme();
  const t = useTheme();
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const [loaded] = useFonts({
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
    InstrumentSans_400Regular,
    InstrumentSans_500Medium,
    InstrumentSans_600SemiBold,
  });
  if (!loaded) return null;

  return (
    <ThemeProvider
      value={{ ...base, colors: { ...base.colors, background: t.bg, card: t.card, text: t.text, border: t.border, primary: t.accent } }}>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShadowVisible: false, headerTitleStyle: { fontFamily: font.display }, headerStyle: { backgroundColor: t.bg } }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="transaction-form" options={{ presentation: 'modal', title: 'Transaction' }} />
        <Stack.Screen name="account-form" options={{ presentation: 'modal', title: 'New account' }} />
        <Stack.Screen name="budget-form" options={{ presentation: 'modal', title: 'Budget' }} />
      </Stack>
    </ThemeProvider>
  );
}
