import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';

import { Button, Field, Input, Notice, Screen, Text } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { isValidEmail, MIN_PASSWORD_LENGTH } from '@/lib/format';
import { space, useTheme } from '@/lib/theme';

type Mode = 'signIn' | 'signUp';

export default function SignIn() {
  const t = useTheme();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  // Field errors only show after the first attempt, so the form doesn't complain while you type
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const creating = mode === 'signUp';
  const emailError = !email.trim() ? 'Enter your email.' : !isValidEmail(email) ? "That doesn't look like an email address." : null;
  const passwordError = !password
    ? 'Enter your password.'
    : creating && password.length < MIN_PASSWORD_LENGTH
      ? `Use at least ${MIN_PASSWORD_LENGTH} characters.`
      : null;

  async function submit() {
    setSubmitted(true);
    setError(null);
    if (emailError || passwordError) return;
    setBusy(true);
    try {
      // On success the root layout swaps this screen for the app, so there is nothing to navigate
      await (creating ? signUp(email.trim(), password) : signIn(email.trim(), password));
    } catch (e) {
      const status = e instanceof ApiError ? e.status : 0;
      if (creating && status === 409) setError('There is already an account with that email. Sign in instead.');
      else setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  function switchMode() {
    setMode(creating ? 'signIn' : 'signUp');
    setSubmitted(false);
    setError(null);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen inset>
        <View style={{ gap: space.sm, marginTop: space.xxl }}>
          <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: t.panel, alignItems: 'center', justifyContent: 'center', marginBottom: space.md }}>
            <Ionicons name="wallet" size={26} color={t.panelAccent} />
          </View>
          <Text variant="title">{creating ? 'Create your account' : 'Welcome back'}</Text>
          <Text color={t.muted}>
            {creating ? 'Track what you spend by hand, or connect a bank and let it fill in.' : 'Sign in to see your accounts and budgets.'}
          </Text>
        </View>

        <View style={{ gap: space.lg }}>
          <Field label="Email" error={submitted ? emailError : null}>
            <Input
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              invalid={submitted && !!emailError}
              returnKeyType="next"
            />
          </Field>
          <Field label="Password" hint={creating ? `At least ${MIN_PASSWORD_LENGTH} characters.` : undefined} error={submitted ? passwordError : null}>
            <Input
              value={password}
              onChangeText={setPassword}
              placeholder={creating ? 'Choose a password' : 'Your password'}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete={creating ? 'new-password' : 'current-password'}
              textContentType={creating ? 'newPassword' : 'password'}
              invalid={submitted && !!passwordError}
              returnKeyType="go"
              onSubmitEditing={submit}
              trailing={
                <Pressable accessibilityRole="button" accessibilityLabel={showPassword ? 'Hide password' : 'Show password'} hitSlop={10} onPress={() => setShowPassword((v) => !v)}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={t.muted} />
                </Pressable>
              }
            />
          </Field>

          {error && <Notice tone="danger" icon="alert-circle">{error}</Notice>}

          <Button title={creating ? 'Create account' : 'Sign in'} onPress={submit} loading={busy} />
          <Button title={creating ? 'I already have an account' : 'Create an account'} variant="ghost" onPress={switchMode} disabled={busy} />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
