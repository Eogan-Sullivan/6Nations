import { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Label, Button } from './ui';
import { colors as c, fonts } from '../theme/tokens';

export type AppRoute = '/squad' | '/matches' | '/leagues' | '/stats' | '/profile';

const tabs: Array<{ route: AppRoute; label: string; short: string }> = [
  { route: '/squad', label: 'My Squad', short: 'SQUAD' },
  { route: '/matches', label: 'Match Centre', short: 'MATCHES' },
  { route: '/leagues', label: 'Leagues', short: 'LEAGUES' },
  { route: '/stats', label: 'Stats & Fixtures', short: 'STATS' },
  { route: '/profile', label: 'Profile', short: 'PROFILE' },
];

export function AppTabs({ active }: { active: AppRoute }) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const desktop = width >= 1024;
  return (
    <View accessibilityLabel="Primary navigation" style={[styles.tabs, desktop ? styles.tabsDesktop : styles.tabsMobile]}>
      {tabs.map((tab) => {
        const selected = active === tab.route;
        return (
          <Pressable
            key={tab.route}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={tab.label}
            onPress={() => router.push(tab.route)}
            style={({ pressed }) => [styles.tab, selected && styles.tabSelected, pressed && styles.pressed]}
          >
            <Text style={[styles.tabLabel, selected && styles.tabLabelSelected]}>{tab.short}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function AppScreen({ active, title, description, children }: { active: AppRoute; title: string; description: string; children: ReactNode }) {
  const { width } = useWindowDimensions();
  const desktop = width >= 1024;
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <View style={styles.topBarCopy}>
          <Text style={styles.wordmark}>6NATIONS</Text>
          <Text style={styles.environment}>DEMO MODE · 2027 MEN'S SIX NATIONS</Text>
        </View>
        <Text numberOfLines={2} style={styles.status}>LOCAL PREVIEW</Text>
      </View>
      {desktop && <AppTabs active={active} />}
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, desktop && styles.contentDesktop]}>
        <Text accessibilityRole="header" style={styles.title}>{title}</Text>
        <Label muted>{description}</Label>
        <View style={styles.demoNotice}>
          <Text style={styles.noticeTitle}>Demo data</Text>
          <Text style={styles.noticeCopy}>Synthetic fixtures only. Nothing here is an official score, lockout, or submission.</Text>
        </View>
        {children}
      </ScrollView>
      {!desktop && <AppTabs active={active} />}
    </SafeAreaView>
  );
}

export function SectionRow({ title, meta, children }: { title: string; meta?: string; children?: ReactNode }) {
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
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyCopy}>{copy}</Text>
      {actionLabel && onAction ? <Button onPress={onAction}>{actionLabel}</Button> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.bg },
  topBar: { minHeight: 68, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  topBarCopy: { flex: 1, minWidth: 0 },
  wordmark: { color: c.text, fontFamily: fonts.heading, fontSize: 18, letterSpacing: 1.8 },
  environment: { color: c.muted, fontFamily: fonts.medium, fontSize: 11, letterSpacing: 1, marginTop: 3 },
  status: { color: c.emerald, fontFamily: fonts.medium, fontSize: 11, letterSpacing: 1 },
  content: { width: '100%', maxWidth: 1120, alignSelf: 'center', padding: 20, paddingBottom: 112, gap: 18 },
  contentDesktop: { paddingBottom: 32 },
  title: { color: c.text, fontFamily: fonts.heading, fontSize: 34, lineHeight: 40 },
  demoNotice: { padding: 14, borderWidth: 1, borderColor: c.demoBorder, backgroundColor: c.demoSurface, gap: 4 },
  noticeTitle: { color: c.amber, fontFamily: fonts.medium, fontSize: 12, letterSpacing: 1 },
  noticeCopy: { color: c.muted, fontFamily: fonts.body, fontSize: 13, lineHeight: 20 },
  tabs: { minHeight: 64, paddingHorizontal: 8, backgroundColor: c.navSurface, flexDirection: 'row', gap: 4 },
  tabsMobile: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingBottom: 8, borderTopWidth: 1, borderTopColor: c.border },
  tabsDesktop: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.border },
  tab: { flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 4 },
  tabSelected: { backgroundColor: c.active },
  tabLabel: { color: c.muted, fontFamily: fonts.medium, fontSize: 11, letterSpacing: 0.8 },
  tabLabelSelected: { color: c.emerald },
  pressed: { opacity: 0.7 },
  row: { minHeight: 72, padding: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.panel, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  rowCopy: { flex: 1, minWidth: 0, gap: 4 },
  rowTitle: { color: c.text, fontFamily: fonts.medium, fontSize: 15 },
  rowMeta: { color: c.muted, fontFamily: fonts.body, fontSize: 13, lineHeight: 20 },
  empty: { padding: 22, borderWidth: 1, borderColor: c.border, backgroundColor: c.panel, gap: 10 },
  emptyTitle: { color: c.text, fontFamily: fonts.heading, fontSize: 20 },
  emptyCopy: { color: c.muted, fontFamily: fonts.body, fontSize: 14, lineHeight: 21, maxWidth: 620 },
});
