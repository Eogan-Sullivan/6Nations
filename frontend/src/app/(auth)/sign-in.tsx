import { useRouter } from 'expo-router';
import { Text, View, StyleSheet } from 'react-native';
import { Button, Label } from '../../components/ui';
import { colors as c, fonts } from '../../theme/tokens';

export default function SignInScreen() {
  const router = useRouter();
  return (
    <View style={styles.screen}>
      <View style={styles.panel}>
        <Text style={styles.kicker}>6Nations · 2027</Text>
        <Text accessibilityRole="header" style={styles.title}>Keep your XV across devices.</Text>
        <Label muted>Authentication is represented by this frontend preview. Continue to onboarding to explore the first-run flow.</Label>
        <Button variant="primary" onPress={() => router.push('/onboarding')}>Continue with email link</Button>
        <Button onPress={() => router.replace('/squad')}>Stay in demo mode</Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: c.bg, justifyContent: 'center', padding: 20 }, panel: { width: '100%', maxWidth: 520, alignSelf: 'center', padding: 24, backgroundColor: c.panel, borderWidth: 1, borderColor: c.border, gap: 16 }, kicker: { color: c.emerald, fontFamily: fonts.medium, fontSize: 11, letterSpacing: 1.2 }, title: { color: c.text, fontFamily: fonts.heading, fontSize: 34, lineHeight: 40 }, });
