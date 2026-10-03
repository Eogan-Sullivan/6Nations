import { it, expect } from 'vitest';
import { FORMATION, type Player, type SquadSelection } from '../../src/contracts/types.js';
import { validateSelection } from '../../src/domain/squads/index.js';
function fixture() {
  const players = [...FORMATION, 'prop', 'hooker', 'lock'].map((position, index) => ({
    id: String(index),
    seasonId: 's',
    nationId: String(index % 6),
    name: 'p',
    position,
    priceTenths: 50,
    eligible: true,
  })) as Player[];
  const selection: SquadSelection = {
    slots: players.map((player, index) => ({ slot: index + 1, playerId: player.id })),
    captainId: '0',
    viceCaptainId: '1',
  };
  return { players, selection };
}
it('validates affordable complete squads including reserve nation and budget constraints', () => {
  const { players, selection } = fixture();
  expect(validateSelection(selection, players)).toBeNull();
  players[17]!.priceTenths = 151;
  expect(validateSelection(selection, players)?.code).toBe('OVER_BUDGET');
  players[17]!.priceTenths = 50;
  for (const player of players.slice(0, 5)) player.nationId = 'same';
  expect(validateSelection(selection, players)?.code).toBe('NATION_LIMIT');
});
it('rejects duplicates, wrong slots and reserve captaincy', () => {
  const { players, selection } = fixture();
  selection.captainId = '17';
  expect(validateSelection(selection, players)?.code).toBe('INVALID_CAPTAIN');
  selection.captainId = '0';
  selection.slots[17]!.playerId = '0';
  expect(validateSelection(selection, players)?.code).toBe('DUPLICATE_PLAYER');
  selection.slots[17]!.playerId = '17';
  selection.slots[2]!.slot = 19;
  expect(validateSelection(selection, players)?.code).toBe('INVALID_FORMATION');
});
