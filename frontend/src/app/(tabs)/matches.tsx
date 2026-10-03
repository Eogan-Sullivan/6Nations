import { AppScreen, SectionRow } from '../../components/AppScreen';
import { Button } from '../../components/ui';
import { colors as c, fonts } from '../../theme/tokens';
import { Text, View, StyleSheet } from 'react-native';
import { mockFixtures } from '../../api/mock';

export default function MatchesScreen() {
  return (
    <AppScreen active="/matches" title="Match Centre" description="Follow the round and understand exactly how fresh each fantasy snapshot is.">
      <View style={styles.list}>
        {mockFixtures.map((fixture) => (
          <SectionRow key={fixture.title} title={fixture.title} meta={fixture.meta}>
            <View style={styles.status}><Text style={styles.statusText}>{fixture.status}</Text><Button compact disabled label="Synthetic preview only" onPress={() => {}}>PREVIEW</Button></View>
          </SectionRow>
        ))}
      </View>
      <View style={styles.detail}>
        <Text style={styles.detailTitle}>Round 01 scoring preview</Text>
        <Text style={styles.copy}>Synthetic player scores may be incomplete. Unknown statistics stay unknown; provisional totals do not become official until a published server result exists.</Text>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({ list: { gap: 8 }, status: { alignItems: 'flex-end', gap: 7 }, statusText: { color: c.amber, fontFamily: fonts.medium, fontSize: 11, letterSpacing: 0.8 }, detail: { padding: 18, backgroundColor: c.pitch, borderWidth: 1, borderColor: c.line, gap: 8 }, detailTitle: { color: c.text, fontFamily: fonts.heading, fontSize: 19, lineHeight: 24 }, copy: { color: c.muted, fontFamily: fonts.body, fontSize: 14, lineHeight: 21 } });
