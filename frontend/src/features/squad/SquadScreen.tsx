import { useTheme } from '../../theme/ThemeProvider';
import { useMemo } from 'react';
import { memo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Label } from '../../components/ui';
import { CommandDock } from '../../components/CommandDock';
import { fonts, type ThemeColors } from '../../theme/tokens';
import { exampleDraft } from './demo';
import {
  FORMATION,
  NATIONS,
  POSITIONS,
  assignCaptain,
  credits,
  moveReserve,
  putPlayer,
  removePlayer,
  selectedPlayers,
  swapReserveWithStarter,
  validateDraft,
  type Nation,
  type Player,
  type Position,
} from './model';
import { useSquad } from './useSquad';
import { PlayerJersey } from './PlayerJersey';
import { nationColors } from '../../theme/nations';
import { useReducedMotion } from '../../lib/useReducedMotion';

const shortNation: Record<Nation, string> = {
  Ireland: 'IRE',
  France: 'FRA',
  England: 'ENG',
  Scotland: 'SCO',
  Wales: 'WAL',
  Italy: 'ITA',
};
const lightNationColor = nationColors.light;
const nationColor = nationColors.dark;
const jerseyColors = nationColors.jersey;
const pitchRows = [
  [12, 13, 14],
  [10, 11],
  [9],
  [8],
  [5, 7, 6],
  [3, 4],
  [0, 1, 2],
];
const starterLabels = [
  'Loosehead prop',
  'Hooker',
  'Tighthead prop',
  'Left lock',
  'Right lock',
  'Blindside flanker',
  'Open-side flanker',
  'Number 8',
  'Scrum-half',
  'Fly-half',
  'Inside centre',
  'Outside centre',
  'Left wing',
  'Fullback',
  'Right wing',
];

const fixtures = [
  { home: 'IRE', away: 'ENG', time: 'Fri 31 Jan · 20:00', tone: '#087F50' },
  { home: 'FRA', away: 'ITA', time: 'Sat 1 Feb · 14:15', tone: '#214BB8' },
  { home: 'SCO', away: 'WAL', time: 'Sat 1 Feb · 16:45', tone: '#172B4D' },
];

type PlayerPoolRowProps = {
  player: Player;
  selected: boolean;
  compatible: boolean;
  editable: boolean;
  requiredPosition: Position | null;
  cost: number;
  activePriceTenths: number;
  activeNation?: Nation;
  nationCount: number;
  onDetail: (player: Player) => void;
  onAdd: (player: Player) => void;
};

const PlayerPoolRow = memo(function PlayerPoolRow({
  player,
  selected,
  compatible,
  editable,
  requiredPosition,
  cost,
  activePriceTenths,
  activeNation,
  nationCount,
  onDetail,
  onAdd,
}: PlayerPoolRowProps) {
  const { colors: c, theme } = useTheme();
  const s = useMemo(() => makeStyles(c), [c]);
  const previewCost = cost - activePriceTenths + player.priceTenths;
  const nextNationCount = nationCount - (activeNation === player.nation ? 1 : 0) + 1;
  const warning = !selected && compatible
    ? [
        previewCost > 1000 ? 'Would exceed budget' : '',
        nextNationCount > 4 ? 'Would exceed nation limit' : '',
      ].filter(Boolean).join(' · ')
    : '';

  return (
    <View style={[s.playerRow, selected && s.playerRowSelected, !compatible && s.playerRowDisabled, warning && s.playerRowWarning]}>
      <View style={[s.playerAvatar, { borderColor: nationColor[player.nation] }]}>
        <Text style={[s.avatarNumber, { color: nationColor[player.nation] }]}>{String(player.number).padStart(2, '0')}</Text>
      </View>
      <View style={s.playerInfo}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`View ${player.name}, ${player.position}, ${player.nation}`}
          onPress={() => onDetail(player)}
          style={s.playerNameButton}
        >
          <Text numberOfLines={2} style={s.playerName}>{player.name} <Text style={s.infoIcon}>↗</Text></Text>
          <View style={s.playerBadges}>
            <Text style={[s.nationBadge, { color: theme === 'light' ? lightNationColor[player.nation] : nationColor[player.nation] }]}>{shortNation[player.nation]}</Text>
            <Text style={s.positionBadge}>{player.position}</Text>
          </View>
        </Pressable>
        {!!warning && <Text style={s.warningText}>{warning}</Text>}
        {!compatible && <Text style={s.playerMeta}>Choose a {requiredPosition} slot to add</Text>}
        {compatible && <Text style={s.playerForm}>FORM <Text style={s.playerFormValue}>{player.form.toFixed(1)}</Text> · {player.fantasyPoints} pts</Text>}
      </View>
      <View style={s.playerPrice}>
        <Text style={s.price}>{credits(player.priceTenths)}</Text>
        <Button compact label={`Select ${player.name}, ${player.position}, ${player.nation}`} disabled={selected || !compatible || !editable} onPress={() => onAdd(player)}>
          {selected ? 'Picked' : '+'}
        </Button>
      </View>
    </View>
  );
});

