import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Label } from '../../components/ui';
import { useAuth } from '../../features/auth/AuthProvider';
import { supabase } from '../../lib/supabase/client';
import { fonts, type ThemeColors } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeProvider';

async function setSessionFromRecoveryUrl(url: string) {
  if (!supabase) return false;
  const hash = new URL(url).hash.slice(1);
  const params = new URLSearchParams(hash);
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (!accessToken || !refreshToken) return false;
  const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  if (error) throw error;
  return true;
}

export default function ResetPasswordScreen() {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const router = useRouter();
  const { session, updatePassword } = useAuth();
  const [ready, setReady] = useState(Boolean(session));
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    const handleUrl = (url: string) => {
      void setSessionFromRecoveryUrl(url).then((recovered) => {
        if (mounted && recovered) setReady(true);
      }).catch((caught: unknown) => {
        if (mounted) setError(caught instanceof Error ? caught.message : 'This reset link is invalid or expired.');
      });
    };
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (mounted && event === 'PASSWORD_RECOVERY') setReady(true);
    });
    void Linking.getInitialURL().then((url) => { if (url) handleUrl(url); });
    const urlSubscription = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => { mounted = false; data.subscription.unsubscribe(); urlSubscription.remove(); };
  }, []);

  async function submit() {
    setError(null);
    if (password.length < 6) { setError('Use at least 6 characters for your new password.'); return; }
    if (password !== confirmation) { setError('The passwords do not match.'); return; }
    setBusy(true);
    try {
      await updatePassword(password);
      router.replace('/onboarding');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'We could not update your password.');
    } finally { setBusy(false); }
  }

  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}><ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled"><View style={styles.panel}>
    <Text style={styles.kicker}>ACCOUNT RECOVERY</Text>
    <Text accessibilityRole="header" style={styles.title}>Choose a new password.</Text>
    {!ready ? <Label muted>Open the reset link from your email to continue. The link may expire for security.</Label> : <>
      <Text style={styles.fieldLabel}>New password</Text><TextInput accessibilityLabel="New password" autoCapitalize="none" autoComplete="new-password" enterKeyHint="next" onChangeText={setPassword} placeholder="At least 6 characters" placeholderTextColor={c.muted} secureTextEntry style={styles.input} textContentType="newPassword" value={password} />
      <Text style={styles.fieldLabel}>Confirm new password</Text><TextInput accessibilityLabel="Confirm new password" autoCapitalize="none" autoComplete="new-password" enterKeyHint="done" onChangeText={setConfirmation} onSubmitEditing={() => void submit()} placeholder="Repeat your password" placeholderTextColor={c.muted} secureTextEntry style={styles.input} textContentType="newPassword" value={confirmation} />
      {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      <Button loading={busy} onPress={() => void submit()} variant="primary">Update password</Button>
    </>}
    {!ready && error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    <Button onPress={() => router.replace('/sign-in')}>Back to sign in</Button>
  </View></ScrollView></KeyboardAvoidingView>;
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.bg }, scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  panel: { width: '100%', maxWidth: 520, alignSelf: 'center', padding: 24, backgroundColor: c.panel, borderWidth: 1, borderColor: c.border, gap: 16 },
  kicker: { color: c.emerald, fontFamily: fonts.medium, fontSize: 11, letterSpacing: 1.2 },
  title: { color: c.text, fontFamily: fonts.heading, fontSize: 34, lineHeight: 40 },
  fieldLabel: { color: c.text, fontFamily: fonts.medium, fontSize: 13, marginBottom: -5 }, input: { minHeight: 48, borderWidth: 1, borderColor: c.border, borderRadius: 4, backgroundColor: c.inputBackground, color: c.text, paddingHorizontal: 14, fontFamily: fonts.body, fontSize: 16 },
  error: { color: c.danger, fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
});
