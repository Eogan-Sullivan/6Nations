import { memo, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Image,
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
import { AppTabs } from '../../components/AppScreen';
import { colors as c, fonts } from '../../theme/tokens';
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

const shortNation: Record<Nation, string> = {
  Ireland: 'IRE',
  France: 'FRA',
  England: 'ENG',
  Scotland: 'SCO',
  Wales: 'WAL',
  Italy: 'ITA',
};
const nationColor: Record<Nation, string> = {
  Ireland: '#7EE2A4',
  France: '#9BAFFF',
  England: '#F1F5E9',
  Scotland: '#B8A5F4',
  Wales: '#FFACA6',
  Italy: '#8AD9ED',
};
const jerseyColors: Record<Nation, { fabric: string; trim: string; number: string }> = {
  Ireland: { fabric: '#087F50', trim: '#E8EEDC', number: '#FFFFFF' },
  England: { fabric: '#F2F3ED', trim: '#B92335', number: '#142536' },
  France: { fabric: '#214BB8', trim: '#D94750', number: '#FFFFFF' },
  Scotland: { fabric: '#172B4D', trim: '#E8EEDC', number: '#FFFFFF' },
  Wales: { fabric: '#B32638', trim: '#F4F2EC', number: '#FFFFFF' },
  Italy: { fabric: '#126DB5', trim: '#F4F2EC', number: '#FFFFFF' },
};
const pitchRows = [
  [12, 13, 14],
  [10, 11],
  [8, 9],
  [5, 6, 7],
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
            <Text style={[s.nationBadge, { color: nationColor[player.nation] }]}>{shortNation[player.nation]}</Text>
            <Text style={s.positionBadge}>{player.position}</Text>
          </View>
        </Pressable>
        {!!warning && <Text style={s.warningText}>{warning}</Text>}
        {!compatible && <Text style={s.playerMeta}>Choose a {requiredPosition} slot to add</Text>}
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
  const router = useRouter();
  const squad = useSquad();
  const { width } = useWindowDimensions();
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
  const editable = squad.storageReady && !squad.locked;
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
        style={[s.slot, list && s.listSlot]}
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
      {wide && <AppTabs active="/squad" />}
      <ScrollView
        ref={mainScroll}
        contentContainerStyle={[s.page, wide && s.pageWide]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.header}>
          <View style={s.headerLead}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open Tournament Hub"
              onPress={() => setHubDrawer(true)}
              style={({ pressed }) => [s.menuButton, pressed && { opacity: 0.75 }]}
            >
              <Text style={s.menuButtonText}>MENU</Text>
              {wide && <Text style={s.menuButtonLabel}>MENU</Text>}
            </Pressable>
          <View style={s.brand}>
            <Image
              source={require('../../assets/stitch-logo.jpg')}
              style={s.brandMark}
              accessibilityLabel="6Nations logo"
            />
            <View>
              <Text style={s.wordmark}>6Nations</Text>
              <Text style={s.brandSub}>SIX NATIONS FANTASY · 2027</Text>
            </View>
          </View>
          </View>
          <View style={[s.headerRight, mobile && s.headerRightMobile]}>
            {!mobile && <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open Tactical Desk"
              onPress={() => setTacticalDrawer(true)}
              style={({ pressed }) => [s.headerDesk, pressed && { opacity: 0.75 }]}
            >
              <Text style={s.headerDeskLabel}>TACTICAL DESK</Text>
              <Text style={s.headerDeskStatus}>{issues.length ? 'CHECK SQUAD' : '100% VALID'}</Text>
            </Pressable>}
            <View style={mobile ? s.mobileStatusBar : s.desktopStatusGroup}>
              <Text style={s.demoPill}>DEMO MODE</Text>
              <Text style={s.lockout}>{squad.locked ? 'SAVED ON DEVICE' : 'NO OFFICIAL LOCKOUT'}</Text>
              <Text style={s.syncStatus}>● LOCAL {squad.saving ? 'SAVING' : 'READY'}</Text>
              {!mobile && <Text style={s.manager}>Alex’s XV</Text>}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Save demo squad"
              accessibilityState={{ disabled: squad.saving }}
              disabled={squad.saving || squad.locked}
              onPress={() => void lockSquad()}
              style={({ pressed }) => [s.lockButton, squad.saving && { opacity: 0.5 }, pressed && { opacity: 0.75 }]}
            >
              <Text style={s.lockButtonText}>{squad.locked ? 'SAVED' : squad.saving ? 'SAVING…' : 'SAVE DEMO SQUAD'}</Text>
            </Pressable>
          </View>
        </View>
        <View style={s.hero}>
          <View style={s.heroText}>
            <Text style={s.eyebrow}>2027 SEASON / SAMPLE ROUND 01</Text>
            <Text accessibilityRole="header" accessibilityLabel="Your squad. Your call." style={s.title}>
              My Squad
            </Text>
            <Label muted>
              Build your starting XV, pick your leaders, and make every credit count.
            </Label>
          </View>
          <View style={s.heroAside}>
            <Text style={s.smallHeading}>YOUR FIRST XV STARTS HERE</Text>
            <Label muted>Round 01 command centre · live-ready scoring and account sync surface.</Label>
          </View>
        </View>

        <View style={s.metrics}>
          <View style={s.metric}>
            <Text style={s.metricCaption}>BUDGET REMAINING</Text>
            <Text
              testID="budget-remaining"
              style={[s.metricValue, cost > 1000 && { color: c.danger }]}
            >
              {credits(1000 - cost)} <Text style={s.metricUnit}>cr</Text>
            </Text>
            <View style={s.progressTrack}>
              <View
                style={[
                  s.progress,
                  {
                    width: `${Math.min(cost / 10, 100)}%`,
                    backgroundColor: cost > 1000 ? c.danger : c.emerald,
                  },
                ]}
              />
            </View>
            <Label muted>{credits(cost)} / 100.0 credits spent</Label>
          </View>
          <View style={s.metric}>
            <Text style={s.metricCaption}>SQUAD SELECTED</Text>
            <Text testID="squad-count" style={s.metricValue}>
              {picked.length}
              <Text style={s.metricUnit}> / 18</Text>
            </Text>
            <Label muted>
              {squad.draft.slots.slice(0, 15).filter(Boolean).length}/15 starters ·{' '}
              {squad.draft.slots.slice(15).filter(Boolean).length}/3 reserves
            </Label>
          </View>
          <View style={s.metric}>
            <Text style={s.metricCaption}>CAPTAINCY</Text>
            <Text style={s.captainLine}>
              <Text style={s.roleBadge}>C</Text> {captain?.name ?? 'Choose your captain'}
            </Text>
            <Label muted>VC · {vice?.name ?? 'Choose your vice-captain'}</Label>
          </View>
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
                <Text style={s.h2}>
                  My squad
                </Text>
                <Label muted>Tap a slot to select or replace a player.</Label>
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
              <View style={s.pitch}>
                <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                  <View style={s.pitchStripe} />
                  <View style={[s.pitchStripe, { top: '34%' }]} />
                  <View style={[s.pitchStripe, { top: '68%' }]} />
                  <View style={s.pitchBoundary} />
                  <View style={s.halfway} />
                  <View style={s.centerCircle} />
                </View>
                <View style={s.pitchHeader}>
                  <Text style={s.pitchLegend}>STARTING XV</Text>
                  <Text style={s.attackDirection}>ATTACK →</Text>
                </View>
                <View style={s.pitchLabels} pointerEvents="none">
                  <Text style={s.pitchLabel}>BACK THREE</Text>
                  <Text style={s.pitchLabel}>CENTRES</Text>
                  <Text style={s.pitchLabel}>HALVES</Text>
                  <Text style={s.pitchLabel}>PACK</Text>
                </View>
                {pitchRows.map((row, index) => (
                  <View key={index} style={s.pitchRow}>
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
                <View key={index} style={s.reserveItem}>
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
                      <Text style={[s.nationAbbr, { color: nationColor[n] }]}>
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
                Review squad →
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
            <Text style={s.eyebrow}>BUILD YOUR TEAM</Text>
            <Text style={s.h2}>
              Player pool
            </Text>
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
            <View style={s.tip}>
              <Text style={s.smallHeading}>THE CAPTAIN’S EDGE</Text>
              <Label muted>
                Your captain earns double points. If they don’t participate, your playing
                vice-captain takes over. Reserves never inherit captaincy.
              </Label>
            </View>
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
            <Text style={s.mobileActionTitle}>{picked.length}/18 selected</Text>
            <Text style={s.mobileActionMeta}>{squad.status}</Text>
          </View>
          <Button variant="primary" disabled={squad.saving || squad.locked} onPress={() => void lockSquad()}>
            {squad.locked ? 'SAVED' : squad.saving ? 'SAVING…' : 'SAVE DEMO SQUAD'}
          </Button>
        </View>
      )}
      {!wide && <AppTabs active="/squad" />}

      <Modal visible={hubDrawer} transparent animationType="none" onRequestClose={() => setHubDrawer(false)}>
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

      <Modal visible={tacticalDrawer} transparent animationType="none" onRequestClose={() => setTacticalDrawer(false)}>
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

      <Modal visible={transferMarket} transparent animationType="none" onRequestClose={() => setTransferMarket(false)}>
        <View style={s.modalBackdrop}>
          <View accessibilityViewIsModal style={s.modalCard}>
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
        animationType="none"
        onRequestClose={() => setDetail(null)}
      >
        <View style={s.modalBackdrop}>
          <View accessibilityViewIsModal style={s.modalCard}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={s.eyebrow}>SYNTHETIC PLAYER PROFILE</Text>
              <Text style={s.drawerAccent}>PERFORMANCE DATA / ROUND 01 PREVIEW</Text>
              <Text accessibilityRole="header" style={s.modalTitle}>
                {detail?.name}
              </Text>
              <Label>
                {detail?.nation} · {detail?.position}
              </Label>
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
              <View style={s.modalClose}>
                <Button onPress={() => setDetail(null)}>Close player details</Button>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={review}
        transparent
        animationType="none"
        onRequestClose={() => {
          if (!confirming) setReview(false);
        }}
      >
        <View style={s.modalBackdrop}>
          <View accessibilityViewIsModal style={s.modalCard}>
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
                  {picked.length}/18 players · {credits(cost)}/100.0 credits
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
        animationType="none"
        onRequestClose={() => setResetting(false)}
      >
        <View style={s.modalBackdrop}>
          <View accessibilityViewIsModal style={s.modalCard}>
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

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.bg },
  loading: {
    flex: 1,
    backgroundColor: c.bg,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  page: {
    paddingHorizontal: 16,
    paddingBottom: 116,
    width: '100%',
    maxWidth: 1440,
    alignSelf: 'center',
  },
  pageWide: { paddingHorizontal: 32 },
  header: {
    minHeight: 72,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#20373B',
    paddingVertical: 14,
    flexWrap: 'wrap',
  },
  headerLead: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1 },
  menuButton: {
    minHeight: 40,
    paddingHorizontal: 10,
    borderRadius: 4,
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
    borderRadius: 4,
    backgroundColor: c.lowest,
  },
  brandGlyph: { fontFamily: fonts.heading, fontSize: 28, color: c.bg },
  wordmark: { color: c.text, fontFamily: fonts.heading, fontSize: 21, letterSpacing: 1.8 },
  brandSub: { color: c.muted, fontFamily: fonts.medium, fontSize: 11, letterSpacing: 1.2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 16, flexWrap: 'wrap', flexShrink: 1 },
  headerRightMobile: { width: '100%', gap: 8, justifyContent: 'space-between' },
  desktopStatusGroup: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  mobileStatusBar: { flex: 1, minWidth: 0, gap: 4 },
  headerDesk: { gap: 3, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: '#13271F', borderRadius: 4 },
  headerDeskLabel: { color: c.text, fontFamily: fonts.medium, fontSize: 12, letterSpacing: 1 },
  headerDeskStatus: { color: c.emerald, fontFamily: fonts.medium, fontSize: 11, letterSpacing: 0.8 },
  syncStatus: { color: c.teal, fontFamily: fonts.medium, fontSize: 12, letterSpacing: 0.7 },
  demoPill: {
    color: c.emerald,
    backgroundColor: '#193022',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: fonts.medium,
    fontSize: 12,
    letterSpacing: 1,
    borderRadius: 6,
  },
  manager: { color: c.text, fontFamily: fonts.medium, fontSize: 14 },
  lockout: { color: c.amber, fontFamily: fonts.medium, fontSize: 12, letterSpacing: 0.8 },
  lockButton: { minHeight: 40, paddingHorizontal: 14, justifyContent: 'center', backgroundColor: c.emerald, borderRadius: 4 },
  lockButtonText: { color: c.bg, fontFamily: fonts.medium, fontSize: 12, letterSpacing: 0.8 },
  mobileActionBar: { position: 'absolute', left: 0, right: 0, bottom: 64, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#10211E', borderTopWidth: 1, borderTopColor: c.emerald, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  mobileActionCopy: { flex: 1, minWidth: 0, gap: 3 },
  mobileActionTitle: { color: c.text, fontFamily: fonts.medium, fontSize: 13 },
  mobileActionMeta: { color: c.muted, fontFamily: fonts.body, fontSize: 11 },
  hero: {
    paddingVertical: 30,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 24,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroText: { flexGrow: 1, flexShrink: 1 },
  heroAside: { maxWidth: 280, gap: 4 },
  eyebrow: {
    color: c.emerald,
    fontFamily: fonts.medium,
    fontSize: 11,
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 42,
    lineHeight: 48,
    color: c.text,
    marginBottom: 12,
  },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 30 },
  metric: {
    flexGrow: 1,
    flexBasis: 260,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.panel,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.18,
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
  columns: { gap: 20 },
  columnsWide: { flexDirection: 'row', alignItems: 'flex-start', gap: 24 },
  squadPanel: { minWidth: 0 },
  poolPanel: {
    minWidth: 0,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 3,
    backgroundColor: c.panel,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  sectionHeading: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
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
    borderRadius: 10,
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 18,
    gap: 5,
    borderWidth: 1,
    borderColor: '#2F745C',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
  },
  pitchStripe: {
    position: 'absolute',
    top: '0%',
    height: '16.6%',
    width: '100%',
    backgroundColor: c.pitchStripe,
  },
  pitchBoundary: {
    position: 'absolute',
    top: 18,
    bottom: 18,
    left: 12,
    right: 12,
    borderWidth: 1,
    borderColor: '#7BC7A6',
    opacity: 0.52,
  },
  halfway: {
    position: 'absolute',
    top: '50%',
    left: 12,
    right: 12,
    borderTopWidth: 1,
    borderColor: '#7BC7A6',
    opacity: 0.52,
  },
  centerCircle: {
    position: 'absolute',
    top: '42%',
    left: '38%',
    width: '24%',
    height: '16%',
    borderRadius: 100,
    borderWidth: 1,
    borderColor: '#7BC7A6',
    opacity: 0.34,
  },
  pitchLegend: {
    color: '#B4DEC9',
    fontFamily: fonts.medium,
    fontSize: 10,
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 4,
  },
  pitchHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  attackDirection: { color: c.amber, fontFamily: fonts.medium, fontSize: 11, letterSpacing: 1.1 },
  pitchLabels: { position: 'absolute', left: 5, top: '18%', bottom: '8%', justifyContent: 'space-around', opacity: 0.78 },
  pitchLabel: { color: '#8ABCA5', fontFamily: fonts.medium, fontSize: 7, letterSpacing: 0.6, transform: [{ rotate: '-90deg' }] },
  pitchRow: { flexDirection: 'row', gap: 7, justifyContent: 'center', zIndex: 1, minHeight: 101 },
  slot: {
    flex: 1,
    minWidth: 76,
    maxWidth: 142,
  },
  activeSlot: {},
  slotTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  slotNumber: { color: c.muted, fontFamily: fonts.medium, fontSize: 12 },
  roleBadge: {
    color: c.bg,
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
  reserveRow: { flexDirection: 'row', gap: 8 },
  reserveItem: { flex: 1, minWidth: 0, gap: 6, padding: 6, borderWidth: 1, borderColor: c.border, borderRadius: 8, backgroundColor: c.panel },
  reserveControls: { flexDirection: 'row', gap: 4, justifyContent: 'center' },
  reserveCover: { color: c.muted, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, textAlign: 'center' },
  nationPanel: {
    padding: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 8,
    backgroundColor: c.panel,
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
  activeSelection: {
    backgroundColor: '#153A30',
    padding: 14,
    borderRadius: 3,
    gap: 8,
    marginVertical: 18,
    borderLeftWidth: 3,
    borderLeftColor: c.emerald,
  },
  search: {
    minHeight: 52,
    color: c.text,
    fontFamily: fonts.body,
    fontSize: 14,
    padding: 14,
    backgroundColor: c.bg,
    borderColor: c.border,
    borderWidth: 1,
    borderRadius: 3,
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
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  playerRowSelected: { backgroundColor: '#183A31' },
  playerRowDisabled: { opacity: 0.55 },
  playerRowWarning: { borderLeftWidth: 2, borderLeftColor: c.amber, paddingLeft: 10 },
  playerAvatar: {
    width: 40,
    height: 40,
    borderWidth: 2,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: c.raised,
  },
  avatarNumber: { fontFamily: fonts.heading, fontSize: 18 },
  playerInfo: { flex: 1, minWidth: 0 },
  playerNameButton: { minHeight: 48, justifyContent: 'center', gap: 4 },
  playerName: { color: c.text, fontFamily: fonts.medium, fontSize: 14, lineHeight: 21 },
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
  empty: { paddingVertical: 32, gap: 12 },
  errorBox: {
    padding: 16,
    borderWidth: 1,
    borderColor: c.danger,
    backgroundColor: '#302329',
    borderRadius: 10,
    gap: 12,
    marginBottom: 16,
  },
  successBox: { padding: 16, backgroundColor: '#203A32', borderRadius: 4, marginBottom: 16 },
  savedBanner: {
    backgroundColor: '#203A32',
    borderWidth: 1,
    borderColor: '#4A675C',
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
    backgroundColor: '#000000CC',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 620,
    maxHeight: '90%',
    backgroundColor: c.panel,
    padding: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: c.border,
  },
  modalTitle: {
    color: c.text,
    fontFamily: fonts.heading,
    fontSize: 28,
    lineHeight: 36,
    marginBottom: 12,
  },
  modalClose: { marginTop: 12 },
  drawerBackdrop: { flex: 1, backgroundColor: '#000000CC', justifyContent: 'flex-start', alignItems: 'flex-start' },
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
  drawerNavActive: { backgroundColor: '#153A30', borderColor: c.emerald },
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