export default function SquadScreen() {
  const { colors: c, theme } = useTheme();
  const s = useMemo(() => makeStyles(c), [c]);
  const router = useRouter();
  const squad = useSquad();
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const wide = width >= 1024;
  const mobile = width < 640;
  const mainScroll = useRef<ScrollView>(null);
  const [poolY, setPoolY] = useState(0);
  const [columnsY, setColumnsY] = useState(0);
  const [activeSlot, setActiveSlot] = useState(0);
  const [view, setView] = useState<'pitch' | 'list'>('pitch');
  const [query, setQuery] = useState('');
  const [nation, setNation] = useState<Nation | 'All'>('All');
  const [position, setPosition] = useState<Position | 'All'>('Prop');
  const [limit, setLimit] = useState(12);
  const [detail, setDetail] = useState<Player | null>(null);
  const [review, setReview] = useState(false);
  const [hubDrawer, setHubDrawer] = useState(false);
  const [tacticalDrawer, setTacticalDrawer] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [transferMarket, setTransferMarket] = useState(false);
  const [transferSlot, setTransferSlot] = useState(0);
  const picked = selectedPlayers(squad.draft, squad.players);
  const nationCounts = useMemo(() => {
    const counts = {} as Record<Nation, number>;
    for (const player of picked) counts[player.nation] = (counts[player.nation] ?? 0) + 1;
    return counts;
  }, [squad.draft.slots, squad.players]);
  const cost = picked.reduce((sum, p) => sum + p.priceTenths, 0);
  const issues = validateDraft(squad.draft, squad.players);
  const activePlayer = squad.players.find((p) => p.id === squad.draft.slots[activeSlot]);
  const slotLabel = (index: number) =>
    index < 15 ? `${index + 1} · ${FORMATION[index]}` : `Reserve ${index - 14}`;
  const requiredPosition: Position | null = activeSlot < 15 ? FORMATION[activeSlot] ?? null : null;
  const captain = squad.players.find((p) => p.id === squad.draft.captainId);
  const vice = squad.players.find((p) => p.id === squad.draft.viceCaptainId);
  const editable = squad.storageReady && !squad.locked && squad.players.length > 0;
  const dirty = squad.confirmed && JSON.stringify(squad.draft) !== JSON.stringify(squad.confirmed);
  const filtered = useMemo(
    () =>
      squad.players.filter(
        (p) =>
          (position === 'All' || p.position === position) &&
          (nation === 'All' || p.nation === nation) &&
          `${p.name} ${p.nation} ${p.position}`.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [squad.players, query, nation, position],
  );

  const chooseSlot = (index: number, scroll = true) => {
    setActiveSlot(index);
    setPosition(index < 15 ? FORMATION[index]! : 'All');
    setQuery('');
    setLimit(12);
    if (!wide && scroll) mainScroll.current?.scrollTo({ y: columnsY + poolY, animated: false });
  };
  const add = (player: Player) => {
    squad.update((d) => putPlayer(d, activeSlot, player));
    setDetail(null);
    const next = squad.draft.slots.findIndex((id, index) => index > activeSlot && !id);
    if (next >= 0) chooseSlot(next, false);
  };
  const remove = (index: number) => {
    squad.update((d) => removePlayer(d, index));
    chooseSlot(index, false);
  };
  const role = (id: string) =>
    id === squad.draft.captainId ? 'C' : id === squad.draft.viceCaptainId ? 'VC' : null;
  const openReview = () => {
    setConfirmed(false);
    setReview(true);
  };
  const lockSquad = async () => {
    if (issues.length > 0) {
      openReview();
      return;
    }
    const success = await squad.lock();
    if (success) setConfirmed(true);
  };

  const slotCard = (index: number, list = false) => {
    const player = squad.players.find((p) => p.id === squad.draft.slots[index]);
    const slotTitle = index < 15 ? starterLabels[index] ?? 'Starter' : `Reserve ${index - 14}`;
    return (
      <View
        key={index}
        style={[s.slot, mobile && !list && s.slotMobile, list && s.listSlot]}
      >
        <PlayerJersey
          player={player}
          teamColor={player ? jerseyColors[player.nation].fabric : undefined}
          detailColor={player ? jerseyColors[player.nation].trim : undefined}
          numberColor={player ? jerseyColors[player.nation].number : undefined}
          teamCode={player ? shortNation[player.nation] : undefined}
          slotLabel={slotTitle}
          role={player ? role(player.id) as 'C' | 'VC' | null : null}
          active={activeSlot === index}
          reserve={index >= 15}
          compact={mobile && view === 'pitch'}
          disabled={!editable}
          onPress={() => {
            if (!editable) return;
            chooseSlot(index);
            if (player) setDetail(player);
          }}
          onRemove={player && editable ? () => remove(index) : undefined}
        />
        {list && (
          <Text style={s.slotPosition}>
            {index < 15 ? starterLabels[index] : `Reserve priority ${index - 14}`}
          </Text>
        )}
      </View>
    );
  };

  if (squad.loading)
    return (
      <SafeAreaView style={s.loading}>
        <ActivityIndicator color={c.emerald} />
        <Label>Loading your demo squad…</Label>
      </SafeAreaView>
    );

  return (
    <SafeAreaView style={s.screen} className="flex-1">
      <View pointerEvents="none" style={s.atmosphere}>
        <View style={s.atmosphereGlow} />
        <View style={s.atmosphereGlowSecondary} />
        <View style={s.atmosphereVignette} />
      </View>
      <ScrollView
        ref={mainScroll}
        contentContainerStyle={[s.page, wide && s.pageWide]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.hero}>
          <View style={s.heroText}>
              <Text style={s.eyebrow}>Round 1 · Men's Six Nations 2027</Text>
            <Text accessibilityRole="header" style={s.title}>
              My Squad
            </Text>
            <Label muted>
              Build your winning XV, pick your captain and score big in the Six Nations.
            </Label>
            {mobile && <Button compact onPress={() => setHubDrawer(true)}>Open tournament hub</Button>}
          </View>
          <View style={s.deadlineCard}>
            <View style={s.deadlineTopline}>
              <Text style={s.deadlineLabel}>DEADLINE</Text>
              <View style={s.previewDot} />
            </View>
            <Text style={s.deadlineDate}>Fri 31 Jan, 19:30</Text>
            <Text style={s.deadlineCountdown}>2d 14h 32m</Text>
            <Text style={s.deadlineHint}>Lock your squad before kick-off</Text>
          </View>
        </View>

        <View accessibilityLabel="Squad progress" style={s.workflowSummary}>
          <View style={s.workflowStat}>
            <Text style={s.workflowValue} testID="squad-count">{picked.length} / 18</Text>
            <Text style={s.workflowLabel}>PLAYERS</Text>
          </View>
          <View style={s.workflowRule} />
          <View style={s.workflowStat}>
            <Text testID="budget-remaining" style={[s.workflowValue, cost > 1000 && { color: c.danger }]}>{credits(1000 - cost)} cr</Text>
            <Text style={s.workflowLabel}>BUDGET LEFT</Text>
          </View>
          <View style={s.workflowRule} />
          <View style={s.workflowStat}>
            <Text style={[s.workflowValue, issues.length > 0 && s.workflowWarning]}>{issues.length ? `${issues.length} TO FIX` : 'READY'}</Text>
            <Text style={s.workflowLabel}>SQUAD CHECK</Text>
          </View>
          <Label muted style={s.workflowHint}>Select a jersey to fill that position.</Label>
        </View>

        {squad.error && (
          <View accessibilityRole="alert" style={s.errorBox}>
            <Label>{squad.error}</Label>
            <View style={s.wrap}>
              <Button onPress={() => void squad.retry()}>Retry saving / loading</Button>
              {!squad.storageReady && (
                <Button onPress={() => setResetting(true)}>Start a new draft</Button>
              )}
            </View>
          </View>
        )}
        {squad.source === 'api' && squad.players.length === 0 && !squad.error && (
          <View style={s.dataUnavailable}>
            <Text accessibilityRole="header" style={s.dataUnavailableTitle}>Player data is not available yet.</Text>
            <Label muted>Your account is connected. The squad catalog will appear when the rugby data API publishes the season.</Label>
          </View>
        )}
        {squad.confirmed && (
          <View style={s.savedBanner}>
            <Text style={s.savedText}>
              {dirty
                ? 'You have changes since your last demo confirmation.'
                : 'Demo squad confirmed on this device.'}
            </Text>
            <Label muted>
              {squad.confirmedAt ? new Date(squad.confirmedAt).toLocaleString() : ''} · No selection
              has been sent to the game server.
            </Label>
          </View>
        )}

        <View
          onLayout={(event) => setColumnsY(event.nativeEvent.layout.y)}
          style={[s.columns, wide && s.columnsWide]}
        >
          <View style={[s.squadPanel, wide && { flex: 2 }]}>
            <View style={s.sectionHeading}>
              <View>
                <View style={s.sectionTitleLine}>
                  <Text style={s.h2}>Starting XV</Text>
                  <Text style={s.selectionPill}>{squad.draft.slots.slice(0, 15).filter(Boolean).length} of 15 selected</Text>
                </View>
                <Label muted>Tap a jersey to select, replace or make a leader.</Label>
              </View>
              <View style={s.wrap}>
                <Button compact selected={view === 'pitch'} onPress={() => setView('pitch')}>
                  Pitch
                </Button>
                <Button compact selected={view === 'list'} onPress={() => setView('list')}>
                  List
                </Button>
              </View>
            </View>
            {view === 'pitch' ? (
              <View style={[s.pitch, mobile && s.pitchMobile]}>
                <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                  <View style={s.pitchLight} />
                  <View style={s.pitchShadow} />
                  <View style={s.pitchStripe} />
                  <View style={[s.pitchStripe, { top: '34%' }]} />
                  <View style={[s.pitchStripe, { top: '68%' }]} />
                  <View style={s.pitchBoundary} />
                  <View style={s.deadBallTop} />
                  <View style={s.deadBallBottom} />
                  <View style={s.tryLineTop} />
                  <View style={s.tryLineBottom} />
                  <View style={s.twentyTwoTop} />
                  <View style={s.twentyTwoBottom} />
                  <View style={s.tenMetreTop} />
                  <View style={s.tenMetreBottom} />
                  <View style={s.halfway} />
                  <View style={[s.goalPosts, s.goalPostsTop]}>
                    <View style={s.goalUpright} />
                    <View style={s.goalCrossbar} />
                    <View style={s.goalUpright} />
                  </View>
                  <View style={[s.goalPosts, s.goalPostsBottom]}>
                    <View style={s.goalUpright} />
                    <View style={s.goalCrossbar} />
                    <View style={s.goalUpright} />
                  </View>
                </View>
                <View style={s.pitchHeader}>
                  <Text style={s.pitchLegend}>STARTING XV</Text>
                  <Text style={s.attackDirection}>ATTACK ↑</Text>
                </View>
                <View style={s.pitchLabels} pointerEvents="none">
                  <Text style={s.pitchLabel}>BACK THREE</Text>
                  <Text style={s.pitchLabel}>CENTRES</Text>
                  <Text style={s.pitchLabel}>HALVES</Text>
                  <Text style={s.pitchLabel}>PACK</Text>
                </View>
                {pitchRows.map((row, index) => (
                  <View
                    key={index}
                    style={[
                      s.pitchRow,
                      mobile && s.pitchRowMobile,
                      index === 0 && s.backThreeRow,
                      mobile && index === 0 && s.backThreeRowMobile,
                      index === 1 && s.centresRow,
                      mobile && index === 1 && s.centresRowMobile,
                      (index === 2 || index === 3) && s.halfRow,
                      mobile && (index === 2 || index === 3) && s.halfRowMobile,
                      index === 4 && s.backRow,
                      mobile && index === 4 && s.backRowMobile,
                      index === 5 && s.locksRow,
                      mobile && index === 5 && s.locksRowMobile,
                      index === 6 && s.frontRow,
                      mobile && index === 6 && s.frontRowMobile,
                    ]}
                  >
                    {row.map((i) => slotCard(i))}
                  </View>
                ))}
              </View>
            ) : (
              <View style={s.slotList}>{FORMATION.map((_, index) => slotCard(index, true))}</View>
            )}

            <View style={s.reserveHeading}>
              <View>
                <Text style={s.h3}>The bench</Text>
                <Label muted>Cover in priority order · auto-substitution when eligible.</Label>
              </View>
              <Text style={s.reserveCount}>{squad.draft.slots.slice(15).filter(Boolean).length}/3 RESERVES</Text>
            </View>
            <View style={s.reserveRow}>
              {[15, 16, 17].map((index) => (
                <View key={index} style={[s.reserveItem, mobile && s.reserveItemMobile]}>
                  {slotCard(index)}
                  <View style={s.reserveControls}>
                    <Button
                      compact
                      label={`Move reserve ${index - 14} earlier`}
                      disabled={index === 15 || !editable}
                      onPress={() => squad.update((d) => moveReserve(d, index, -1))}
                    >
                      ←
                    </Button>
                    <Button
                      compact
                      label={`Move reserve ${index - 14} later`}
                      disabled={index === 17 || !editable}
                      onPress={() => squad.update((d) => moveReserve(d, index, 1))}
                    >
                      →
                    </Button>
                    <Button
                      compact
                      label={`Swap reserve ${index - 14} with selected starting player`}
                      disabled={!editable || index < 15 || activeSlot > 14 || !squad.draft.slots[index]}
                      onPress={() => squad.update((d) => swapReserveWithStarter(d, index, activeSlot, squad.players))}
                    >
                      Swap with starter
                    </Button>
                  </View>
                  <Text style={s.reserveCover}>
                    {squad.players.find((p) => p.id === squad.draft.slots[index])?.position ?? 'Open cover'} cover · auto-substitutes when an eligible starter does not play
                  </Text>
                </View>
              ))}
            </View>
            <View style={s.nationPanel}>
              <Text style={s.smallHeading}>MAXIMUM FOUR PER NATION · ALL 18 PLAYERS</Text>
              <View style={s.nationCounts}>
                {NATIONS.map((n) => {
                  const count = picked.filter((p) => p.nation === n).length;
                  return (
                    <View key={n} style={s.nationCount}>
                      <Text style={[s.nationAbbr, { color: theme === 'light' ? lightNationColor[n] : nationColor[n] }]}>
                        {shortNation[n]}
                      </Text>
                      <Text style={[s.count, count > 4 && { color: c.danger }]}>
                        {count}
                        <Text style={s.metricUnit}>/4</Text>
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
            <View style={s.validationCard} accessibilityLabel="Squad validation">
              <View style={s.validationIcon}><Text style={s.validationIconText}>{issues.length ? '!' : '✓'}</Text></View>
              <View style={s.validationCopy}>
                <Text style={issues.length ? s.validationTitleWarning : s.validationTitle}>{issues.length ? 'Squad needs attention' : 'Valid squad'}</Text>
                <Text style={s.validationMessage}>{issues.length ? issues[0]?.message : `You've selected ${picked.length} players and are within budget.`}</Text>
              </View>
            </View>
            <View style={s.localStatus}>
              <Text accessibilityLiveRegion="polite" style={s.status}>
                {squad.status}
              </Text>
              <Label muted>Your draft stays in this browser or on this device.</Label>
            </View>
            <View style={s.actions}>
              <Button
                variant="primary"
                label="Review squad"
                disabled={!editable}
                onPress={openReview}
              >
                Review & lock squad →
              </Button>
              <View style={s.wrap}>
                <Button
                  onPress={() => squad.update(() => exampleDraft())}
                  disabled={!editable}
                >
                  Load example squad
                </Button>
                <Button variant="ghost" disabled={!editable} onPress={() => setResetting(true)}>
                  Clear draft
                </Button>
              </View>
            </View>
          </View>

          <View
            onLayout={(event) => setPoolY(event.nativeEvent.layout.y)}
            style={[s.poolPanel, wide && { flex: 1 }]}
          >
            <Text style={s.eyebrow}>Player selection</Text>
            <Text style={s.h2}>Player pool</Text>
            <Label muted>Fantasy price, recent form, appearances, and points feed the selection decision.</Label>
            <View style={s.activeSelection}>
              <Text style={s.smallHeading}>
                SELECTING FOR {slotLabel(activeSlot).toUpperCase()}
              </Text>
              <Label>
                {activePlayer
                  ? `${activePlayer.name} · ${activePlayer.position}`
                  : requiredPosition
                    ? `Choose a ${requiredPosition.toLowerCase()} for this starter slot.`
                    : 'Choose a reserve from any position.'}
              </Label>
              {activePlayer && (
                <View style={s.wrap}>
                  {activeSlot < 15 && (
                    <>
                      <Button
                        compact
                        selected={squad.draft.captainId === activePlayer.id}
                        label={`Make ${activePlayer.name} captain`}
                        onPress={() =>
                          squad.update((d) => assignCaptain(d, activePlayer.id, 'captain'))
                        }
                        disabled={!editable}
                      >
                        Captain
                      </Button>
                      <Button
                        compact
                        selected={squad.draft.viceCaptainId === activePlayer.id}
                        label={`Make ${activePlayer.name} vice-captain`}
                        onPress={() =>
                          squad.update((d) => assignCaptain(d, activePlayer.id, 'vice'))
                        }
                        disabled={!editable}
                      >
                        Vice-captain
                      </Button>
                    </>
                  )}
                  <Button
                    compact
                    variant="danger"
                    label={`Remove ${activePlayer.name}`}
                    disabled={!editable}
                    onPress={() => remove(activeSlot)}
                  >
                    Remove
                  </Button>
                </View>
              )}
            </View>
            <TextInput
              accessibilityLabel="Search players"
              placeholder="Search player, nation or position…"
              placeholderTextColor={c.muted}
              value={query}
              onChangeText={(text) => {
                setQuery(text);
                setLimit(12);
              }}
              style={s.search}
            />
            <Text style={s.filterLabel}>POSITION</Text>
            <View style={s.wrap}>
              {(['All', ...POSITIONS] as const).map((p) => (
                <Button
                  key={p}
                  compact
                  label={`Filter position: ${p}`}
                  selected={position === p}
                  onPress={() => {
                    setPosition(p);
                    setLimit(12);
                  }}
                >
                  {p}
                </Button>
              ))}
            </View>
            <Text style={s.filterLabel}>NATION</Text>
            <View style={s.wrap}>
              {(['All', ...NATIONS] as const).map((n) => (
                <Button
                  key={n}
                  compact
                  label={`Filter nation: ${n}`}
                  selected={nation === n}
                  onPress={() => {
                    setNation(n);
                    setLimit(12);
                  }}
                >
                  {n === 'All' ? 'All' : shortNation[n]}
                </Button>
              ))}
            </View>
            <View style={s.poolTableHeading}>
              <Label muted>{filtered.length} players</Label>
              <Label muted>PRICE / CREDITS</Label>
            </View>
            {filtered.length === 0 && (
              <View style={s.empty}>
                <Text style={s.h3}>No players found</Text>
                <Label muted>Try another name or clear your filters.</Label>
                <Button
                  onPress={() => {
                    setQuery('');
                    setNation('All');
                    setPosition(requiredPosition ?? 'All');
                  }}
                >
                  Clear filters
                </Button>
              </View>
            )}
            {filtered.slice(0, limit).map((player) => (
              <PlayerPoolRow
                key={player.id}
                player={player}
                selected={squad.draft.slots.includes(player.id)}
                compatible={!requiredPosition || player.position === requiredPosition}
                editable={editable}
                requiredPosition={requiredPosition}
                cost={cost}
                activePriceTenths={activePlayer?.priceTenths ?? 0}
                activeNation={activePlayer?.nation}
                nationCount={nationCounts[player.nation] ?? 0}
                onDetail={setDetail}
                onAdd={add}
              />
            ))}
            {filtered.length > limit && (
              <Button onPress={() => setLimit((n) => n + 12)}>
                Show more players ({filtered.length - limit} remaining)
              </Button>
            )}
            <Button compact onPress={() => setTacticalDrawer(true)}>
              Captaincy & scoring rules
            </Button>
          </View>
        </View>
        <View style={s.footer}>
          <Text style={s.footerBrand}>6Nations / INDEPENDENT FANTASY RUGBY</Text>
          <Label muted>
            Demo only · No official tournament affiliation · No real squad submission
          </Label>
        </View>
      </ScrollView>
      {mobile && (
        <View style={s.mobileActionBar}>
          <View style={s.mobileActionCopy}>
            <Text style={s.mobileActionTitle}>{picked.length} / 18 selected</Text>
            <Text style={s.mobileActionMeta}>{issues.length ? `${issues.length} checks to fix` : 'Ready to review and lock'}</Text>
          </View>
          <Button
            variant="primary"
            disabled={squad.saving || squad.locked}
            onPress={() => {
              if (issues.length > 0) openReview();
              else void lockSquad();
            }}
          >
            {squad.locked ? 'LOCKED' : squad.saving ? 'SAVING…' : issues.length > 0 ? 'REVIEW SQUAD' : 'LOCK SQUAD'}
          </Button>
        </View>
      )}
      <CommandDock
        active="/squad"
        alertCount={issues.length}
        onOpenHub={() => setHubDrawer(true)}
        onOpenTactical={() => setTacticalDrawer(true)}
      />

      <Modal visible={hubDrawer} transparent animationType={reduceMotion ? 'none' : 'fade'} onRequestClose={() => setHubDrawer(false)}>
        <View style={s.drawerBackdrop}>
          <View accessibilityViewIsModal style={s.drawerCard}>
            <View style={s.drawerHeader}>
              <View>
                <Text style={s.drawerTitle}>TOURNAMENT HUB</Text>
                <Label muted>Six Nations Fantasy · 2027</Label>
              </View>
              <Button compact label="Close Tournament Hub" onPress={() => setHubDrawer(false)}>Close</Button>
            </View>
            <View style={s.drawerSnapshot}>
              <Text style={s.smallHeading}>ACTIVE GAMEWEEK</Text>
              <Text style={s.drawerMetric}>Round 1 of 5</Text>
              <Text style={s.drawerAccent}>Lockout in 2d 14h</Text>
              <Text style={s.drawerRank}>Overall rank · — (demo)</Text>
            </View>
            <Text style={s.filterLabel}>TOURNAMENT SECTIONS</Text>
            {['My Squad', 'Match Center', 'Leagues', 'Stats & Fixtures', 'Rules & Admin'].map((item, index) => (
              <Pressable
                key={item}
                accessibilityRole="button"
                onPress={() => {
                  setHubDrawer(false);
                  if (index === 0) router.push('/squad');
                  if (index === 1) router.push('/matches');
                  if (index === 2) router.push('/leagues');
                  if (index === 3) router.push('/stats');
                }}
                style={[s.drawerNavRow, index === 0 && s.drawerNavActive]}
              >
                <View>
                  <Text style={s.drawerNavTitle}>{item}</Text>
                  <Text style={s.drawerNavCopy}>{index === 0 ? 'Tactical pitch & dugout bench' : index === 1 ? 'Fixtures and live match status' : index === 2 ? 'Private and global standings' : index === 3 ? 'Scoring, form, and rankings' : 'Competition rules and administration'}</Text>
                </View>
                <Text style={s.drawerChevron}>{index === 4 ? 'INFO' : 'OPEN'}</Text>
              </Pressable>
            ))}
            <View style={s.drawerNote}>
              <Text style={s.smallHeading}>DEMO MODE</Text>
              <Label muted>Local draft storage is active. Account sync and official submission are not connected in this preview.</Label>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={tacticalDrawer} transparent animationType={reduceMotion ? 'none' : 'fade'} onRequestClose={() => setTacticalDrawer(false)}>
        <View style={s.drawerBackdrop}>
          <View accessibilityViewIsModal style={s.drawerCard}>
            <View style={s.drawerHeader}>
              <View>
                <Text style={s.drawerTitle}>TACTICAL INTELLIGENCE</Text>
                <Label muted>Captaincy & roster compliance</Label>
              </View>
              <Button compact label="Close Tactical Desk" onPress={() => setTacticalDrawer(false)}>Close</Button>
            </View>
            <View style={s.drawerSnapshot}>
              <Text style={s.drawerAccent}>CAPTAINCY</Text>
              <Text style={s.drawerMetric}>{captain?.name ?? 'No captain selected'}</Text>
              <Text style={s.drawerRank}>C · 2.0× multiplier · scoring data unavailable in demo</Text>
              <Text style={s.drawerRank}>VC · {vice?.name ?? 'No vice-captain selected'}</Text>
            </View>
            <View style={s.auditPanel}>
              <View style={s.auditRow}><Text style={s.auditLabel}>Squad size</Text><Text style={s.auditValue}>{picked.length} / 18</Text></View>
              <View style={s.auditRow}><Text style={s.auditLabel}>Salary cap</Text><Text style={s.auditValue}>{credits(cost)} / 100.0 cr</Text></View>
              <View style={s.auditRow}><Text style={s.auditLabel}>Nation limit</Text><Text style={s.auditValue}>{issues.some((i) => i.code === 'NATION') ? 'Needs attention' : 'Compliant'}</Text></View>
              <View style={s.auditRow}><Text style={s.auditLabel}>Leadership</Text><Text style={s.auditValue}>{captain && vice ? 'C & VC active' : 'Incomplete'}</Text></View>
            </View>
            <Text style={s.filterLabel}>NATION DISTRIBUTION</Text>
            <View style={s.drawerNationGrid}>
              {NATIONS.map((n) => <Text key={n} style={s.drawerNation}>{shortNation[n]} {picked.filter((p) => p.nation === n).length}/4</Text>)}
            </View>
            <Button
              variant="primary"
              disabled={!editable || squad.transfersRemaining === 0}
              label="Open Transfer Market"
              onPress={() => {
                setTransferSlot(activeSlot < 18 ? activeSlot : 0);
                setTransferMarket(true);
                setTacticalDrawer(false);
              }}
            >
              Transfer Market · {squad.transfersRemaining} free
            </Button>
          </View>
        </View>
      </Modal>

      <Modal visible={transferMarket} transparent animationType={reduceMotion ? 'none' : mobile ? 'slide' : 'fade'} onRequestClose={() => setTransferMarket(false)}>
        <View style={[s.modalBackdrop, mobile && s.modalBackdropMobile]}>
          <View accessibilityViewIsModal style={[s.modalCard, mobile && s.modalCardMobile]}>
            <Text style={s.eyebrow}>TRANSFER MARKET</Text>
            <Text accessibilityRole="header" style={s.modalTitle}>Make a squad transfer</Text>
            <Label muted>{squad.transfersRemaining} free transfer{squad.transfersRemaining === 1 ? '' : 's'} remaining this round. Select a starting slot, then choose a compatible replacement.</Label>
            <Text style={s.filterLabel}>SLOT TO REPLACE</Text>
            <View style={s.wrap}>
              {squad.draft.slots.map((id, index) => {
                const player = squad.players.find((p) => p.id === id);
                return player ? (
                  <Button key={index} compact selected={transferSlot === index} onPress={() => setTransferSlot(index)}>
                    {index < 15 ? `${index + 1}. ${player.name.split(' ').at(-1)}` : `R${index - 14}. ${player.name.split(' ').at(-1)}`}
                  </Button>
                ) : null;
              })}
            </View>
            <View style={s.transferList}>
              {squad.players.filter((player) => !squad.draft.slots.includes(player.id) && (transferSlot < 15 ? player.position === FORMATION[transferSlot] : true)).slice(0, 8).map((player) => (
                <View key={player.id} style={s.transferRow}>
                  <View style={s.playerInfo}>
                    <Text style={s.playerName}>{player.name}</Text>
                    <Text style={s.playerMeta}>{shortNation[player.nation]} · {player.position} · {player.fantasyPoints} fantasy points</Text>
                  </View>
                  <Button compact variant="primary" label={`Transfer in ${player.name}`} onPress={async () => {
                    const success = await squad.useTransfer((draft) => putPlayer(draft, transferSlot, player));
                    if (success) setTransferMarket(false);
                  }}>Transfer in</Button>
                </View>
              ))}
            </View>
            <View style={s.modalClose}><Button onPress={() => setTransferMarket(false)}>Keep current squad</Button></View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!detail}
        transparent
        animationType={reduceMotion ? 'none' : mobile ? 'slide' : 'fade'}
        onRequestClose={() => setDetail(null)}
      >
        <View style={[s.modalBackdrop, mobile && s.modalBackdropMobile]}>
          <Pressable
            onPress={() => setDetail(null)}
            style={s.profileBackdropClose}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
          <View accessibilityViewIsModal style={[s.modalCard, mobile && s.modalCardMobile]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close player details"
              accessibilityHint="Dismisses this player profile"
              onPress={() => setDetail(null)}
              style={s.profileClose}
              hitSlop={8}
            >
              <View style={s.profileCloseLineA} />
              <View style={s.profileCloseLineB} />
            </Pressable>
            <ScrollView keyboardShouldPersistTaps="handled">
              <View style={s.profileHero}>
                {detail && (
                  <PlayerJersey
                    player={detail}
                    teamColor={jerseyColors[detail.nation].fabric}
                    detailColor={jerseyColors[detail.nation].trim}
                    numberColor={jerseyColors[detail.nation].number}
                    teamCode={shortNation[detail.nation]}
                    slotLabel={detail.position}
                    role={role(detail.id) as 'C' | 'VC' | null}
                  />
                )}
                <View style={s.profileHeroCopy}>
                  <Text style={s.eyebrow}>PLAYER PROFILE · ROUND 01</Text>
                  <Text accessibilityRole="header" style={s.modalTitle}>{detail?.name}</Text>
                  <Label>{detail?.nation} · {detail?.position}</Label>
                  <Text style={s.profileForm}>FORM {detail?.form.toFixed(1) ?? '—'} <Text style={s.profileFormMuted}>/ LAST 5</Text></Text>
                </View>
              </View>
              <Text style={s.detailPrice}>
                {detail ? credits(detail.priceTenths) : ''}{' '}
                <Text style={s.metricUnit}>credits</Text>
              </Text>
              <View style={s.playerStatGrid}>
                <View><Text style={s.metricCaption}>FANTASY POINTS</Text><Text style={s.playerStat}>{detail?.fantasyPoints ?? 0}</Text></View>
                <View><Text style={s.metricCaption}>FORM</Text><Text style={s.playerStat}>{detail?.form.toFixed(1) ?? '—'}</Text></View>
                <View><Text style={s.metricCaption}>APPEARANCES</Text><Text style={s.playerStat}>{detail?.appearances ?? 0}</Text></View>
              </View>
              <Label muted>{detail?.description}</Label>
              <View style={s.fixtureList}>
                {fixtures.slice(0, 3).map((fixture) => (
                  <View key={`${fixture.home}-${fixture.away}-profile`} style={s.fixtureCard}>
                    <View style={[s.fixtureStripe, { backgroundColor: fixture.tone }]} />
                    <Text style={s.fixtureTeams}>{fixture.home} <Text style={s.fixtureVs}>vs</Text> {fixture.away}</Text>
                    <Text style={s.fixtureTime}>{fixture.time}</Text>
                  </View>
                ))}
              </View>
              <View style={s.tip}>
                <Label muted>
                  Points are the published fantasy total for this round preview. Captain scores are
                  multiplied by 2×; vice-captain receives the captaincy fallback when required.
                </Label>
              </View>
              {detail &&
                !squad.draft.slots.includes(detail.id) &&
                (!requiredPosition || requiredPosition === detail.position) && (
                  <Button
                    variant="primary"
                    disabled={!squad.storageReady}
                    onPress={() => add(detail)}
                  >
                    Add to {slotLabel(activeSlot)}
                  </Button>
                )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={review}
        transparent
        animationType={reduceMotion ? 'none' : mobile ? 'slide' : 'fade'}
        onRequestClose={() => {
          if (!confirming) setReview(false);
        }}
      >
        <View style={[s.modalBackdrop, mobile && s.modalBackdropMobile]}>
          <View accessibilityViewIsModal style={[s.modalCard, mobile && s.modalCardMobile]}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={s.eyebrow}>
                {confirmed ? 'SAVED ON THIS DEVICE' : 'ONE LAST TEAM TALK'}
              </Text>
              <Text accessibilityRole="header" style={s.modalTitle}>
                {confirmed ? 'Your demo squad is ready.' : 'Review your squad'}
              </Text>
              <Label muted>
                {confirmed
                  ? 'This is a local demo confirmation. Nothing was submitted to the game server.'
                  : 'Check your selection before saving a local demo confirmation.'}
              </Label>
              <View style={s.reviewSummary}>
                <Label>
                  {picked.length} / 18 players · {credits(cost)} / 100.0 credits
                </Label>
                <Label>C · {captain?.name ?? 'Not selected'}</Label>
                <Label>VC · {vice?.name ?? 'Not selected'}</Label>
              </View>
              {!confirmed && issues.length > 0 && (
                <View accessibilityRole="alert" style={s.errorBox}>
                  <Text style={s.h3}>Before you can confirm</Text>
                  {issues.map((issue, i) => (
                    <Label key={`${issue.code}-${i}`}>• {issue.message}</Label>
                  ))}
                </View>
              )}
              {!confirmed && issues.length === 0 && (
                <View style={s.successBox}>
                  <Label>All squad checks passed.</Label>
                </View>
              )}
              <View style={s.reviewLineup}>
                {squad.draft.slots.map((id, index) => {
                  const player = squad.players.find((p) => p.id === id);
                  return (
                    <View key={index} style={s.reviewRow}>
                      <Text style={s.reviewPosition}>{slotLabel(index)}</Text>
                      <Text style={s.reviewName}>
                        {player?.name ?? 'Empty'}
                        {id && role(id) ? ` · ${role(id)}` : ''}
                      </Text>
                    </View>
                  );
                })}
              </View>
              {squad.error && (
                <View accessibilityRole="alert" style={s.errorBox}>
                  <Label>{squad.error}</Label>
                </View>
              )}
              {!confirmed && (
                <Button
                  variant="primary"
                  disabled={issues.length > 0 || confirming || squad.saving || !squad.storageReady}
                  onPress={async () => {
                    setConfirming(true);
                    const success = await squad.confirm();
                    setConfirming(false);
                    if (success) setConfirmed(true);
                  }}
                >
                  {confirming ? 'Saving…' : 'Confirm demo squad'}
                </Button>
              )}
              <View style={s.modalClose}>
                <Button disabled={confirming} onPress={() => setReview(false)}>
                  {confirmed ? 'Back to squad' : 'Continue editing'}
                </Button>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={resetting}
        transparent
        animationType={mobile ? 'slide' : 'fade'}
        onRequestClose={() => setResetting(false)}
      >
        <View style={[s.modalBackdrop, mobile && s.modalBackdropMobile]}>
          <View accessibilityViewIsModal style={[s.modalCard, mobile && s.modalCardMobile]}>
            <Text style={s.modalTitle}>Start fresh?</Text>
            <Label muted>This clears your draft and demo confirmation on this device.</Label>
            <View style={s.modalClose}>
              <Button
                variant="danger"
                onPress={() => {
                  squad.reset();
                  setResetting(false);
                  chooseSlot(0, false);
                }}
              >
                Clear saved demo
              </Button>
            </View>
            <View style={s.modalClose}>
              <Button onPress={() => setResetting(false)}>Keep my squad</Button>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.bg },
  atmosphere: { ...StyleSheet.absoluteFill, overflow: 'hidden' },
  atmosphereGlow: { position: 'absolute', width: 620, height: 620, borderRadius: 310, top: -290, right: -180, backgroundColor: c.pitchLight, opacity: 0.12 },
  atmosphereGlowSecondary: { position: 'absolute', width: 460, height: 460, borderRadius: 230, bottom: -250, left: '28%', backgroundColor: c.emerald, opacity: 0.045 },
  atmosphereVignette: { ...StyleSheet.absoluteFill, borderWidth: 32, borderColor: c.pitchShadow, opacity: 0.12 },
  loading: {
    flex: 1,
    backgroundColor: c.bg,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  page: {
    paddingHorizontal: 20,
    paddingBottom: 196,
    width: '100%',
    maxWidth: 1440,
    alignSelf: 'center',
  },
  pageWide: { paddingHorizontal: 40, marginLeft: 192 },
  header: {
    minHeight: 76,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
    paddingVertical: 14,
    flexWrap: 'wrap',
  },
  headerLead: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1 },
  menuButton: {
    minHeight: 40,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.panel,
    justifyContent: 'center',
  },
  menuButtonText: { color: c.emerald, fontFamily: fonts.medium, fontSize: 12, letterSpacing: 1 },
  menuButtonLabel: { color: c.text, fontFamily: fonts.medium, fontSize: 11, letterSpacing: 1 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  brandMark: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: c.lowest,
  },
  brandGlyph: { fontFamily: fonts.heading, fontSize: 28, color: c.onAccent },
  wordmark: { color: c.text, fontFamily: fonts.heading, fontSize: 22, letterSpacing: 1.8 },
  brandSub: { color: c.muted, fontFamily: fonts.medium, fontSize: 11, letterSpacing: 1.2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 16, flexWrap: 'wrap', flexShrink: 1 },
  headerRightMobile: { width: '100%', gap: 8, justifyContent: 'space-between' },
  desktopStatusGroup: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  mobileStatusBar: { flex: 1, minWidth: 0, gap: 4 },
  headerDesk: { gap: 3, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: c.accentSoft, borderRadius: 4 },
  headerDeskLabel: { color: c.text, fontFamily: fonts.medium, fontSize: 12, letterSpacing: 1 },
  headerDeskStatus: { color: c.emerald, fontFamily: fonts.medium, fontSize: 11, letterSpacing: 0.8 },
  syncStatus: { color: c.teal, fontFamily: fonts.medium, fontSize: 12, letterSpacing: 0.7 },
  demoPill: {
    color: c.emerald,
    backgroundColor: c.accentSoft,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: fonts.medium,
    fontSize: 12,
    letterSpacing: 1,
    borderRadius: 6,
  },
  manager: { color: c.text, fontFamily: fonts.medium, fontSize: 14 },
  lockout: { color: c.amber, fontFamily: fonts.medium, fontSize: 12, letterSpacing: 0.8 },
  lockButton: { minHeight: 42, paddingHorizontal: 16, justifyContent: 'center', backgroundColor: c.accentFill, borderRadius: 8 },
  lockButtonText: { color: c.onAccent, fontFamily: fonts.medium, fontSize: 12, letterSpacing: 0.8 },
  mobileActionBar: { position: 'absolute', left: 0, right: 0, bottom: 72, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: c.navSurface, borderTopWidth: 1, borderTopColor: c.emerald, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, zIndex: 110 },
  mobileActionCopy: { flex: 1, minWidth: 0, gap: 3 },
  mobileActionTitle: { color: c.text, fontFamily: fonts.medium, fontSize: 13 },
  mobileActionMeta: { color: c.muted, fontFamily: fonts.body, fontSize: 11 },
  hero: {
    paddingVertical: 36,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 24,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroText: { flexGrow: 1, flexShrink: 1 },
  heroAside: { maxWidth: 280, gap: 4 },
  deadlineCard: { width: 250, minHeight: 118, padding: 16, borderWidth: 1, borderColor: c.amber, borderRadius: 12, backgroundColor: c.raised, shadowColor: c.amber, shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, gap: 5 },
  deadlineTopline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  deadlineLabel: { color: c.amber, fontFamily: fonts.medium, fontSize: 11, letterSpacing: 1.6 },
  previewDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: c.amber },
  deadlineDate: { color: c.text, fontFamily: fonts.medium, fontSize: 17, marginTop: 5 },
  deadlineCountdown: { color: c.text, fontFamily: fonts.heading, fontSize: 30, letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  deadlineHint: { color: c.muted, fontFamily: fonts.body, fontSize: 12 },
  commandStrip: {
    minHeight: 76,
    padding: 14,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    backgroundColor: c.lowest,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    shadowColor: c.shadow,
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  commandLead: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 220 },
  commandTitle: { color: c.text, fontFamily: fonts.medium, fontSize: 12, letterSpacing: 1.1 },
  commandCopy: { color: c.muted, fontFamily: fonts.body, fontSize: 12, marginTop: 3 },
  commandStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
  commandStat: { minWidth: 92, gap: 3 },
  commandStatLabel: { color: c.muted, fontFamily: fonts.medium, fontSize: 10, letterSpacing: 0.9 },
  commandStatValue: { color: c.emerald, fontFamily: fonts.heading, fontSize: 14, fontVariant: ['tabular-nums'] },
  commandWarning: { color: c.amber },
  eyebrow: {
    color: c.emerald,
    fontFamily: fonts.medium,
    fontSize: 11,
    letterSpacing: 0.2,
    marginBottom: 10,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 48,
    lineHeight: 54,
    color: c.text,
    marginBottom: 12,
  },
  workflowSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 16,
    paddingVertical: 14,
    marginBottom: 24,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: c.border,
  },
  workflowStat: { minWidth: 84, gap: 2 },
  workflowValue: { color: c.text, fontFamily: fonts.heading, fontSize: 18, fontVariant: ['tabular-nums'] },
  workflowWarning: { color: c.amber },
  workflowLabel: { color: c.muted, fontFamily: fonts.medium, fontSize: 10, letterSpacing: 1 },
  workflowRule: { width: 1, height: 28, backgroundColor: c.border },
  workflowHint: { flexGrow: 1, minWidth: 220, marginLeft: 'auto' },
  metric: {
    flexGrow: 1,
    flexBasis: 260,
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.lowest,
    gap: 8,
    shadowColor: c.shadow,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  metricCaption: { fontFamily: fonts.medium, fontSize: 12, letterSpacing: 1.2, color: c.muted },
  metricValue: {
    fontFamily: fonts.heading,
    fontSize: 36,
    color: c.text,
    fontVariant: ['tabular-nums'],
  },
  metricUnit: { color: c.muted, fontSize: 15, fontFamily: fonts.body },
  captainLine: {
    fontFamily: fonts.medium,
    fontSize: 19,
    color: c.text,
    marginTop: 8,
    marginBottom: 6,
  },
  progressTrack: { height: 4, backgroundColor: c.border, borderRadius: 2, overflow: 'hidden' },
  progress: { height: 4 },
  columns: { gap: 24 },
  columnsWide: { flexDirection: 'row', alignItems: 'flex-start', gap: 28 },
  squadPanel: { minWidth: 0 },
  poolPanel: {
    minWidth: 0,
    borderLeftWidth: 1,
    borderLeftColor: c.border,
    paddingLeft: 22,
    paddingVertical: 4,
  },
  sectionHeading: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  sectionTitleLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  selectionPill: { color: c.muted, fontFamily: fonts.medium, fontSize: 12 },
  h2: { color: c.text, fontFamily: fonts.heading, fontSize: 26, lineHeight: 32, marginBottom: 4 },
  h3: { color: c.text, fontFamily: fonts.heading, fontSize: 19, marginBottom: 4 },
  smallHeading: {
    color: c.muted,
    fontFamily: fonts.medium,
    fontSize: 12,
    letterSpacing: 1,
    lineHeight: 17,
  },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pitch: {
    backgroundColor: c.pitch,
    borderRadius: 18,
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 26,
    gap: 5,
    borderWidth: 1,
    borderColor: c.pitchBorder,
    minHeight: 650,
    shadowColor: c.shadow,
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
  },
  pitchMobile: { paddingHorizontal: 5, paddingVertical: 20, gap: 3, minHeight: 650 },
  pitchStripe: {
    position: 'absolute',
    top: '0%',
    height: '16.6%',
    width: '100%',
    backgroundColor: c.pitchStripe,
    opacity: 0.5,
  },
  pitchLight: { position: 'absolute', top: -140, left: '18%', width: '64%', height: 280, borderRadius: 180, backgroundColor: c.pitchLight, opacity: 0.25 },
  pitchShadow: { position: 'absolute', bottom: -120, left: '-10%', width: '120%', height: 240, borderRadius: 200, backgroundColor: c.pitchShadow, opacity: 0.32 },
  pitchBoundary: {
    position: 'absolute',
    top: 18,
    bottom: 18,
    left: 12,
    right: 12,
    borderWidth: 1,
    borderColor: c.line,
    opacity: 0.52,
  },
  deadBallTop: { position: 'absolute', top: 8, left: 12, right: 12, borderTopWidth: 1, borderColor: c.line, opacity: 0.45 },
  deadBallBottom: { position: 'absolute', bottom: 8, left: 12, right: 12, borderTopWidth: 1, borderColor: c.line, opacity: 0.45 },
  tryLineTop: { position: 'absolute', top: '13%', left: 12, right: 12, borderTopWidth: 2, borderColor: c.line, opacity: 0.8 },
  tryLineBottom: { position: 'absolute', top: '87%', left: 12, right: 12, borderTopWidth: 2, borderColor: c.line, opacity: 0.8 },
  twentyTwoTop: { position: 'absolute', top: '27%', left: 12, right: 12, borderTopWidth: 1, borderColor: c.line, opacity: 0.6 },
  twentyTwoBottom: { position: 'absolute', top: '73%', left: 12, right: 12, borderTopWidth: 1, borderColor: c.line, opacity: 0.6 },
  tenMetreTop: { position: 'absolute', top: '40%', left: 12, right: 12, borderTopWidth: 1, borderColor: c.line, opacity: 0.35 },
  tenMetreBottom: { position: 'absolute', top: '60%', left: 12, right: 12, borderTopWidth: 1, borderColor: c.line, opacity: 0.35 },
  goalPosts: { position: 'absolute', left: '39%', width: '22%', height: 34, alignItems: 'center', justifyContent: 'space-between', flexDirection: 'row', opacity: 0.8 },
  goalPostsTop: { top: '5%' },
  goalPostsBottom: { bottom: '5%' },
  goalUpright: { width: 2, height: 34, backgroundColor: c.line },
  goalCrossbar: { position: 'absolute', left: 0, right: 0, top: 15, height: 2, backgroundColor: c.line },
  halfway: {
    position: 'absolute',
    top: '50%',
    left: 12,
    right: 12,
    borderTopWidth: 1,
    borderColor: c.line,
    opacity: 0.52,
  },
  pitchLegend: {
    color: c.pitchText,
    fontFamily: fonts.medium,
    fontSize: 10,
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 4,
  },
  pitchHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  attackDirection: { color: c.pitchText, fontFamily: fonts.medium, fontSize: 11, letterSpacing: 1.1 },
  pitchLabels: { position: 'absolute', left: 5, top: '18%', bottom: '8%', justifyContent: 'space-around', opacity: 0.78 },
  pitchLabel: { color: c.pitchMuted, fontFamily: fonts.medium, fontSize: 7, letterSpacing: 0.6, transform: [{ rotate: '-90deg' }] },
  pitchRow: { flexDirection: 'row', gap: 9, justifyContent: 'center', alignSelf: 'center', zIndex: 1, minHeight: 108 },
  pitchRowMobile: { width: '100%', gap: 2, minHeight: 92 },
  backThreeRow: { width: '92%', gap: 14 },
  backThreeRowMobile: { width: '100%', gap: 2 },
  centresRow: { width: '62%', gap: 24 },
  centresRowMobile: { width: '74%', gap: 2 },
  halfRow: { width: '30%' },
  halfRowMobile: { width: '44%' },
  backRow: { width: '72%', gap: 14 },
  backRowMobile: { width: '86%', gap: 2 },
  locksRow: { width: '52%', gap: 30 },
  locksRowMobile: { width: '72%', gap: 2 },
  frontRow: { width: '78%', gap: 14 },
  frontRowMobile: { width: '94%', gap: 2 },
  slot: {
    flex: 1,
    minWidth: 76,
    maxWidth: 142,
  },
  slotMobile: { minWidth: 0, maxWidth: 142 },
  activeSlot: {},
  slotTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  slotNumber: { color: c.muted, fontFamily: fonts.medium, fontSize: 12 },
  roleBadge: {
    color: c.onAccent,
    backgroundColor: c.amber,
    fontFamily: fonts.medium,
    fontSize: 11,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 2,
    overflow: 'hidden',
  },
  slotName: { color: c.text, fontFamily: fonts.medium, fontSize: 12, lineHeight: 16 },
  slotPoints: { color: c.teal, fontFamily: fonts.body, fontSize: 11 },
  slotPosition: { color: c.muted, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, marginTop: 2 },
  squadCountAnchor: { position: 'absolute', opacity: 0, width: 1, height: 1 },
  slotMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  nationBadge: {
    alignSelf: 'flex-start',
    fontFamily: fonts.medium,
    fontSize: 11,
    letterSpacing: 1,
  },
  slotList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  listSlot: { flexBasis: '45%', maxWidth: '100%', flexGrow: 1 },
  reserveHeading: { marginTop: 24, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 },
  reserveCount: { color: c.teal, fontFamily: fonts.medium, fontSize: 11, letterSpacing: 0.8 },
  reserveRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  reserveItem: { flex: 1, minWidth: 0, gap: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: c.border },
  reserveItemMobile: { flexBasis: '100%', flexGrow: 0 },
  reserveControls: { flexDirection: 'row', gap: 6, justifyContent: 'flex-start', flexWrap: 'wrap' },
  reserveCover: { color: c.muted, fontFamily: fonts.body, fontSize: 12, lineHeight: 18, textAlign: 'left' },
  nationPanel: {
    padding: 16,
    marginTop: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: c.border,
    backgroundColor: 'transparent',
  },
  nationCounts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 18,
    justifyContent: 'space-between',
    marginTop: 12,
  },
  nationCount: { alignItems: 'center', gap: 6 },
  nationAbbr: { fontFamily: fonts.medium, fontSize: 12, letterSpacing: 1 },
  count: { fontFamily: fonts.heading, fontSize: 21, color: c.text },
  localStatus: { marginVertical: 16, gap: 4 },
  status: { color: c.emerald, fontFamily: fonts.medium, fontSize: 12 },
  actions: { gap: 8 },
  validationCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, marginTop: 22, borderWidth: 1, borderColor: c.emerald, borderRadius: 12, backgroundColor: c.accentSoft },
  validationIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: c.emerald },
  validationIconText: { color: c.onAccent, fontFamily: fonts.heading, fontSize: 18 },
  validationCopy: { flex: 1, gap: 3 },
  validationTitle: { color: c.emerald, fontFamily: fonts.heading, fontSize: 16 },
  validationTitleWarning: { color: c.amber, fontFamily: fonts.heading, fontSize: 16 },
  validationMessage: { color: c.muted, fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
  activeSelection: {
    backgroundColor: 'transparent',
    paddingVertical: 14,
    paddingHorizontal: 0,
    gap: 8,
    marginVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  search: {
    minHeight: 52,
    color: c.text,
    fontFamily: fonts.body,
    fontSize: 14,
    padding: 14,
    backgroundColor: c.inputBackground,
    borderColor: c.border,
    borderWidth: 1,
    borderRadius: 10,
  },
  filterLabel: {
    color: c.muted,
    fontFamily: fonts.medium,
    fontSize: 12,
    letterSpacing: 1,
    marginTop: 18,
    marginBottom: 8,
  },
  poolTableHeading: {
    marginTop: 24,
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  playerRowSelected: { backgroundColor: c.accentSoft, borderLeftWidth: 3, borderLeftColor: c.emerald, paddingLeft: 10 },
  playerRowDisabled: { backgroundColor: c.raised },
  playerRowWarning: { borderLeftWidth: 2, borderLeftColor: c.amber, paddingLeft: 10 },
  playerAvatar: {
    width: 40,
    height: 40,
    borderWidth: 2,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: c.jerseyNeck,
  },
  avatarNumber: { fontFamily: fonts.heading, fontSize: 18 },
  playerInfo: { flex: 1, minWidth: 0 },
  playerNameButton: { minHeight: 48, justifyContent: 'center', gap: 4 },
  playerName: { color: c.text, fontFamily: fonts.medium, fontSize: 15, lineHeight: 21 },
  infoIcon: { color: c.muted },
  playerBadges: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  positionBadge: {
    color: c.muted,
    fontFamily: fonts.medium,
    fontSize: 10,
    backgroundColor: c.active,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
  },
  playerMeta: { color: c.muted, fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
  playerForm: { color: c.muted, fontFamily: fonts.body, fontSize: 11, marginTop: 3 },
  playerFormValue: { color: c.emerald, fontFamily: fonts.medium },
  playerPrice: { gap: 6, alignItems: 'center' },
  price: { color: c.text, fontFamily: fonts.medium, fontSize: 16, fontVariant: ['tabular-nums'] },
  warningText: { color: c.amber, fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
  tip: {
    backgroundColor: c.raised,
    borderRadius: 4,
    padding: 16,
    marginTop: 20,
    marginBottom: 16,
    gap: 6,
  },
  infoCard: { padding: 18, marginTop: 18, borderWidth: 1, borderColor: c.border, borderRadius: 12, backgroundColor: c.raised, gap: 14 },
  infoCardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  crown: { color: c.amber, fontSize: 26 },
  leaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 12, borderTopWidth: 1, borderTopColor: c.border },
  leaderBadge: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: c.amber },
  viceBadge: { backgroundColor: c.teal },
  leaderBadgeText: { color: c.onBadge, fontFamily: fonts.heading, fontSize: 12 },
  leaderCopy: { flex: 1, minWidth: 0, gap: 2 },
  leaderTitle: { color: c.text, fontFamily: fonts.medium, fontSize: 14 },
  leaderMeta: { color: c.muted, fontFamily: fonts.body, fontSize: 12 },
  fixtureList: { gap: 8, marginTop: 2 },
  fixtureCard: { position: 'relative', overflow: 'hidden', paddingVertical: 11, paddingLeft: 14, paddingRight: 10, borderRadius: 8, backgroundColor: c.panel, gap: 3 },
  fixtureStripe: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  fixtureTeams: { color: c.text, fontFamily: fonts.heading, fontSize: 15, letterSpacing: 0.6 },
  fixtureVs: { color: c.muted, fontFamily: fonts.body, fontSize: 11 },
  fixtureTime: { color: c.muted, fontFamily: fonts.body, fontSize: 12 },
  scoringCard: { padding: 18, marginTop: 18, borderWidth: 1, borderColor: c.border, borderRadius: 12, backgroundColor: c.panel, gap: 0 },
  scoringMark: { color: c.emerald, fontSize: 22 },
  scoringRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 11, borderTopWidth: 1, borderTopColor: c.border },
  scoringLabel: { color: c.muted, fontFamily: fonts.body, fontSize: 13 },
  scoringValue: { color: c.text, fontFamily: fonts.medium, fontSize: 13 },
  empty: { paddingVertical: 32, gap: 12 },
  errorBox: {
    padding: 16,
    borderWidth: 1,
    borderColor: c.danger,
    backgroundColor: c.dangerSoft,
    borderRadius: 10,
    gap: 12,
    marginBottom: 16,
  },
  dataUnavailable: {
    padding: 18,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.raised,
    borderRadius: 10,
    gap: 6,
    marginBottom: 16,
  },
  dataUnavailableTitle: { color: c.text, fontFamily: fonts.medium, fontSize: 15 },
  successBox: { padding: 16, backgroundColor: c.accentSoft, borderRadius: 4, marginBottom: 16 },
  savedBanner: {
    backgroundColor: c.accentSoft,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 10,
    padding: 16,
    marginBottom: 24,
    gap: 6,
  },
  savedText: { color: c.emerald, fontFamily: fonts.medium, fontSize: 14 },
  footer: { marginTop: 36, paddingTop: 20, borderTopWidth: 1, borderTopColor: c.border, gap: 8 },
  footerBrand: { color: c.muted, fontFamily: fonts.medium, fontSize: 12, letterSpacing: 1.2 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: c.backdrop,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 760,
    maxHeight: '90%',
    backgroundColor: c.panel,
    padding: 28,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: c.border,
    position: 'relative',
    shadowColor: c.shadow,
    shadowOpacity: 0.42,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
  },
  modalBackdropMobile: { justifyContent: 'flex-end', alignItems: 'stretch', padding: 0 },
  modalCardMobile: { maxWidth: '100%', maxHeight: '92%', padding: 20, borderBottomWidth: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderTopLeftRadius: 18, borderTopRightRadius: 18 },
  profileBackdropClose: StyleSheet.absoluteFill,
  modalTitle: {
    color: c.text,
    fontFamily: fonts.heading,
    fontSize: 34,
    lineHeight: 40,
    marginBottom: 12,
  },
  profileHero: { flexDirection: 'row', alignItems: 'center', gap: 18, padding: 14, marginBottom: 18, borderWidth: 1, borderColor: c.border, borderRadius: 14, backgroundColor: c.lowest },
  profileHeroCopy: { flex: 1, minWidth: 0, gap: 6 },
  profileForm: { color: c.emerald, fontFamily: fonts.medium, fontSize: 12, letterSpacing: 1.1, marginTop: 8 },
  profileFormMuted: { color: c.muted, fontFamily: fonts.body, fontSize: 10 },
  profileClose: { position: 'absolute', top: 12, right: 12, zIndex: 2, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: c.raised },
  profileCloseLineA: { position: 'absolute', width: 18, height: 2, borderRadius: 1, backgroundColor: c.text, transform: [{ rotate: '45deg' }] },
  profileCloseLineB: { position: 'absolute', width: 18, height: 2, borderRadius: 1, backgroundColor: c.text, transform: [{ rotate: '-45deg' }] },
  modalClose: { marginTop: 12 },
  drawerBackdrop: { flex: 1, backgroundColor: c.backdrop, justifyContent: 'flex-start', alignItems: 'flex-start' },
  drawerCard: {
    width: '100%',
    maxWidth: 440,
    minHeight: '100%',
    backgroundColor: c.panel,
    padding: 22,
    borderRightWidth: 1,
    borderColor: c.border,
    gap: 12,
  },
  drawerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: c.border },
  drawerTitle: { color: c.text, fontFamily: fonts.heading, fontSize: 18, letterSpacing: 0.8, marginBottom: 4 },
  drawerSnapshot: { padding: 16, backgroundColor: c.raised, borderRadius: 8, gap: 6 },
  drawerMetric: { color: c.text, fontFamily: fonts.heading, fontSize: 22 },
  drawerAccent: { color: c.emerald, fontFamily: fonts.medium, fontSize: 12 },
  drawerRank: { color: c.muted, fontFamily: fonts.body, fontSize: 13, lineHeight: 20 },
  drawerNavRow: { minHeight: 64, padding: 12, borderWidth: 1, borderColor: c.border, borderRadius: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  drawerNavActive: { backgroundColor: c.accentSoft, borderColor: c.emerald },
  drawerNavTitle: { color: c.text, fontFamily: fonts.heading, fontSize: 15 },
  drawerNavCopy: { color: c.muted, fontFamily: fonts.body, fontSize: 13, lineHeight: 19, marginTop: 3 },
  drawerChevron: { color: c.emerald, fontFamily: fonts.medium, fontSize: 11, letterSpacing: 0.8 },
  drawerNote: { padding: 14, backgroundColor: c.lowest, borderRadius: 6, gap: 5 },
  auditPanel: { borderWidth: 1, borderColor: c.border, borderRadius: 6, paddingHorizontal: 14 },
  auditRow: { minHeight: 44, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: c.border },
  auditLabel: { color: c.muted, fontFamily: fonts.body, fontSize: 12 },
  auditValue: { color: c.emerald, fontFamily: fonts.medium, fontSize: 12 },
  drawerNationGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  drawerNation: { color: c.text, backgroundColor: c.raised, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 3, fontFamily: fonts.medium, fontSize: 11 },
  detailPrice: { color: c.emerald, fontFamily: fonts.heading, fontSize: 32, marginVertical: 20 },
  playerStatGrid: { flexDirection: 'row', gap: 22, marginBottom: 18 },
  playerStat: { color: c.text, fontFamily: fonts.heading, fontSize: 24, marginTop: 4 },
  transferList: { marginTop: 18, borderTopWidth: 1, borderTopColor: c.border },
  transferRow: { minHeight: 64, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.border, flexDirection: 'row', alignItems: 'center', gap: 10 },
  reviewSummary: { gap: 8, marginVertical: 20 },
  reviewLineup: { marginBottom: 20 },
  reviewRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  reviewPosition: { color: c.muted, fontFamily: fonts.body, fontSize: 12, minWidth: 130 },
  reviewName: { color: c.text, fontFamily: fonts.medium, fontSize: 13, flexShrink: 1 },
});
