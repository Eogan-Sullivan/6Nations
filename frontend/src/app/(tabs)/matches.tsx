import { Feather } from '@expo/vector-icons';
import { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppScreen } from '../../components/AppScreen';
import { OverlaySurface } from '../../components/OverlaySurface';
import { Button, Label } from '../../components/ui';
import { useTheme } from '../../theme/ThemeProvider';
import { fonts, type ThemeColors } from '../../theme/tokens';

type MatchState = 'UPCOMING' | 'HALFTIME UPDATE' | 'SUNDAY UPDATE';
type Fixture = { id: string; home: string; away: string; homeScore: string; awayScore: string; kickoff: string; state: MatchState; phase: string; note: string; events: Array<{ minute: string; team: string; title: string; impact?: string }> };

const fixtures: Fixture[] = [
  { id: 'ire-eng', home: 'IRE', away: 'ENG', homeScore: '18', awayScore: '12', kickoff: 'Fri 31 Jan · 20:00', state: 'HALFTIME UPDATE', phase: 'Half-time', note: 'Synthetic halftime snapshot · Player points remain provisional.', events: [{ minute: '12′', team: 'IRE', title: 'Try · Finn Russell', impact: '+15 pts' }, { minute: '28′', team: 'ENG', title: 'Penalty · Marcus Smith', impact: '+3 pts' }, { minute: '39′', team: 'IRE', title: 'Clean line break · Hugo Keenan', impact: '+4 pts' }] },
  { id: 'fra-ita', home: 'FRA', away: 'ITA', homeScore: '—', awayScore: '—', kickoff: 'Sat 1 Feb · 14:15', state: 'UPCOMING', phase: 'Upcoming', note: 'Lineups and scoring will appear after the next published update.', events: [] },
  { id: 'sco-wal', home: 'SCO', away: 'WAL', homeScore: '27', awayScore: '22', kickoff: 'Sat 1 Feb · 16:45', state: 'SUNDAY UPDATE', phase: 'Final · provisional', note: 'Final score received. Fantasy totals await Sunday reconciliation.', events: [{ minute: '44′', team: 'SCO', title: 'Try · Blair Kinghorn', impact: '+15 pts' }, { minute: '61′', team: 'WAL', title: 'Yellow card · Preview event', impact: '−5 pts' }] },
];

