import {
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
} from '@expo-google-fonts/bricolage-grotesque';
import { InstrumentSans_400Regular, InstrumentSans_500Medium, InstrumentSans_600SemiBold } from '@expo-google-fonts/instrument-sans';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useColorScheme, View } from 'react-native';

import { Text } from '@/components/ui';
import { initDb } from '@/lib/db';
import { font, space, useTheme } from '@/lib/theme';

export default function RootLayout() {
  const scheme = useColorScheme();
  const t = useTheme();
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const [fontsLoaded] = useFonts({
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
    InstrumentSans_400Regular,
    InstrumentSans_500Medium,
    InstrumentSans_600SemiBold,
  });
  // The saved data is read from the device once, before any screen asks for it
  const [dataReady, setDataReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  useEffect(() => {
    initDb()
      .then(() => setDataReady(true))
      .catch((e) => setLoadError(e instanceof Error ? e.message : String(e)));
  }, []);

  if (!fontsLoaded) return null;

  if (loadError) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, backgroundColor: t.bg }}>
        <Text variant="heading">Couldn&apos;t open your saved data.</Text>
        <Text variant="caption">{loadError}</Text>
      </View>
    );
  }

  return (
    <ThemeProvider
      value={{ ...base, colors: { ...base.colors, background: t.bg, card: t.card, text: t.text, border: t.border, primary: t.accent } }}>
      <StatusBar style="auto" />
      {!dataReady ? (
        <View style={{ flex: 1, backgroundColor: t.bg }} />
      ) : (
        <Stack screenOptions={{ headerShadowVisible: false, headerTitleStyle: { fontFamily: font.display }, headerStyle: { backgroundColor: t.bg }, headerTintColor: t.text }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="transaction-form" options={{ presentation: 'modal', title: 'Transaction' }} />
          <Stack.Screen name="account-form" options={{ presentation: 'modal', title: 'Account' }} />
          <Stack.Screen name="budget-form" options={{ presentation: 'modal', title: 'Budget' }} />
          <Stack.Screen name="settings" options={{ presentation: 'modal', title: 'Settings' }} />
        </Stack>
      )}
    </ThemeProvider>
  );
}
