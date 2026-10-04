import { useTheme } from '../../theme/ThemeProvider';
import { useMemo } from 'react';
import { AppScreen, SectionRow } from '../../components/AppScreen';
import { MetricStrip, StatusBanner } from '../../components/status';
import { Button } from '../../components/ui';
import { fonts, type ThemeColors } from '../../theme/tokens';
import { Text, View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { OverlaySurface } from '../../components/OverlaySurface';
import { useState } from 'react';

export default function ProfileScreen() {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const router = useRouter();
  const [showRules, setShowRules] = useState(false);
  return (
    <AppScreen active="/profile" title="Profile" description="Your season at a glance, with sync and reminder choices kept clear." freshness="offline" freshnessDetail="Local preview only">
      <View style={styles.profile}><View><Text style={styles.name}>Alex’s XV</Text><Text style={styles.meta}>Demo manager · local preview</Text></View><StatusBanner status="offline" compact /></View>
      <MetricStrip items={[{ value: '—', label: 'OVERALL RANK' }, { value: '0', label: 'SEASON POINTS' }, { value: '1/5', label: 'ROUNDS CONFIRMED' }]} />
      <View style={styles.season}><Text style={styles.seasonTitle}>Round 01 is waiting</Text><Text style={styles.seasonCopy}>Confirm your starting XV before Fri 31 Jan, 19:30. Reminders will be available when account sync is connected.</Text><Button variant="primary" onPress={() => router.push('/squad')}>Review my squad</Button></View>
      <SectionRow title="Rules & help" meta="Squad limits, scoring, reserves, and captaincy"><Button compact onPress={() => setShowRules(true)}>View rules</Button></SectionRow>
      <SectionRow title="Notifications" meta="Deadline reminders and result updates"><Text style={styles.open}>NOT CONNECTED</Text></SectionRow>
      <SectionRow title="Account" meta="Sign in to sync across devices"><Button compact onPress={() => router.push('/sign-in')}>Sign in</Button></SectionRow>
      <OverlaySurface visible={showRules} title="Rules & help" onClose={() => setShowRules(false)}>
        <Text style={styles.rulesHeading}>Build an 18-player squad</Text>
        <Text style={styles.rulesCopy}>Pick 15 starters and three reserves within the 100.0 credit budget. No nation can contribute more than four players.</Text>
        <Text style={styles.rulesHeading}>Captaincy</Text>
        <Text style={styles.rulesCopy}>Choose one captain and one vice-captain from your starting XV. Captain points are doubled when official scoring is connected.</Text>
        <Text style={styles.rulesHeading}>Preview data</Text>
        <Text style={styles.rulesCopy}>This build uses synthetic player and match data. Nothing is submitted to the game server.</Text>
      </OverlaySurface>
    </AppScreen>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({ profile: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: c.border, gap: 5, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, name: { color: c.text, fontFamily: fonts.heading, fontSize: 22, lineHeight: 28 }, meta: { color: c.muted, fontFamily: fonts.body, fontSize: 14, lineHeight: 21 }, open: { color: c.muted, fontFamily: fonts.medium, fontSize: 11 }, season: { padding: 18, backgroundColor: c.pitch, borderWidth: 1, borderColor: c.pitchBorder, gap: 9 }, seasonTitle: { color: c.pitchText, fontFamily: fonts.heading, fontSize: 22 }, seasonCopy: { color: c.pitchMuted, fontFamily: fonts.body, fontSize: 13, lineHeight: 20 }, rulesHeading: { color: c.text, fontFamily: fonts.heading, fontSize: 18, lineHeight: 24 }, rulesCopy: { color: c.muted, fontFamily: fonts.body, fontSize: 15, lineHeight: 23 } });
