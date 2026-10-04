import { useTheme } from '../../theme/ThemeProvider';
import { useMemo } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, View, StyleSheet } from 'react-native';
import { Button, Label } from '../../components/ui';
import { fonts, type ThemeColors } from '../../theme/tokens';

export default function InviteScreen() {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code: string }>();
  return (
    <View style={styles.screen}>
      <View style={styles.panel}>
        <Text style={styles.kicker}>LEAGUE INVITE</Text>
        <Text accessibilityRole="header" style={styles.title}>You’re invited.</Text>
        <Label muted>Invite code {code ?? 'UNKNOWN'} is represented in this preview. Sign in first, then return here to join without losing your destination.</Label>
        <Button variant="primary" onPress={() => router.push('/sign-in')}>Sign in to join</Button>
        <Button onPress={() => router.replace('/leagues')}>View leagues</Button>
      </View>
    </View>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({ screen: { flex: 1, backgroundColor: c.bg, justifyContent: 'center', padding: 20 }, panel: { width: '100%', maxWidth: 520, alignSelf: 'center', padding: 24, backgroundColor: c.panel, borderWidth: 1, borderColor: c.border, gap: 16 }, kicker: { color: c.amber, fontFamily: fonts.medium, fontSize: 11, letterSpacing: 1.2 }, title: { color: c.text, fontFamily: fonts.heading, fontSize: 36, lineHeight: 42 } });
