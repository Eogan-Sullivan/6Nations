import { ReactNode, useMemo } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, View } from 'react-native';
import { CommandDock, type DockDestination } from './CommandDock';
import { useTheme } from '../theme/ThemeProvider';
import { type ThemeColors } from '../theme/tokens';

export function MatchdayCanvas({ active, children }: { active: DockDestination; children: ReactNode }) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View pointerEvents="none" style={styles.pitchMarkA} />
      <View pointerEvents="none" style={styles.pitchMarkB} />
      <View style={styles.content}>{children}</View>
      <CommandDock active={active} />
    </SafeAreaView>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.bg, position: 'relative' },
  content: { flex: 1, zIndex: 1 },
  pitchMarkA: { position: 'absolute', width: 360, height: 360, right: -190, top: -160, borderRadius: 180, borderWidth: 1, borderColor: c.border, opacity: 0.22 },
  pitchMarkB: { position: 'absolute', width: 520, height: 180, left: -280, bottom: 90, borderRadius: 100, borderWidth: 1, borderColor: c.border, opacity: 0.16, transform: [{ rotate: '-16deg' }] },
});
