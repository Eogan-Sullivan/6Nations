import { AppScreen, SectionRow } from '../../components/AppScreen';
import { Button } from '../../components/ui';
import { colors as c, fonts } from '../../theme/tokens';
import { Text, View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

export default function ProfileScreen() {
  const router = useRouter();
  return (
    <AppScreen active="/profile" title="Profile" description="Manage your manager identity, preferences, and the rules behind the game.">
      <View style={styles.profile}><Text style={styles.name}>Alex’s XV</Text><Text style={styles.meta}>Demo account · local preview</Text></View>
      <SectionRow title="Rules & help" meta="Squad limits, scoring, reserves, and captaincy"><Text style={styles.open}>READ</Text></SectionRow>
      <SectionRow title="Notifications" meta="Deadline reminders and result updates"><Text style={styles.open}>OFF</Text></SectionRow>
      <SectionRow title="Account" meta="Sign in to sync across devices"><Button compact onPress={() => router.push('/sign-in')}>Sign in</Button></SectionRow>
    </AppScreen>
  );
}

const styles = StyleSheet.create({ profile: { padding: 18, backgroundColor: c.panel, borderWidth: 1, borderColor: c.border, gap: 5 }, name: { color: c.text, fontFamily: fonts.heading, fontSize: 22, lineHeight: 28 }, meta: { color: c.muted, fontFamily: fonts.body, fontSize: 14, lineHeight: 21 }, open: { color: c.emerald, fontFamily: fonts.medium, fontSize: 11, letterSpacing: 0.8 } });
