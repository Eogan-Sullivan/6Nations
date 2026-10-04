import { Feather } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { AppScreen } from '../../components/AppScreen';
import { Button } from '../../components/ui';
import { OverlaySurface } from '../../components/OverlaySurface';
import { MetricStrip } from '../../components/status';
import { useTheme } from '../../theme/ThemeProvider';
import { fonts, type ThemeColors } from '../../theme/tokens';

const members = [
  { name: 'Alex’s XV', points: '—', movement: 'You', rank: 1 },
  { name: 'The Scrum Club', points: '—', movement: '—', rank: 2 },
  { name: 'Celtic Thunder', points: '—', movement: '—', rank: 3 },
  { name: 'Backs Against the Wall', points: '—', movement: '—', rank: 4 },
];

export default function LeaguesScreen() {
  const { colors: c } = useTheme();
  const s = useMemo(() => makeStyles(c), [c]);
  const { width } = useWindowDimensions();
  const [showJoin, setShowJoin] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [code, setCode] = useState('');
  const [rotated, setRotated] = useState(false);
  const invite = rotated ? 'R7K2QM' : 'N6F4XP';
  return <AppScreen active="/leagues" title="Leagues" description="Keep the season close. Private standings update when round scores are official." freshness="incomplete" freshnessDetail="Standings await official scoring">
    <View style={[s.hero, width < 520 && s.heroNarrow]}><View style={s.heroTitle}><Text style={s.heroHeading}>The home table</Text><Text style={s.heroCopy}>A private league for the people who know your rugby habits best.</Text></View><View style={s.invite}><Text style={s.inviteLabel}>INVITE CODE</Text><Text style={s.inviteCode}>{invite}</Text><Pressable accessibilityRole="button" accessibilityLabel="Rotate invite code" onPress={() => setRotated(true)}><Text style={s.rotate}>Rotate code</Text></Pressable></View></View>
    <MetricStrip items={[{ value: '1st', label: 'CURRENT RANK', tone: c.emerald }, { value: '—', label: 'ROUND POINTS' }, { value: '4', label: 'MEMBERS' }]} />
    <View style={s.actions}><Button variant="primary" onPress={() => setShowCreate(true)}>Create league</Button><Button onPress={() => setShowJoin(true)}>Join with code</Button></View>
    <View style={s.sectionHead}><View><Text style={s.sectionTitle}>Round 01 standings</Text><Text style={s.sectionMeta}>Rank movement appears after official reconciliation.</Text></View><Text style={s.status}>PROVISIONAL</Text></View>
    <View style={s.table}>{members.map((member) => <View key={member.name} style={[s.row, member.rank === 1 && s.youRow]}><Text style={s.rank}>{member.rank}</Text><View style={s.member}><Text style={s.memberName}>{member.name}</Text><Text style={s.memberMeta}>{member.movement === 'You' ? 'Your team' : 'Manager'}</Text></View><Text style={s.points}>{member.points}<Text style={s.pointsUnit}> pts</Text></Text><Feather name="minus" size={15} color={c.muted} /></View>)}</View>
    <View style={s.note}><Feather name="lock" size={15} color={c.teal} /><Text style={s.noteCopy}>Only confirmed squads count. League changes are disabled during the lock window.</Text></View>
    <OverlaySurface visible={showJoin} mode="dialog" title="Join a league" onClose={() => setShowJoin(false)}><Text style={s.dialogCopy}>Enter the six-character invite code from your league owner.</Text><Text style={s.fieldLabel}>Invite code</Text><TextInput accessibilityLabel="League invite code" value={code} onChangeText={(value) => setCode(value.replace(/[^a-z0-9]/gi, '').slice(0, 6).toUpperCase())} autoCapitalize="characters" enterKeyHint="done" maxLength={6} placeholder="N6F4XP" placeholderTextColor={c.muted} style={s.codeInput} /><Button variant="primary" disabled={code.length !== 6} onPress={() => { setShowJoin(false); setCode(''); }}>Join league</Button></OverlaySurface>
    <OverlaySurface visible={showCreate} mode="dialog" title="Create a league" onClose={() => setShowCreate(false)}><Text style={s.dialogCopy}>Your private league is ready to share. The invite code below expires only when you rotate it.</Text><View style={s.created}><Text style={s.inviteLabel}>YOUR INVITE CODE</Text><Text style={s.inviteCode}>{invite}</Text></View><Button variant="primary" onPress={() => setShowCreate(false)}>Done</Button></OverlaySurface>
  </AppScreen>;
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  hero: { flexDirection: 'row', gap: 18, alignItems: 'stretch' }, heroNarrow: { flexDirection: 'column' }, heroTitle: { flex: 1, justifyContent: 'center', gap: 8 }, heroHeading: { color: c.text, fontFamily: fonts.heading, fontSize: 27 }, heroCopy: { color: c.muted, fontFamily: fonts.body, fontSize: 14, lineHeight: 21, maxWidth: 460 }, invite: { width: 150, padding: 14, backgroundColor: c.pitch, borderWidth: 1, borderColor: c.pitchBorder, gap: 5 }, inviteLabel: { color: c.pitchMuted, fontFamily: fonts.medium, fontSize: 10, letterSpacing: .8 }, inviteCode: { color: c.pitchText, fontFamily: fonts.heading, fontSize: 20, letterSpacing: 1.4 }, rotate: { color: c.amber, fontFamily: fonts.medium, fontSize: 11 }, actions: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' }, sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, marginTop: 8 }, sectionTitle: { color: c.text, fontFamily: fonts.heading, fontSize: 21 }, sectionMeta: { color: c.muted, fontFamily: fonts.body, fontSize: 12, marginTop: 4 }, status: { color: c.amber, fontFamily: fonts.medium, fontSize: 10 }, table: { borderTopWidth: 1, borderTopColor: c.border }, row: { minHeight: 66, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.border, flexDirection: 'row', alignItems: 'center', gap: 12 }, youRow: { backgroundColor: c.accentSoft }, rank: { width: 24, textAlign: 'center', color: c.muted, fontFamily: fonts.heading, fontSize: 17 }, member: { flex: 1, gap: 3 }, memberName: { color: c.text, fontFamily: fonts.medium, fontSize: 14 }, memberMeta: { color: c.muted, fontFamily: fonts.body, fontSize: 12 }, points: { color: c.text, fontFamily: fonts.heading, fontSize: 16, fontVariant: ['tabular-nums'] }, pointsUnit: { color: c.muted, fontFamily: fonts.body, fontSize: 11 }, note: { padding: 14, backgroundColor: c.accentSoft, flexDirection: 'row', gap: 9 }, noteCopy: { flex: 1, color: c.muted, fontFamily: fonts.body, fontSize: 12, lineHeight: 18 }, dialogCopy: { color: c.muted, fontFamily: fonts.body, fontSize: 14, lineHeight: 21 }, fieldLabel: { color: c.text, fontFamily: fonts.medium, fontSize: 13, marginBottom: -5 }, codeInput: { minHeight: 54, borderWidth: 1, borderColor: c.border, backgroundColor: c.inputBackground, color: c.text, fontFamily: fonts.heading, fontSize: 22, letterSpacing: 3, paddingHorizontal: 14, textAlign: 'center' }, created: { padding: 16, backgroundColor: c.pitch, gap: 7 },
});
