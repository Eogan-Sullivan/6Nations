import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Button, Label } from '../../components/ui';
import { useAuth } from '../../features/auth/AuthProvider';
import { fonts, type ThemeColors } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeProvider';

export default function OnboardingScreen() {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const router = useRouter();
  const { session, completeOnboarding } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [displayName, setDisplayName] = useState(() => session?.user.user_metadata?.display_name ?? '');
  const [reminders, setReminders] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function finish() {
    const name = displayName.trim();
    if (!name) {
      setStep(1);
      setError('Add a display name so your league mates know who you are.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await completeOnboarding(name, reminders);
      router.replace('/squad');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'We could not save your preferences.');
    } finally {
      setBusy(false);
    }
  }

  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}><ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled"><View style={styles.panel}>
    <Text style={styles.step}>STEP {step} OF 2 · SEASON ENTRY</Text>
    {step === 1 ? <>
      <Text accessibilityRole="header" style={styles.title}>Make it yours.</Text>
      <Label muted>Choose the name your league mates will see. You can change it later from your profile.</Label>
      <Text style={styles.fieldLabel}>Display name</Text><TextInput accessibilityLabel="Display name" autoCapitalize="words" autoComplete="name" enterKeyHint="next" onChangeText={setDisplayName} onSubmitEditing={() => { if (displayName.trim()) setStep(2); }} placeholder="Your display name" placeholderTextColor={c.muted} style={styles.input} value={displayName} />
      {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      <View style={styles.preference}>
        <View style={styles.preferenceCopy}><Text style={styles.preferenceTitle}>Deadline reminders</Text><Text style={styles.preferenceMeta}>Get a nudge before your squad locks.</Text></View>
        <Switch accessibilityLabel="Deadline reminders" onValueChange={setReminders} thumbColor={reminders ? c.onAccent : c.muted} trackColor={{ false: c.elevated, true: c.emerald }} value={reminders} />
      </View>
      <Button variant="primary" onPress={() => { if (!displayName.trim()) setError('Add a display name so your league mates know who you are.'); else { setError(null); setStep(2); } }}>Continue</Button>
      <Button onPress={() => void finish()}>Skip for now</Button>
    </> : <>
      <Text accessibilityRole="header" style={styles.title}>Build a legal XV.</Text>
      <Label muted>Choose 15 starters and three ordered reserves within 100 credits. Pick a captain and vice-captain. We will explain each rule as it matters.</Label>
      <View style={styles.rules}><Text style={styles.rule}>18 players · eight rugby positions</Text><Text style={styles.rule}>Maximum four players per nation</Text><Text style={styles.rule}>Captain scores twice when they play</Text></View>
      {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      <Button loading={busy} variant="primary" onPress={() => void finish()}>Start my squad</Button>
      <Button disabled={busy} onPress={() => setStep(1)}>Back</Button>
    </>}
  </View></ScrollView></KeyboardAvoidingView>;
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.bg }, scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  panel: { width: '100%', maxWidth: 560, alignSelf: 'center', padding: 24, backgroundColor: c.panel, borderWidth: 1, borderColor: c.border, gap: 16 },
  step: { color: c.emerald, fontFamily: fonts.medium, fontSize: 11, letterSpacing: 1.2 },
  title: { color: c.text, fontFamily: fonts.heading, fontSize: 36, lineHeight: 42 },
  fieldLabel: { color: c.text, fontFamily: fonts.medium, fontSize: 13, marginBottom: -5 }, input: { minHeight: 48, borderWidth: 1, borderColor: c.border, borderRadius: 4, backgroundColor: c.inputBackground, color: c.text, paddingHorizontal: 14, fontFamily: fonts.body, fontSize: 16 },
  preference: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: 16, backgroundColor: c.raised },
  preferenceCopy: { flex: 1, gap: 4 },
  preferenceTitle: { color: c.text, fontFamily: fonts.medium, fontSize: 14 },
  preferenceMeta: { color: c.muted, fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
  rules: { padding: 16, backgroundColor: c.raised, gap: 9 },
  rule: { color: c.text, fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  error: { color: c.danger, fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
});
