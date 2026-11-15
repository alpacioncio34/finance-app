import {
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
} from '@expo-google-fonts/bricolage-grotesque';
import { InstrumentSans_400Regular, InstrumentSans_500Medium, InstrumentSans_600SemiBold } from '@expo-google-fonts/instrument-sans';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import { useColorScheme, View } from 'react-native';

import { Text } from '@/components/ui';
import { AuthProvider, useAuth } from '@/lib/auth';
import { isBankReturnPopup } from '@/lib/bankReturn';
import { font, space, useTheme } from '@/lib/theme';

// Web only: when this page is the popup the bank redirected to, tell the window that opened it and close.
WebBrowser.maybeCompleteAuthSession();

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

  if (isBankReturnPopup) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, backgroundColor: t.bg }}>
        <Text variant="heading">All done. You can close this window.</Text>
      </View>
    );
  }

  return (
    <ThemeProvider
      value={{ ...base, colors: { ...base.colors, background: t.bg, card: t.card, text: t.text, border: t.border, primary: t.accent } }}>
      <StatusBar style="auto" />
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </ThemeProvider>
  );
}

function RootNavigator() {
  const t = useTheme();
  const { status } = useAuth();
  // Stored session still being checked: render nothing, so the sign-in screen doesn't flash
  if (status === 'loading') return <View style={{ flex: 1, backgroundColor: t.bg }} />;
  const signedIn = status === 'signedIn';

  return (
    <Stack screenOptions={{ headerShadowVisible: false, headerTitleStyle: { fontFamily: font.display }, headerStyle: { backgroundColor: t.bg }, headerTintColor: t.text }}>
      {/* Signing in or out flips the guards, and the router moves the user to the right group by itself. */}
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="transaction-form" options={{ presentation: 'modal', title: 'Transaction' }} />
        <Stack.Screen name="account-form" options={{ presentation: 'modal', title: 'Account' }} />
        <Stack.Screen name="budget-form" options={{ presentation: 'modal', title: 'Budget' }} />
        <Stack.Screen name="connect-bank" options={{ presentation: 'modal', title: 'Connect a bank' }} />
        <Stack.Screen name="settings" options={{ presentation: 'modal', title: 'Settings' }} />
        <Stack.Screen name="bank-callback" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}
