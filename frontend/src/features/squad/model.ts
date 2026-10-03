export const POSITIONS = [
  'Prop',
  'Hooker',
  'Lock',
  'Back row',
  'Scrum-half',
  'Fly-half',
  'Centre',
  'Outside back',
] as const;
export type Position = (typeof POSITIONS)[number];
export const NATIONS = ['Ireland', 'France', 'England', 'Scotland', 'Wales', 'Italy'] as const;
export type Nation = (typeof NATIONS)[number];
export interface Player {
  id: string;
  name: string;
  nation: Nation;
  position: Position;
  priceTenths: number;
  number: number;
  description: string;
  fantasyPoints: number;
  form: number;
  appearances: number;
}
export const FORMATION: readonly Position[] = [
  'Prop',
  'Hooker',
  'Prop',
  'Lock',
  'Lock',
  'Back row',
  'Back row',
  'Back row',
  'Scrum-half',
  'Fly-half',
  'Centre',
  'Centre',
  'Outside back',
  'Outside back',
  'Outside back',
];
export interface Draft {
  slots: (string | null)[];
  captainId: string | null;
  viceCaptainId: string | null;
}
export interface Issue {
  code: string;
  message: string;
}
export const emptyDraft = (): Draft => ({
  slots: Array<string | null>(18).fill(null),
  captainId: null,
  viceCaptainId: null,
});
export const credits = (tenths: number) => (tenths / 10).toFixed(1);

export function selectedPlayers(draft: Draft, pool: readonly Player[]) {
  return draft.slots
    .map((id) => pool.find((player) => player.id === id))
    .filter((p): p is Player => !!p);
}

export function validateDraft(draft: Draft, pool: readonly Player[]): Issue[] {
  const issues: Issue[] = [];
  const players = selectedPlayers(draft, pool);
  if (draft.slots.length !== 18 || players.length !== 18)
    issues.push({
      code: 'INCOMPLETE',
      message: `Fill all 18 slots (${players.length}/18 selected).`,
    });
  if (new Set(players.map((p) => p.id)).size !== players.length)
    issues.push({ code: 'DUPLICATE', message: 'Each player can appear only once.' });
  if (
    FORMATION.some((position, index) => {
      const p = pool.find((p) => p.id === draft.slots[index]);
      return p && p.position !== position;
    })
  )
    issues.push({ code: 'FORMATION', message: 'Every starter must match their slot position.' });
  const total = players.reduce((sum, p) => sum + p.priceTenths, 0);
  if (total > 1000)
    issues.push({
      code: 'BUDGET',
      message: `Over budget by ${credits(total - 1000)} credits. Choose a lower-priced player.`,
    });
  for (const nation of NATIONS) {
    const count = players.filter((p) => p.nation === nation).length;
    if (count > 4)
      issues.push({
        code: 'NATION',
        message: `${nation}: ${count} players selected. Maximum four per nation.`,
      });
  }
  const starters = draft.slots.slice(0, 15).filter(Boolean);
  if (!draft.captainId || !starters.includes(draft.captainId))
    issues.push({ code: 'CAPTAIN', message: 'Choose a captain from your starters.' });
  if (!draft.viceCaptainId || !starters.includes(draft.viceCaptainId))
    issues.push({ code: 'VICE', message: 'Choose a vice-captain from your starters.' });
  if (draft.captainId && draft.captainId === draft.viceCaptainId)
    issues.push({
      code: 'CAPTAIN_DISTINCT',
      message: 'Captain and vice-captain must be different starters.',
    });
  return issues;
}

export function putPlayer(draft: Draft, slot: number, player: Player): Draft {
  if (slot < 0 || slot > 17 || draft.slots.includes(player.id)) return draft;
  if (slot < 15 && FORMATION[slot] !== player.position) return draft;
  const slots = [...draft.slots];
  const removed = slots[slot];
  slots[slot] = player.id;
  return {
    slots,
    captainId: draft.captainId === removed ? null : draft.captainId,
    viceCaptainId: draft.viceCaptainId === removed ? null : draft.viceCaptainId,
  };
}

export function removePlayer(draft: Draft, slot: number): Draft {
  const slots = [...draft.slots];
  const removed = slots[slot];
  slots[slot] = null;
  return {
    slots,
    captainId: draft.captainId === removed ? null : draft.captainId,
    viceCaptainId: draft.viceCaptainId === removed ? null : draft.viceCaptainId,
  };
}

export function assignCaptain(draft: Draft, id: string, role: 'captain' | 'vice'): Draft {
  if (!draft.slots.slice(0, 15).includes(id)) return draft;
  return role === 'captain'
    ? {
        ...draft,
        captainId: id,
        viceCaptainId: draft.viceCaptainId === id ? null : draft.viceCaptainId,
      }
    : { ...draft, viceCaptainId: id, captainId: draft.captainId === id ? null : draft.captainId };
}

export function moveReserve(draft: Draft, index: number, direction: -1 | 1): Draft {
  const target = index + direction;
  if (index < 15 || index > 17 || target < 15 || target > 17) return draft;
  const slots = [...draft.slots];
  [slots[index], slots[target]] = [slots[target] ?? null, slots[index] ?? null];
  return { ...draft, slots };
}

export function swapReserveWithStarter(
  draft: Draft,
  reserveIndex: number,
  starterIndex: number,
  pool: readonly Player[],
): Draft {
  if (reserveIndex < 15 || reserveIndex > 17 || starterIndex < 0 || starterIndex > 14) return draft;
  const reserve = pool.find((player) => player.id === draft.slots[reserveIndex]);
  const starter = pool.find((player) => player.id === draft.slots[starterIndex]);
  if (!reserve || !starter || reserve.position !== FORMATION[starterIndex]) return draft;
  const slots = [...draft.slots];
  [slots[reserveIndex], slots[starterIndex]] = [slots[starterIndex] ?? null, slots[reserveIndex] ?? null];
  return {
    ...draft,
    slots,
    captainId: draft.captainId === starter.id ? reserve.id : draft.captainId,
    viceCaptainId: draft.viceCaptainId === starter.id ? reserve.id : draft.viceCaptainId,
  };
}

export function parseDraft(value: unknown, pool: readonly Player[]): Draft | null {
  if (!value || typeof value !== 'object') return null;
  const d = value as Partial<Draft>;
  if (
    !Array.isArray(d.slots) ||
    d.slots.length !== 18 ||
    !d.slots.every((id) => id === null || (typeof id === 'string' && pool.some((p) => p.id === id)))
  )
    return null;
  if (
    ![d.captainId, d.viceCaptainId].every(
      (id) => id === null || (typeof id === 'string' && d.slots?.slice(0, 15).includes(id)),
    )
  )
    return null;
  return {
    slots: [...d.slots],
    captainId: d.captainId ?? null,
    viceCaptainId: d.viceCaptainId ?? null,
  };
}
