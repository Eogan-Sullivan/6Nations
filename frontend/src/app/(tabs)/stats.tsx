import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppScreen } from '../../components/AppScreen';
import { MetricStrip, StatusBanner } from '../../components/status';
import { Button } from '../../components/ui';
import { useTheme } from '../../theme/ThemeProvider';
import { fonts, type ThemeColors } from '../../theme/tokens';

const leaderboards = {
  'Fantasy points': [['Finn Byrne', '64'], ['Louis Moreau', '58'], ['Oliver Bennett', '52'], ['Callum Fraser', '49']],
  'Form': [['Matteo Rossi', '8.4'], ['Dylan Morgan', '8.1'], ['Finn Byrne', '7.9'], ['Louis Moreau', '7.6']],
  'Appearances': [['Finn Byrne', '4'], ['Oliver Bennett', '4'], ['Callum Fraser', '3'], ['Dylan Morgan', '3']],
};
type Category = keyof typeof leaderboards;

export default function StatsScreen() {
  const { colors: c } = useTheme();
  const s = useMemo(() => makeStyles(c), [c]);
  const [category, setCategory] = useState<Category>('Fantasy points');
  return <AppScreen active="/stats" title="Stats & Fixtures" description="Read the round in one place. Preview numbers stay visibly separate from official data." freshness="incomplete" freshnessDetail="Official points are not published">
    <View style={s.roundRow}><View><Text style={s.roundTitle}>Round 01</Text><Text style={s.roundMeta}>31 Jan – 2 Feb · three fixtures</Text></View><Button compact disabled onPress={() => {}}>Round 02 pending</Button></View>
    <MetricStrip items={[{ value: '3', label: 'FIXTURES' }, { value: '18', label: 'PLAYERS IN POOL' }, { value: '—', label: 'OFFICIAL POINTS', tone: c.amber }]} />
    <View style={s.fixtureHeader}><Text style={s.sectionTitle}>Fixture calendar</Text><Text style={s.sectionMeta}>Kickoffs shown in local tournament time</Text></View>
    <View style={s.fixtures}>{[['IRE', 'ENG', 'Fri 31 Jan · 20:00', 'Halftime snapshot'], ['FRA', 'ITA', 'Sat 1 Feb · 14:15', 'Upcoming'], ['SCO', 'WAL', 'Sat 1 Feb · 16:45', 'Sunday update']].map(([home, away, date, state]) => <View key={`${home}-${away}`} style={s.fixture}><Text style={s.team}>{home}</Text><Text style={s.vs}>v</Text><Text style={s.team}>{away}</Text><View style={s.fixtureInfo}><Text style={s.fixtureDate}>{date}</Text><Text style={s.fixtureState}>{state}</Text></View></View>)}</View>
    <View style={s.leaderHeader}><View><Text style={s.sectionTitle}>Player leaderboard</Text><Text style={s.sectionMeta}>Synthetic values to explore the view</Text></View><StatusBanner status="demo" compact /></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabs}>{(Object.keys(leaderboards) as Category[]).map((item) => <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected: category === item }} onPress={() => setCategory(item)} style={[s.tab, category === item && s.tabSelected]}><Text style={[s.tabText, category === item && s.tabTextSelected]}>{item}</Text></Pressable>)}</ScrollView>
    <View style={s.leaderboard}>{leaderboards[category].map(([name, value], index) => <View key={name} style={s.leaderRow}><Text style={s.leaderRank}>{index + 1}</Text><Text style={s.leaderName}>{name}</Text><Text style={s.leaderValue}>{value}<Text style={s.unit}>{category === 'Form' ? ' / 10' : category === 'Appearances' ? ' apps' : ' pts'}</Text></Text></View>)}</View>
    <View style={s.note}><Text style={s.noteTitle}>Unknown stays unknown</Text><Text style={s.noteText}>When the authorised feed has not published a value, the app leaves it blank or marks it unpublished. It never turns missing data into zero.</Text></View>
  </AppScreen>;
}
const makeStyles = (c: ThemeColors) => StyleSheet.create({ roundRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }, roundTitle: { color: c.text, fontFamily: fonts.heading, fontSize: 26 }, roundMeta: { color: c.muted, fontFamily: fonts.body, fontSize: 13, marginTop: 4 }, sectionTitle: { color: c.text, fontFamily: fonts.heading, fontSize: 21 }, sectionMeta: { color: c.muted, fontFamily: fonts.body, fontSize: 12, marginTop: 4 }, fixtureHeader: { marginTop: 8 }, fixtures: { borderTopWidth: 1, borderTopColor: c.border }, fixture: { minHeight: 62, borderBottomWidth: 1, borderBottomColor: c.border, flexDirection: 'row', alignItems: 'center', gap: 8 }, team: { width: 35, color: c.text, fontFamily: fonts.heading, fontSize: 16 }, vs: { color: c.muted, fontFamily: fonts.body, fontSize: 12 }, fixtureInfo: { flex: 1, marginLeft: 8, gap: 3 }, fixtureDate: { color: c.text, fontFamily: fonts.body, fontSize: 13 }, fixtureState: { color: c.amber, fontFamily: fonts.medium, fontSize: 10 }, leaderHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginTop: 8 }, tabs: { gap: 7, paddingVertical: 14 }, tab: { minHeight: 40, paddingHorizontal: 12, justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: c.border }, tabSelected: { borderBottomColor: c.emerald }, tabText: { color: c.muted, fontFamily: fonts.medium, fontSize: 12 }, tabTextSelected: { color: c.emerald }, leaderboard: { borderTopWidth: 1, borderTopColor: c.border }, leaderRow: { minHeight: 58, borderBottomWidth: 1, borderBottomColor: c.border, flexDirection: 'row', alignItems: 'center', gap: 12 }, leaderRank: { width: 22, color: c.muted, fontFamily: fonts.heading, fontSize: 16, textAlign: 'center' }, leaderName: { flex: 1, color: c.text, fontFamily: fonts.medium, fontSize: 14 }, leaderValue: { color: c.text, fontFamily: fonts.heading, fontSize: 16, fontVariant: ['tabular-nums'] }, unit: { color: c.muted, fontFamily: fonts.body, fontSize: 11 }, note: { padding: 14, backgroundColor: c.accentSoft, gap: 5 }, noteTitle: { color: c.text, fontFamily: fonts.medium, fontSize: 13 }, noteText: { color: c.muted, fontFamily: fonts.body, fontSize: 12, lineHeight: 18 } });
