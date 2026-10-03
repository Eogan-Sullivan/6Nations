import {
  FORMATION,
  type Player,
  type SquadSelection,
  type GameError,
} from '../../contracts/types.js';
export function validateSelection(
  selection: SquadSelection,
  players: readonly Player[],
): GameError | null {
  const catalog = new Map(players.map((player) => [player.id, player]));
  if (
    selection.slots.length !== 18 ||
    new Set(selection.slots.map((slot) => slot.slot)).size !== 18 ||
    selection.slots.some((slot) => slot.slot < 1 || slot.slot > 18)
  )
    return { code: 'INVALID_FORMATION', message: 'Eighteen unique slots are required' };
  if (new Set(selection.slots.map((slot) => slot.playerId)).size !== 18)
    return { code: 'DUPLICATE_PLAYER', message: 'Players must be unique' };
  let cost = 0;
  const nations = new Map<string, number>();
  for (const slot of selection.slots) {
    const player = catalog.get(slot.playerId);
    if (!player?.eligible) return { code: 'INELIGIBLE_PLAYER', message: 'Player is not eligible' };
    if (slot.slot <= 15 && player.position !== FORMATION[slot.slot - 1])
      return { code: 'INVALID_FORMATION', message: 'Starter position does not match slot' };
    cost += player.priceTenths;
    nations.set(player.nationId, (nations.get(player.nationId) ?? 0) + 1);
  }
  if (cost > 1000) return { code: 'OVER_BUDGET', message: 'Squad exceeds 100 credits' };
  if ([...nations.values()].some((count) => count > 4))
    return { code: 'NATION_LIMIT', message: 'Maximum four players per nation' };
  const starters = new Set(
    selection.slots.filter((slot) => slot.slot <= 15).map((slot) => slot.playerId),
  );
  if (
    selection.captainId === selection.viceCaptainId ||
    !starters.has(selection.captainId) ||
    !starters.has(selection.viceCaptainId)
  )
    return {
      code: 'INVALID_CAPTAIN',
      message: 'Captain and vice-captain must be different starters',
    };
  return null;
}
