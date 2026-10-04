import { useTheme } from '../theme/ThemeProvider';
import { useMemo } from 'react';
import { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Label, Button } from './ui';
import { StatusBanner, type Freshness } from './status';
import { fonts, type ThemeColors } from '../theme/tokens';
import { MatchdayCanvas } from './MatchdayCanvas';

export type AppRoute = '/squad' | '/matches' | '/leagues' | '/stats' | '/profile';

export function AppScreen({ active, title, description, children, freshness = 'demo', freshnessDetail = 'Synthetic fixtures only' }: { active: AppRoute; title: string; description: string; children: ReactNode; freshness?: Freshness; freshnessDetail?: string }) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { width } = useWindowDimensions();
  const desktop = width >= 1024;
  const showStateGuide = !['demo', 'connected', 'official'].includes(freshness);
  return (
    <MatchdayCanvas active={active}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, desktop && styles.contentDesktop]}>
        <View style={[styles.titleBlock, width < 520 && styles.titleBlockNarrow]}><View style={styles.titleCopy}><Text accessibilityRole="header" style={styles.title}>{title}</Text><Label muted>{description}</Label></View><StatusBanner status={freshness} detail={freshnessDetail} compact /></View>
        {showStateGuide && <View accessibilityRole="text" style={styles.stateGuide}><Text style={styles.stateGuideTitle}>Data confidence</Text><Text style={styles.stateGuideCopy}>{stateCopy[freshness]}</Text></View>}
        {children}
      </ScrollView>
    </MatchdayCanvas>
  );
}

const stateCopy: Record<Freshness, string> = {
  demo: 'Illustrative values only. Nothing here is official or submitted.', connected: 'Connected to the latest published game data.', loading: 'Fetching the latest published update.', empty: 'No published data is available for this view yet.', error: 'This view could not be refreshed. Retry when the connection is available.', stale: 'The last update is older than expected; treat live values with care.', provisional: 'Values can change before official reconciliation.', official: 'Values have passed the official scoring update.', corrected: 'A published value was corrected; the latest number is shown.', offline: 'You are offline. Previously saved information remains available.', incomplete: 'Some fields are still unpublished; unknown values are not treated as zero.', halftime: 'Halftime totals are a live snapshot using original starters.', 'mid-match': 'The match is in progress; totals are provisional.', 'sunday-update': 'Sunday reconciliation is processing final fantasy totals.',
};

export function SectionRow({ title, meta, children }: { title: string; meta?: string; children?: ReactNode }) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={styles.row}>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{title}</Text>
        {meta ? <Text style={styles.rowMeta}>{meta}</Text> : null}
      </View>
      {children}
    </View>
  );
}

export function EmptyState({
  title,
  copy,
  actionLabel,
  onAction,
}: {
  title: string;
  copy: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyCopy}>{copy}</Text>
      {actionLabel && onAction ? <Button onPress={onAction}>{actionLabel}</Button> : null}
    </View>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  content: { width: '100%', maxWidth: 1120, alignSelf: 'center', padding: 20, paddingBottom: 112, gap: 20 },
  contentDesktop: { paddingLeft: 220 },
  titleBlock: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 18, paddingTop: 6 },
  titleBlockNarrow: { flexDirection: 'column', alignItems: 'stretch', gap: 8 },
  titleLead: { flexDirection: 'row', alignItems: 'stretch', gap: 12, flex: 1, minWidth: 0 },
  titleRule: { width: 4, borderRadius: 2, backgroundColor: c.emerald },
  titleCopy: { flex: 1, minWidth: 0, gap: 4 },
  title: { color: c.text, fontFamily: fonts.heading, fontSize: 34, lineHeight: 40 },
  stateGuide: { paddingVertical: 9, paddingHorizontal: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: c.border, flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'baseline' },
  stateGuideTitle: { color: c.amber, fontFamily: fonts.medium, fontSize: 11 },
  stateGuideCopy: { color: c.muted, fontFamily: fonts.body, fontSize: 12, lineHeight: 18, flexShrink: 1 },
  demoNotice: { paddingVertical: 10, paddingHorizontal: 12, borderLeftWidth: 2, borderLeftColor: c.amber, backgroundColor: c.demoSurface, gap: 3 },
  noticeTitle: { color: c.amber, fontFamily: fonts.medium, fontSize: 12 },
  noticeCopy: { color: c.muted, fontFamily: fonts.body, fontSize: 13, lineHeight: 20 },
  row: { minHeight: 68, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.border, backgroundColor: 'transparent', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  rowCopy: { flex: 1, minWidth: 0, gap: 4 },
  rowTitle: { color: c.text, fontFamily: fonts.medium, fontSize: 15 },
  rowMeta: { color: c.muted, fontFamily: fonts.body, fontSize: 13, lineHeight: 20 },
  empty: { paddingVertical: 20, paddingHorizontal: 2, borderTopWidth: 1, borderBottomWidth: 1, borderColor: c.border, backgroundColor: 'transparent', gap: 10 },
  emptyTitle: { color: c.text, fontFamily: fonts.heading, fontSize: 20 },
  emptyCopy: { color: c.muted, fontFamily: fonts.body, fontSize: 14, lineHeight: 21, maxWidth: 620 },
});
