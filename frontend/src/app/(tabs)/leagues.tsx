import { AppScreen, SectionRow, EmptyState } from '../../components/AppScreen';
import { Button } from '../../components/ui';
import { colors as c, fonts } from '../../theme/tokens';
import { Text, View, StyleSheet } from 'react-native';
import { mockLeagues } from '../../api/mock';

export default function LeaguesScreen() {
  return (
    <AppScreen active="/leagues" title="Leagues" description="Create a private table, join friends, and compare confirmed round results.">
      <View style={styles.actions}><Button variant="primary" disabled label="Create league is unavailable in demo mode" onPress={() => {}}>DEMO ONLY</Button><Button disabled label="Join with invite is unavailable in demo mode" onPress={() => {}}>DEMO ONLY</Button></View>
      {mockLeagues.map((league) => <SectionRow key={league.title} title={league.title} meta={league.meta}><Text style={styles.rank}>{league.rank}</Text></SectionRow>)}
      <EmptyState title="Invites stay with you" copy="Open an invite link, sign in, and you will return here ready to join. Future squad selections remain private until the round is locked." />
    </AppScreen>
  );
}

const styles = StyleSheet.create({ actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, rank: { color: c.emerald, fontFamily: fonts.medium, fontSize: 11, letterSpacing: 0.8 } });
