import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Label } from '../../components/ui';
import { useAuth } from '../../features/auth/AuthProvider';
import { fonts, type ThemeColors } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeProvider';

export default function ForgotPasswordScreen() {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const router = useRouter();
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const normalizedEmail = email.trim().toLowerCase();
    setError(null);
    if (!normalizedEmail) {
      setError('Enter the email address on your account.');
      return;
    }
    setBusy(true);
    try {
      await requestPasswordReset(normalizedEmail);
      setSent(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'We could not send a reset email.');
    } finally {
      setBusy(false);
    }
  }

  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}><ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled"><View style={styles.panel}>
    <Text style={styles.kicker}>ACCOUNT RECOVERY</Text>
    <Text accessibilityRole="header" style={styles.title}>Reset your password.</Text>
    <Label muted>{sent ? 'If an account exists for that email, a reset link is on its way. Check your inbox and spam folder.' : 'Enter your account email and we will send you a secure reset link.'}</Label>
    {!sent && <>
      <Text style={styles.fieldLabel}>Email</Text><TextInput accessibilityLabel="Email" autoCapitalize="none" autoComplete="email" keyboardType="email-address" enterKeyHint="send" onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor={c.muted} style={styles.input} textContentType="emailAddress" value={email} />
      {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      <Button loading={busy} onPress={() => void submit()} variant="primary">Send reset link</Button>
    </>}
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
