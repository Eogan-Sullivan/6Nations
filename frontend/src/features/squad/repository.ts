import AsyncStorage from '@react-native-async-storage/async-storage';
import { demoPlayers } from './demo';
import { parseDraft, type Draft, type Player } from './model';

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
  players(): Promise<Player[]>;
  load(): Promise<SavedSquad | null>;
  save(value: SavedSquad): Promise<void>;
}
export const demoRepository: SquadRepository = {
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
