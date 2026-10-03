import { AppScreen, SectionRow } from '../../components/AppScreen';
import { colors as c, fonts } from '../../theme/tokens';
import { Text, View, StyleSheet } from 'react-native';
import { mockStats } from '../../api/mock';

export default function StatsScreen() {
  return (
    <AppScreen active="/stats" title="Stats & Fixtures" description="Explore the calendar and player numbers without confusing a preview with an official result.">
      <View style={styles.filter}><Text style={styles.filterText}>ROUND 01</Text><Text style={styles.filterMeta}>SYNTHETIC PREVIEW</Text></View>
      <View style={styles.list}>{mockStats.map((stat) => <SectionRow key={stat.title} title={stat.title} meta={stat.meta}><Text style={styles.open}>OPEN</Text></SectionRow>)}</View>
      <Text style={styles.note}>Unknown statistics are displayed as unknown, never silently converted to zero.</Text>
    </AppScreen>
  );
}

const styles = StyleSheet.create({ filter: { padding: 16, backgroundColor: c.raised, flexDirection: 'row', justifyContent: 'space-between', gap: 10 }, filterText: { color: c.text, fontFamily: fonts.medium, fontSize: 12, letterSpacing: 1 }, filterMeta: { color: c.amber, fontFamily: fonts.medium, fontSize: 11, letterSpacing: 0.8 }, list: { gap: 8 }, open: { color: c.emerald, fontFamily: fonts.medium, fontSize: 11, letterSpacing: 0.8 }, note: { color: c.muted, fontFamily: fonts.body, fontSize: 13, lineHeight: 20 } });
