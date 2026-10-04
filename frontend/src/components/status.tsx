import { Feather } from '@expo/vector-icons';
import { useMemo } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { fonts, type ThemeColors } from '../theme/tokens';

export type Freshness = 'demo' | 'connected' | 'loading' | 'empty' | 'error' | 'stale' | 'provisional' | 'official' | 'corrected' | 'offline' | 'incomplete' | 'halftime' | 'mid-match' | 'sunday-update';

const copy: Record<Freshness, { label: string; icon: keyof typeof Feather.glyphMap }> = {
  demo: { label: 'Demo data', icon: 'monitor' }, connected: { label: 'Connected', icon: 'check-circle' }, loading: { label: 'Loading', icon: 'loader' }, empty: { label: 'No data yet', icon: 'inbox' }, error: { label: 'Could not load', icon: 'alert-triangle' }, stale: { label: 'Stale', icon: 'clock' },
  provisional: { label: 'Provisional', icon: 'clock' }, official: { label: 'Official', icon: 'check-circle' }, corrected: { label: 'Corrected', icon: 'edit-3' }, offline: { label: 'Offline', icon: 'wifi-off' }, incomplete: { label: 'Incomplete data', icon: 'alert-circle' }, halftime: { label: 'Halftime update', icon: 'pause-circle' }, 'mid-match': { label: 'Mid-match snapshot', icon: 'activity' }, 'sunday-update': { label: 'Sunday update', icon: 'calendar' },
};

export function StatusBanner({ status = 'demo', detail, compact = false }: { status?: Freshness; detail?: string; compact?: boolean }) {
  const { colors: c } = useTheme();
  const s = useMemo(() => makeStyles(c), [c]);
  const tone = status === 'official' || status === 'connected' ? c.emerald : status === 'offline' || status === 'incomplete' || status === 'error' ? c.danger : c.amber;
  return <View accessibilityRole="text" style={[s.banner, compact && s.compact]}><Feather name={copy[status].icon} size={compact ? 13 : 15} color={tone} /><Text style={[s.label, { color: tone }]}>{copy[status].label}</Text>{detail ? <Text style={s.detail}> · {detail}</Text> : null}</View>;
}

export function MetricStrip({ items }: { items: Array<{ value: string; label: string; tone?: string }> }) {
  const { colors: c } = useTheme();
  const s = useMemo(() => makeStyles(c), [c]);
  const { width } = useWindowDimensions();
  return <View accessibilityRole="summary" style={[s.metrics, width < 360 && s.metricsNarrow]}>{items.map((item, index) => <View key={item.label} style={[s.metric, index > 0 && s.metricBorder]}><Text style={[s.value, item.tone ? { color: item.tone } : null]}>{item.value}</Text><Text style={s.metricLabel}>{item.label}</Text></View>)}</View>;
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  banner: { minHeight: 44, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: c.demoSurface, borderWidth: 1, borderColor: c.demoBorder, flexDirection: 'row', alignItems: 'center', gap: 7 },
  compact: { minHeight: 32, paddingVertical: 6, borderWidth: 0, backgroundColor: 'transparent', paddingHorizontal: 0 },
  label: { fontFamily: fonts.medium, fontSize: 12 }, detail: { color: c.muted, fontFamily: fonts.body, fontSize: 12, flexShrink: 1 },
  metrics: { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, borderColor: c.border, minHeight: 78 }, metricsNarrow: { minHeight: 70 },
  metric: { flex: 1, minWidth: 0, justifyContent: 'center', gap: 4, paddingHorizontal: 12 }, metricBorder: { borderLeftWidth: 1, borderLeftColor: c.border }, value: { color: c.text, fontFamily: fonts.heading, fontSize: 22, fontVariant: ['tabular-nums'] }, metricLabel: { color: c.muted, fontFamily: fonts.medium, fontSize: 10, letterSpacing: 0.5 },
});
