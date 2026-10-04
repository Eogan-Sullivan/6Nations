import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { ThemeToggle } from '../theme/ThemeToggle';
import { useTheme } from '../theme/ThemeProvider';
import { fonts, type ThemeColors } from '../theme/tokens';

export type DockDestination = '/squad' | '/matches' | '/leagues' | '/stats' | '/profile';

const destinations: Array<{ route: DockDestination; label: string; icon: keyof typeof Feather.glyphMap }> = [
  { route: '/squad', label: 'My Squad', icon: 'shield' },
  { route: '/matches', label: 'Match Centre', icon: 'calendar' },
  { route: '/leagues', label: 'Leagues', icon: 'users' },
  { route: '/stats', label: 'Stats & Fixtures', icon: 'bar-chart-2' },
  { route: '/profile', label: 'Profile', icon: 'user' },
];

export function CommandDock({ active, alertCount = 0, onOpenHub, onOpenTactical }: { active: DockDestination; alertCount?: number; onOpenHub?: () => void; onOpenTactical?: () => void }) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const router = useRouter();
  const { width } = useWindowDimensions();
  const desktop = width >= 1024;
  const [expanded, setExpanded] = useState(desktop);
  const [reduceMotion, setReduceMotion] = useState(true);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (desktop) setExpanded(true);
  }, [desktop]);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(expanded ? 1 : 0);
      return;
    }
    Animated.spring(progress, { toValue: expanded ? 1 : 0, useNativeDriver: true, speed: 22, bounciness: 4 }).start();
  }, [expanded, progress, reduceMotion]);

  const navigate = (route: DockDestination) => {
    setExpanded(false);
    router.replace(route);
  };

  return (
    <View pointerEvents="box-none" style={[styles.host, desktop && styles.hostDesktop]}>
      {expanded && !desktop && <Pressable
          accessibilityRole="button"
          accessibilityLabel="Collapse command dock"
          accessibilityHint="Dismisses the expanded command dock"
          onPress={() => setExpanded(false)}
          style={styles.dismissLayer}
        />}
      <Animated.View
        accessibilityRole="toolbar"
        accessibilityViewIsModal={expanded && !desktop}
        accessibilityLabel="Primary navigation"
        style={[styles.dock, desktop && styles.dockDesktop, expanded && styles.dockExpanded, { transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, desktop ? -6 : -4] }) }] }]}
      >
        {desktop && <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${expanded ? 'Collapse' : 'Expand'} navigation${alertCount > 0 ? `, ${alertCount} alert${alertCount === 1 ? '' : 's'}` : ''}`}
          accessibilityHint={expanded ? 'Hides navigation and quick actions' : 'Shows navigation and quick actions'}
          accessibilityState={{ expanded, disabled: desktop }}
          disabled={desktop}
          onPress={() => setExpanded((value) => !value)}
          style={({ pressed }) => [styles.dockToggle, pressed && styles.pressed]}
        >
          <View style={styles.mark}><Text style={styles.markText}>6</Text></View>
          <View style={styles.toggleCopy}>
            <Text style={styles.dockEyebrow}>SIX NATIONS</Text>
            <Text style={styles.dockTitle}>{desktop ? 'Navigation' : expanded ? 'Navigation' : destinations.find((item) => item.route === active)?.label}</Text>
          </View>
          {!desktop && <View style={styles.activity}>{alertCount > 0 && <Text style={styles.alertCount}>{alertCount}</Text>}<Feather name={expanded ? 'chevron-down' : 'chevron-up'} size={16} color={c.muted} /></View>}
        </Pressable>}
        {(
          <Animated.View style={styles.expandedContent}>
            <View accessibilityRole="tablist" style={[styles.destinationGrid, desktop && styles.destinationGridDesktop]}>
              {destinations.map((destination) => {
                const selected = active === destination.route;
                return (
                  <Pressable
                    key={destination.route}
                    accessibilityRole="tab"
                    accessibilityLabel={`Go to ${destination.label}`}
                    accessibilityHint={selected ? 'Current section' : `Open ${destination.label}`}
                    accessibilityState={{ selected }}
                    onPress={() => navigate(destination.route)}
                    style={({ pressed }) => [styles.destination, desktop && styles.destinationDesktop, selected && styles.destinationSelected, pressed && styles.pressed]}
                  >
                    <Feather name={destination.icon} size={17} color={selected ? c.emerald : c.muted} />
                    <Text style={[styles.destinationLabel, selected && styles.destinationLabelSelected]}>{destination.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            {expanded && (onOpenHub || onOpenTactical) && (
              <View accessibilityRole="toolbar" style={styles.quickActions}>
                {onOpenHub && <Pressable accessibilityRole="button" accessibilityLabel="Open Tournament Hub" onPress={() => { setExpanded(false); onOpenHub(); }} style={styles.quickAction}><Feather name="menu" size={15} color={c.emerald} /><Text style={styles.quickActionLabel}>Tournament Hub</Text></Pressable>}
                {onOpenTactical && <Pressable accessibilityRole="button" accessibilityLabel="Open Tactical Desk" onPress={() => { setExpanded(false); onOpenTactical(); }} style={styles.quickAction}><Feather name="crosshair" size={15} color={c.emerald} /><Text style={styles.quickActionLabel}>Tactical Desk</Text></Pressable>}
              </View>
            )}
            {desktop && <View style={styles.dockFooter}>
              <Text style={styles.footerLabel}>DISPLAY</Text>
              <ThemeToggle />
            </View>}
          </Animated.View>
        )}
      </Animated.View>
    </View>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  host: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', zIndex: 100, paddingBottom: 8 },
  hostDesktop: { left: 16, right: undefined, top: 16, bottom: 16, width: 208, alignItems: 'stretch' },
  dismissLayer: { position: 'absolute', left: 0, right: 0, top: -1000, bottom: -16 },
  dock: { width: '100%', maxWidth: 560, borderTopWidth: 1, borderColor: c.border, backgroundColor: c.navSurface, shadowColor: c.shadow, shadowOpacity: 0.26, shadowRadius: 20, shadowOffset: { width: 0, height: -8 }, overflow: 'hidden' },
  dockDesktop: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 208, maxWidth: 208, borderRadius: 16, shadowOpacity: 0.18 },
  dockExpanded: { borderColor: c.elevated },
  dockToggle: { minHeight: 54, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 11 },
  mark: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: c.emerald },
  markText: { color: c.onAccent, fontFamily: fonts.heading, fontSize: 23 },
  toggleCopy: { flex: 1, minWidth: 0 },
  dockEyebrow: { color: c.muted, fontFamily: fonts.medium, fontSize: 9, letterSpacing: 1.1 },
  dockTitle: { color: c.text, fontFamily: fonts.heading, fontSize: 16, marginTop: 2 },
  activity: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  alertCount: { color: c.amber, fontFamily: fonts.medium, fontSize: 11 },
  expandedContent: { paddingHorizontal: 8, paddingBottom: 10, gap: 12 },
  destinationGrid: { flexDirection: 'row', gap: 3, justifyContent: 'space-around' },
  destinationGridDesktop: { flexDirection: 'column', gap: 4, justifyContent: 'flex-start' },
  destination: { flex: 1, minHeight: 56, paddingHorizontal: 4, borderRadius: 8, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 },
  destinationDesktop: { flex: 0, minHeight: 46, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 11 },
  destinationSelected: { backgroundColor: c.active },
  destinationLabel: { color: c.muted, fontFamily: fonts.medium, fontSize: 11, textAlign: 'center' },
  destinationLabelSelected: { color: c.emerald },
  quickActions: { flexDirection: 'column', gap: 7, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 12 },
  quickAction: { flex: 1, minHeight: 44, borderRadius: 10, backgroundColor: c.raised, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  quickActionLabel: { color: c.text, fontFamily: fonts.medium, fontSize: 10 },
  dockFooter: { borderTopWidth: 1, borderTopColor: c.border, paddingTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  footerLabel: { color: c.muted, fontFamily: fonts.medium, fontSize: 9, letterSpacing: 0.8 },
  footerValue: { color: c.text, fontFamily: fonts.medium, fontSize: 12, marginTop: 3 },
  pressed: { opacity: 0.72 },
});
