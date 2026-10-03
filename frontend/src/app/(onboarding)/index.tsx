import { useRouter } from 'expo-router';
import { Text, View, StyleSheet } from 'react-native';
import { Button, Label } from '../../components/ui';
import { colors as c, fonts } from '../../theme/tokens';

export default function OnboardingScreen() {
  const router = useRouter();
  return (
    <View style={styles.screen}>
      <View style={styles.panel}>
        <Text style={styles.step}>STEP 1 OF 2 · SEASON ENTRY</Text>
        <Text accessibilityRole="header" style={styles.title}>Build a legal XV.</Text>
        <Label muted>Choose 15 starters and three ordered reserves within 100 credits. Pick a captain and vice-captain. We will explain each rule as it matters.</Label>
        <View style={styles.rules}><Text style={styles.rule}>18 players · eight rugby positions</Text><Text style={styles.rule}>Maximum four players per nation</Text><Text style={styles.rule}>Captain scores twice when they play</Text></View>
        <Button variant="primary" onPress={() => router.replace('/squad')}>Start my squad</Button>
        <Button onPress={() => router.replace('/squad')}>Skip for now</Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: c.bg, justifyContent: 'center', padding: 20 }, panel: { width: '100%', maxWidth: 560, alignSelf: 'center', padding: 24, backgroundColor: c.panel, borderWidth: 1, borderColor: c.border, gap: 16 }, step: { color: c.emerald, fontFamily: fonts.medium, fontSize: 11, letterSpacing: 1.2 }, title: { color: c.text, fontFamily: fonts.heading, fontSize: 36, lineHeight: 42 }, rules: { padding: 16, backgroundColor: c.raised, gap: 9 }, rule: { color: c.text, fontFamily: fonts.body, fontSize: 14, lineHeight: 20 } });