export default function MatchesScreen() {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const live = fixtures[0]!;
  const [selected, setSelected] = useState<Fixture | null>(null);
  return (
    <AppScreen active="/matches" title="Match Centre" description="Follow the round as it unfolds, with every fantasy update labelled by freshness and certainty." freshness="halftime" freshnessDetail="Halftime totals are provisional">
      <View style={styles.featured}>
        <View style={styles.featuredTop}><View style={styles.statusLine}><View style={styles.previewDot} /><Text style={styles.statusText}>HALFTIME PREVIEW</Text></View><Text style={styles.freshness}>ROUND 01 · SYNTHETIC</Text></View>
        <View style={styles.scoreRow}>
          <View style={styles.team}><Text style={styles.teamCode}>{live.home}</Text><Text style={styles.teamMeta}>Home</Text></View>
          <View style={styles.score}><Text style={styles.scoreValue}>{live.homeScore} <Text style={styles.scoreDivider}>—</Text> {live.awayScore}</Text><Text style={styles.phase}>{live.phase}</Text></View>
          <View style={[styles.team, styles.teamAway]}><Text style={styles.teamCode}>{live.away}</Text><Text style={styles.teamMeta}>Away</Text></View>
        </View>
        <View style={styles.featuredFooter}><Text style={styles.featuredNote}>{live.note}</Text><Button compact variant="primary" onPress={() => setSelected(live)}>Open match</Button></View>
      </View>

      <View style={styles.sectionHeading}><View><Text style={styles.sectionTitle}>Round 01 fixtures</Text><Label muted>Tap a fixture to inspect the fantasy impact.</Label></View><View style={styles.roundBadge}><Text style={styles.roundBadgeText}>3 MATCHES</Text></View></View>
      <View style={styles.fixtureList}>
        {fixtures.map((fixture) => (
          <Pressable key={fixture.id} accessibilityRole="button" accessibilityLabel={`Open ${fixture.home} versus ${fixture.away}`} onPress={() => setSelected(fixture)} style={({ pressed }) => [styles.fixture, pressed && styles.pressed]}>
            <View style={styles.fixtureMain}><View style={[styles.fixtureStateDot, fixture.state === 'UPCOMING' && styles.fixtureStateDotUpcoming]} /><View style={styles.fixtureCopy}><Text style={styles.fixtureTitle}>{fixture.home} <Text style={styles.vs}>vs</Text> {fixture.away}</Text><Text style={styles.fixtureMeta}>{fixture.kickoff} · {fixture.phase}</Text></View></View>
            <View style={styles.fixtureAside}><Text style={fixture.state === 'UPCOMING' ? styles.stateUpcoming : styles.stateText}>{fixture.state}</Text><Feather name="chevron-right" size={17} color={c.muted} /></View>
          </Pressable>
        ))}
      </View>

      <View style={styles.trustPanel}><Feather name="info" size={17} color={c.teal} /><View style={styles.trustCopy}><Text style={styles.trustTitle}>Know what the score means</Text><Text style={styles.trustText}>Halftime points are provisional. Official totals follow the Sunday reconciliation update.</Text></View></View>

      <OverlaySurface visible={!!selected} mode="sheet" title={selected ? `${selected.home} v ${selected.away}` : undefined} onClose={() => setSelected(null)}>
        {selected && <>
          <View style={styles.detailHeader}><View><Text style={styles.detailState}>{selected.state}</Text><Text style={styles.detailScore}>{selected.homeScore} — {selected.awayScore}</Text></View><Text style={styles.detailPhase}>{selected.phase}</Text></View>
          <Text style={styles.detailNote}>{selected.note}</Text>
          <Text style={styles.timelineTitle}>Fantasy timeline</Text>
          {selected.events.length ? selected.events.map((event) => <View key={`${event.minute}-${event.title}`} style={styles.event}><Text style={styles.eventMinute}>{event.minute}</Text><View style={styles.eventDot} /><View style={styles.eventCopy}><Text style={styles.eventTitle}>{event.title}</Text><Text style={styles.eventMeta}>{event.team}</Text></View>{event.impact && <Text style={styles.eventImpact}>{event.impact}</Text>}</View>) : <View style={styles.empty}><Text style={styles.emptyTitle}>No fantasy events yet</Text><Text style={styles.emptyText}>The next published update will add performance events here.</Text></View>}
        </>}
      </OverlaySurface>
    </AppScreen>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  featured: { padding: 20, borderRadius: 18, backgroundColor: c.pitch, borderWidth: 1, borderColor: c.pitchBorder, gap: 18, shadowColor: c.shadow, shadowOpacity: 0.24, shadowRadius: 22, shadowOffset: { width: 0, height: 12 } },
  featuredTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }, statusLine: { flexDirection: 'row', alignItems: 'center', gap: 8 }, previewDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.amber }, statusText: { color: c.pitchText, fontFamily: fonts.medium, fontSize: 11, letterSpacing: 1 }, freshness: { color: c.pitchMuted, fontFamily: fonts.medium, fontSize: 10, letterSpacing: 0.9 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, team: { flex: 1, gap: 3 }, teamAway: { alignItems: 'flex-end' }, teamCode: { color: c.pitchText, fontFamily: fonts.heading, fontSize: 32, letterSpacing: 1 }, teamMeta: { color: c.pitchMuted, fontFamily: fonts.body, fontSize: 12 }, score: { alignItems: 'center', gap: 4 }, scoreValue: { color: c.pitchText, fontFamily: fonts.heading, fontSize: 29, fontVariant: ['tabular-nums'] }, scoreDivider: { color: c.pitchMuted }, phase: { color: c.amber, fontFamily: fonts.medium, fontSize: 11, letterSpacing: 0.6 },
  featuredFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 13, borderTopWidth: 1, borderTopColor: c.pitchBorder }, featuredNote: { flex: 1, color: c.pitchMuted, fontFamily: fonts.body, fontSize: 12, lineHeight: 18 }, sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 4 }, sectionTitle: { color: c.text, fontFamily: fonts.heading, fontSize: 21, lineHeight: 27 }, roundBadge: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 999, backgroundColor: c.raised }, roundBadgeText: { color: c.muted, fontFamily: fonts.medium, fontSize: 9, letterSpacing: 0.8 }, fixtureList: { gap: 8 },
  fixture: { minHeight: 76, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: c.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, fixtureMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 11 }, fixtureStateDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.amber }, fixtureStateDotUpcoming: { backgroundColor: c.muted }, fixtureCopy: { flex: 1, minWidth: 0, gap: 4 }, fixtureTitle: { color: c.text, fontFamily: fonts.heading, fontSize: 16, letterSpacing: 0.5 }, vs: { color: c.muted, fontFamily: fonts.body, fontSize: 12 }, fixtureMeta: { color: c.muted, fontFamily: fonts.body, fontSize: 12 }, fixtureAside: { flexDirection: 'row', alignItems: 'center', gap: 8 }, stateText: { color: c.amber, fontFamily: fonts.medium, fontSize: 9 }, stateUpcoming: { color: c.muted, fontFamily: fonts.medium, fontSize: 9 }, pressed: { opacity: 0.72 },
  trustPanel: { padding: 15, borderRadius: 14, backgroundColor: c.accentSoft, flexDirection: 'row', gap: 10 }, trustCopy: { flex: 1, gap: 3 }, trustTitle: { color: c.text, fontFamily: fonts.medium, fontSize: 13 }, trustText: { color: c.muted, fontFamily: fonts.body, fontSize: 12, lineHeight: 18 }, detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 }, detailState: { color: c.amber, fontFamily: fonts.medium, fontSize: 10, letterSpacing: 0.9 }, detailScore: { color: c.text, fontFamily: fonts.heading, fontSize: 34, marginTop: 5 }, detailPhase: { color: c.muted, fontFamily: fonts.body, fontSize: 12 }, detailNote: { color: c.muted, fontFamily: fonts.body, fontSize: 13, lineHeight: 20 }, timelineTitle: { color: c.text, fontFamily: fonts.heading, fontSize: 18, marginTop: 10 }, event: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: c.border }, eventMinute: { width: 32, color: c.muted, fontFamily: fonts.medium, fontSize: 11 }, eventDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.emerald }, eventCopy: { flex: 1, gap: 2 }, eventTitle: { color: c.text, fontFamily: fonts.medium, fontSize: 13 }, eventMeta: { color: c.muted, fontFamily: fonts.body, fontSize: 11 }, eventImpact: { color: c.emerald, fontFamily: fonts.medium, fontSize: 12 }, empty: { paddingVertical: 12, gap: 5 }, emptyTitle: { color: c.text, fontFamily: fonts.medium, fontSize: 14 }, emptyText: { color: c.muted, fontFamily: fonts.body, fontSize: 12, lineHeight: 18 },
});
