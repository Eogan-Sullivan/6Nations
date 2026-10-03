/** Synthetic five-round oracle; never evidence of historical feed rights or production throughput. */
import assert from 'node:assert/strict';
import {
  FORMATION,
  METRICS,
  type Player,
  type PlayerFixtureStatistics,
  type SquadSelection,
} from '../src/contracts/types.js';
import { scoreRound, rankStandings } from '../src/domain/scoring/index.js';
const players: Player[] = [...FORMATION, 'prop', 'hooker', 'outside_back'].map((position, i) => ({
  id: `p${i + 1}`,
  seasonId: 'synthetic-season',
  nationId: `nation${i % 6}`,
  name: `Synthetic ${i + 1}`,
  position: position as Player['position'],
  priceTenths: 50,
  eligible: true,
}));
const selection: SquadSelection = {
  slots: players.map((p, i) => ({ slot: i + 1, playerId: p.id })),
  captainId: 'p1',
  viceCaptainId: 'p2',
};
let score = 0;
let bonus = 0;
for (let round = 1; round <= 5; round++) {
  const stats: PlayerFixtureStatistics[] = players.map((p) => ({
    fixtureId: `synthetic-r${round}`,
    playerId: p.id,
    position: p.position,
    started: true,
    participated: true,
    metrics: Object.fromEntries(METRICS.map((m) => [m, '0'])) as PlayerFixtureStatistics['metrics'],
  }));
  if (round === 2) {
    stats[0]!.participated = false;
    stats[0]!.started = false;
  }
  const result = scoreRound('synthetic-entry', selection, players, stats);
  assert.equal(result.scoreHundredths, 6400);
  assert.equal(result.captainBonusHundredths, 400);
  if (round === 2) {
    assert.ok(result.effectivePlayerIds.includes('p16'));
    assert.equal(result.captainId, 'p2');
  }
  score += result.scoreHundredths;
  bonus += result.captainBonusHundredths;
}
const standings = rankStandings([
  {
    entryId: 'synthetic-entry',
    displayName: 'Synthetic entrant',
    scoreHundredths: score,
    captainBonusHundredths: bonus,
    contributingTries: 0,
    registeredAt: '2027-01-01T00:00:00Z',
  },
]);
assert.equal(standings[0]?.rank, 1);
assert.equal(score, 32000);
console.log(
  JSON.stringify({
    label: 'SYNTHETIC — not historical coverage or licensed feed evidence',
    rounds: 5,
    scoreHundredths: score,
    rank: 1,
  }),
);
