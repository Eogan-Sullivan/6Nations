import AsyncStorage from '@react-native-async-storage/async-storage';
import { commandGame, isApiConfigured, readGame } from '../../api/client';
import { demoPlayers } from './demo';
import { emptyDraft, NATIONS, POSITIONS, parseDraft, type Draft, type Nation, type Player, type Position } from './model';

const KEY = '6nations:squad-demo:v1';
export interface SavedSquad {
  draft: Draft;
  confirmed: Draft | null;
  confirmedAt: string | null;
  locked: boolean;
  lockedAt: string | null;
  transfersRemaining: number;
}
export interface SquadRepository {
  source: 'demo' | 'api';
  players(): Promise<Player[]>;
  load(): Promise<SavedSquad | null>;
  save(value: SavedSquad): Promise<void>;
}
export const demoRepository: SquadRepository = {
  source: 'demo',
  async players() {
    return demoPlayers;
  },
  async load() {
    let raw = await AsyncStorage.getItem(KEY);
    // Recover a draft stored under a previous app name without retaining that branding.
    if (raw === null) {
      const previousKeys = (await AsyncStorage.getAllKeys()).filter(
        (key) => key !== KEY && key.endsWith(':squad-demo:v1'),
      );
      if (previousKeys.length === 1) raw = await AsyncStorage.getItem(previousKeys[0]!);
    }
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<SavedSquad>;
    const draft = parseDraft(value.draft, demoPlayers);
    if (!draft) throw new Error('Saved demo has an incompatible format.');
    const confirmed = value.confirmed ? parseDraft(value.confirmed, demoPlayers) : null;
    return {
      draft,
      confirmed,
      confirmedAt: typeof value.confirmedAt === 'string' ? value.confirmedAt : null,
      locked: value.locked === true,
      lockedAt: typeof value.lockedAt === 'string' ? value.lockedAt : null,
      transfersRemaining: typeof value.transfersRemaining === 'number' ? value.transfersRemaining : 2,
    };
  },
  async save(value) {
    await AsyncStorage.setItem(KEY, JSON.stringify(value));
  },
};

const API_DRAFT_KEY = '6nations:squad-api-draft:v1';
const API_SEASON_ID = '00000000-0000-4000-8000-000000000001';
const API_ROUND_ID = '00000000-0000-4000-8000-000000000010';
const positionMap: Record<string, Position> = {
  prop: 'Prop', hooker: 'Hooker', lock: 'Lock', back_row: 'Back row', scrum_half: 'Scrum-half',
  fly_half: 'Fly-half', centre: 'Centre', outside_back: 'Outside back',
};
const nationMap: Record<string, Nation> = {
  '000000000000': 'Ireland', '000000000001': 'France', '000000000002': 'England',
  '000000000003': 'Scotland', '000000000004': 'Wales', '000000000005': 'Italy',
};
type ApiPlayer = { id: string; nationId: string; name: string; position: string; priceTenths: number; eligible: boolean };
type ApiPage = { items: ApiPlayer[]; nextCursor: string | null };
type ApiSquad = { revision: number; selection: { slots: { slot: number; playerId: string }[]; captainId: string; viceCaptainId: string } | null; deadline: string; locked: boolean; provenance: 'confirmed' | 'carried' | null };

function mapPlayer(player: ApiPlayer, index: number): Player {
  const position = positionMap[player.position];
  const nation = nationMap[player.nationId.slice(-12)] ?? NATIONS[index % NATIONS.length]!;
  return {
    id: player.id,
    name: player.name,
    nation,
    position: position ?? POSITIONS[0]!,
    priceTenths: player.priceTenths,
    number: index + 1,
    description: `Synthetic ${position?.toLowerCase() ?? 'player'} data for development and feature testing.`,
    fantasyPoints: 20 + ((index * 13) % 40),
    form: 6 + ((index * 7) % 18) / 10,
    appearances: 1 + (index % 5),
  };
}

function selectionToDraft(selection: ApiSquad['selection']): Draft | null {
  if (!selection) return null;
  const slots = Array<string | null>(18).fill(null);
  for (const item of selection.slots) slots[item.slot - 1] = item.playerId;
  return { slots, captainId: selection.captainId, viceCaptainId: selection.viceCaptainId };
}

function draftToSelection(draft: Draft) {
  return {
    slots: draft.slots.flatMap((playerId, index) => playerId ? [{ slot: index + 1, playerId }] : []),
    captainId: draft.captainId,
    viceCaptainId: draft.viceCaptainId,
  };
}

export const apiRepository: SquadRepository = {
  source: 'api',
  async players() {
    const page = await readGame<ApiPage>('players', { seasonId: API_SEASON_ID, limit: 100 });
    return page.items.filter((player) => player.eligible).map(mapPlayer);
  },
  async load() {
    await commandGame<{ entryId: string }>('enter_season', { seasonId: API_SEASON_ID });
    const server = await readGame<ApiSquad>('squad', { roundId: API_ROUND_ID });
    const raw = await AsyncStorage.getItem(API_DRAFT_KEY);
    const local = raw ? (JSON.parse(raw) as Partial<SavedSquad>) : null;
    const confirmed = selectionToDraft(server.selection);
    const pool = await readGame<ApiPage>('players', { seasonId: API_SEASON_ID, limit: 100 });
    const players = pool.items.filter((player) => player.eligible).map(mapPlayer);
    const draft = local?.draft ? parseDraft(local.draft, players) : confirmed;
    return {
      draft: draft ?? emptyDraft(),
      confirmed,
      confirmedAt: confirmed ? new Date().toISOString() : null,
      locked: server.locked,
      lockedAt: server.locked ? server.deadline : null,
      transfersRemaining: local?.transfersRemaining ?? 2,
    };
  },
  async save(value) {
    const current = await AsyncStorage.getItem(API_DRAFT_KEY);
    const previous = current ? (JSON.parse(current) as Partial<SavedSquad>) : null;
    await AsyncStorage.setItem(API_DRAFT_KEY, JSON.stringify(value));
    const confirmedChanged = Boolean(
      value.confirmed && JSON.stringify(value.confirmed) !== JSON.stringify(previous?.confirmed),
    );
    if (!confirmedChanged || !value.confirmed) return;
    const server = await readGame<ApiSquad>('squad', { roundId: API_ROUND_ID });
    await commandGame<ApiSquad>('confirm_squad', {
      roundId: API_ROUND_ID,
      expectedRevision: server.revision,
      ...draftToSelection(value.confirmed),
    });
  },
};

export const defaultRepository = isApiConfigured ? apiRepository : demoRepository;
