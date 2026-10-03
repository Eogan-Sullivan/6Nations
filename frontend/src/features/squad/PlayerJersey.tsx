import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import { colors as c, fonts } from '../../theme/tokens';
import type { Player } from './model';

type PlayerJerseyProps = {
  player?: Player;
  teamColor?: string;
  detailColor?: string;
  numberColor?: string;
  teamCode?: string;
  slotLabel: string;
  role?: 'C' | 'VC' | null;
  active?: boolean;
  reserve?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  onRemove?: () => void;
};

const positionShort: Record<Player['position'], string> = {
  Prop: 'PR',
  Hooker: 'HK',
  Lock: 'LK',
  'Back row': 'BR',
  'Scrum-half': 'SH',
  'Fly-half': 'FH',
  Centre: 'CT',
  'Outside back': 'OB',
};

export function PlayerJersey({
  player,
  teamColor = c.emerald,
  detailColor = c.amber,
  numberColor = c.text,
  teamCode,
  slotLabel,
  role,
  active = false,
  reserve = false,
  disabled = false,
  onPress,
  onRemove,
}: PlayerJerseyProps) {
  const [removeHighlighted, setRemoveHighlighted] = useState(false);
  const playerName = player?.name ?? 'OPEN SLOT';
  const jerseyNumber = player ? String(player.number).padStart(2, '0') : '—';
  const label = player
    ? `${slotLabel}: ${player.name}${role ? `, ${role === 'C' ? 'captain' : 'vice-captain'}` : ''}`
    : `Empty ${slotLabel.toLowerCase()} slot`;

  const remove = (event: GestureResponderEvent) => {
    event.stopPropagation();
    onRemove?.();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.wrap,
        reserve && styles.reserveWrap,
        active && styles.active,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.jerseyStage, disabled && styles.disabled]}>
        <View style={[styles.jersey, !player && styles.emptyJersey]}>
          <View style={[styles.sleeve, styles.leftSleeve, { backgroundColor: player ? teamColor : c.raised, borderColor: player ? detailColor : c.border }]} />
          <View style={[styles.sleeve, styles.rightSleeve, { backgroundColor: player ? teamColor : c.raised, borderColor: player ? detailColor : c.border }]} />
          <View style={[styles.torso, { backgroundColor: player ? teamColor : c.raised, borderColor: player ? detailColor : c.border }]}>
            <View style={[styles.neckline, { borderColor: player ? detailColor : c.border }]} />
            <View style={[styles.highlight, { backgroundColor: player ? detailColor : c.border }]} />
            <Text style={[styles.number, { color: player ? numberColor : c.muted }]}>{jerseyNumber}</Text>
            {player && <Text style={[styles.initials, { color: numberColor }]}>{player.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</Text>}
            <View style={[styles.fabricSeam, { backgroundColor: player ? detailColor : c.border }]} />
          </View>
        </View>
        {player && onRemove && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove ${player.name}`}
            onPress={remove}
            onHoverIn={() => setRemoveHighlighted(true)}
            onHoverOut={() => setRemoveHighlighted(false)}
            onFocus={() => setRemoveHighlighted(true)}
            onBlur={() => setRemoveHighlighted(false)}
            style={({ pressed }) => [styles.remove, removeHighlighted && styles.removeHighlighted, pressed && styles.pressed]}
          >
            <Text style={[styles.removeText, removeHighlighted && styles.removeTextHighlighted]}>×</Text>
          </Pressable>
        )}
        {role && <Text style={[styles.role, role === 'C' ? styles.captain : styles.vice]}>{role}</Text>}
      </View>
      <View style={styles.nameplate}>
        <Text numberOfLines={1} style={[styles.name, !player && styles.emptyText]}>{playerName}</Text>
        <View style={styles.metaLine}>
          <View style={[styles.teamDot, { backgroundColor: player ? teamColor : c.border }]} />
          <Text style={styles.meta}>{player ? `${teamCode} · ${positionShort[player.position]}` : slotLabel}</Text>
          <Text style={styles.price}>{player ? `${(player.priceTenths / 10).toFixed(1)} cr` : 'SELECT'}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    minWidth: 76,
    minHeight: 138,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 8,
    paddingHorizontal: 3,
    paddingTop: 4,
    paddingBottom: 3,
    gap: 3,
  },
  reserveWrap: { minHeight: 112, minWidth: 88 },
  active: {
    borderColor: c.emerald,
    backgroundColor: '#123A2E',
    shadowColor: '#000000',
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  disabled: { opacity: 0.7 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
  jerseyStage: { width: 70, height: 82, alignItems: 'center', position: 'relative' },
  jersey: { width: 70, height: 80, position: 'relative', alignItems: 'center' },
  emptyJersey: { opacity: 0.8 },
  torso: {
    position: 'absolute',
    top: 8,
    left: 13,
    width: 44,
    height: 65,
    borderWidth: 1,
    borderRadius: 5,
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  sleeve: {
    position: 'absolute',
    top: 10,
    width: 22,
    height: 31,
    borderWidth: 1,
    borderRadius: 8,
  },
  leftSleeve: { left: 0, transform: [{ rotate: '-16deg' }] },
  rightSleeve: { right: 0, transform: [{ rotate: '16deg' }] },
  neckline: {
    position: 'absolute',
    top: -5,
    width: 20,
    height: 14,
    borderWidth: 2,
    borderRadius: 12,
    backgroundColor: '#0A241D',
  },
  highlight: { position: 'absolute', top: 11, width: 24, height: 2, opacity: 0.5 },
  number: { marginTop: 19, fontFamily: fonts.heading, fontSize: 27, lineHeight: 28, letterSpacing: -1 },
  initials: { fontFamily: fonts.medium, fontSize: 8, letterSpacing: 1, opacity: 0.9 },
  fabricSeam: { position: 'absolute', bottom: 8, width: 24, height: 1, opacity: 0.48 },
  remove: {
    position: 'absolute',
    right: -4,
    top: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.panel,
    borderWidth: 1,
    borderColor: c.border,
    zIndex: 3,
  },
  removeHighlighted: { borderColor: c.danger },
  removeText: { color: '#B4C8C0', fontFamily: fonts.medium, fontSize: 17, lineHeight: 18 },
  removeTextHighlighted: { color: c.danger },
  role: {
    position: 'absolute',
    right: -7,
    top: 19,
    minWidth: 24,
    paddingVertical: 3,
    borderRadius: 12,
    color: c.bg,
    fontFamily: fonts.heading,
    fontSize: 10,
    textAlign: 'center',
    overflow: 'hidden',
    zIndex: 2,
  },
  captain: { backgroundColor: c.amber },
  vice: { backgroundColor: c.teal },
  nameplate: { width: '100%', alignItems: 'center', gap: 1, backgroundColor: c.panel, borderRadius: 4, paddingVertical: 3 },
  name: { maxWidth: '100%', color: c.text, fontFamily: fonts.heading, fontSize: 11, letterSpacing: 0.15 },
  emptyText: { color: c.muted },
  metaLine: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 },
  teamDot: { width: 5, height: 5, borderRadius: 3 },
  meta: { color: '#B4C8C0', fontFamily: fonts.medium, fontSize: 9, letterSpacing: 0.35 },
  price: { color: '#B4C8C0', fontFamily: fonts.body, fontSize: 9 },
});
