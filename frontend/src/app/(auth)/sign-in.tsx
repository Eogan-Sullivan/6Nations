import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Label } from '../../components/ui';
import { useAuth } from '../../features/auth/AuthProvider';
import { fonts, type ThemeColors } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeProvider';

export default function SignInScreen() {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const router = useRouter();
  const { configured, loading: authLoading, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setMessage(null);
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setError('Enter your email and password to continue.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'signIn') {
        await signIn(normalizedEmail, password);
      } else {
        const result = await signUp(normalizedEmail, password);
        setMessage(result.confirmationRequired ? 'Check your inbox to confirm your email, then sign in.' : 'Account created. Your season entry is ready to set up.');
        if (!result.confirmationRequired) router.replace('/onboarding');
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'We could not complete that request.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
      <View style={styles.panel}>
        <Text style={styles.kicker}>6NATIONS · 2027</Text>
        <Text accessibilityRole="header" style={styles.title}>{mode === 'signIn' ? 'Keep your XV across devices.' : 'Create your season account.'}</Text>
        <Label muted>{configured ? 'Sign in to save your squad, join private leagues, and keep your season entry with you.' : 'Authentication is not configured in this preview build. You can still explore the demo.'}</Label>
        {configured && <View style={styles.form}>
          <Text style={styles.fieldLabel}>Email</Text>
          <TextInput accessibilityLabel="Email" autoCapitalize="none" autoComplete="email" keyboardType="email-address" enterKeyHint="next" onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor={c.muted} style={styles.input} textContentType="emailAddress" value={email} />
          <Text style={styles.fieldLabel}>Password</Text>
          <TextInput accessibilityLabel="Password" autoCapitalize="none" autoComplete={mode === 'signUp' ? 'new-password' : 'password'} enterKeyHint="done" onChangeText={setPassword} onSubmitEditing={() => void submit()} placeholder={mode === 'signUp' ? 'At least 6 characters' : 'Password'} placeholderTextColor={c.muted} secureTextEntry style={styles.input} textContentType={mode === 'signUp' ? 'newPassword' : 'password'} value={password} />
          {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
          {message && <Text accessibilityRole="text" style={styles.message}>{message}</Text>}
          <Button loading={busy || authLoading} onPress={() => void submit()} variant="primary">{mode === 'signIn' ? 'Sign in' : 'Create account'}</Button>
          {mode === 'signIn' && <Pressable accessibilityRole="button" onPress={() => router.push('/forgot-password')}>
            <Text style={styles.forgot}>Forgot password?</Text>
          </Pressable>}
          <Pressable accessibilityRole="button" onPress={() => { setMode(mode === 'signIn' ? 'signUp' : 'signIn'); setError(null); setMessage(null); }}>
            <Text style={styles.switchMode}>{mode === 'signIn' ? 'New here? Create an account' : 'Already have an account? Sign in'}</Text>
          </Pressable>
        </View>}
        {!configured && <>
          <ActivityIndicator accessibilityLabel="Demo mode" color={c.emerald} />
          <Button onPress={() => router.replace('/squad')}>Continue in demo mode</Button>
        </>}
      </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.bg }, scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  panel: { width: '100%', maxWidth: 520, alignSelf: 'center', padding: 24, backgroundColor: c.panel, borderWidth: 1, borderColor: c.border, gap: 16 },
  kicker: { color: c.emerald, fontFamily: fonts.medium, fontSize: 11, letterSpacing: 1.2 },
  title: { color: c.text, fontFamily: fonts.heading, fontSize: 34, lineHeight: 40 },
  form: { gap: 12 },
  fieldLabel: { color: c.text, fontFamily: fonts.medium, fontSize: 13, marginBottom: -5 },
  input: { minHeight: 48, borderWidth: 1, borderColor: c.border, borderRadius: 4, backgroundColor: c.inputBackground, color: c.text, paddingHorizontal: 14, fontFamily: fonts.body, fontSize: 16 },
  error: { color: c.danger, fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
  message: { color: c.emerald, fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
  switchMode: { color: c.teal, fontFamily: fonts.medium, fontSize: 13, textAlign: 'center', paddingVertical: 8 },
  forgot: { color: c.muted, fontFamily: fonts.body, fontSize: 13, textAlign: 'center', paddingVertical: 4 },
});
