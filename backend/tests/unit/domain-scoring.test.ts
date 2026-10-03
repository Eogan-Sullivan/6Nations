import { describe, it, expect } from 'vitest';
import {
  METRICS,
  type PlayerFixtureStatistics,
  type Player,
  type SquadSelection,
} from '../../src/contracts/types.js';
import {
  scorePlayerFixture,
  scoreRound,
  rankStandings,
  projectHalftime,
} from '../../src/domain/scoring/index.js';
const stats = (overrides: Partial<PlayerFixtureStatistics> = {}): PlayerFixtureStatistics => ({
  fixtureId: 'fixture',
  playerId: 'player',
  position: 'prop',
  participated: true,
  started: true,
  metrics: Object.fromEntries(
    METRICS.map((metric) => [metric, '0']),
  ) as PlayerFixtureStatistics['metrics'],
  ...overrides,
});
describe('exact scoring', () => {
  it('covers every forward metric and accumulating cards', () => {
    const sample = stats();
    for (const metric of METRICS) sample.metrics[metric] = '1';
    expect(scorePlayerFixture(sample).scoreHundredths).toBe(3360);
  });
  it('ignores nonapplicable forward metrics for backs', () => {
    const sample = stats({ position: 'centre' });
    sample.metrics.lineoutSteals = null;
    sample.metrics.scrumPenaltiesWon = null;
    sample.metrics.penaltiesConceded = null;
    expect(scorePlayerFixture(sample).scoreHundredths).toBe(400);
  });
  it('rounds once per fixture with halves away from zero', () => {
    const sample = stats();
    sample.metrics.metresCarried = '0.05';
    expect(scorePlayerFixture(sample).scoreHundredths).toBe(401);
    sample.metrics.redCards = '1';
    expect(scorePlayerFixture(sample).scoreHundredths).toBe(-1100);
    sample.metrics.metresCarried = '0.15';
    expect(scorePlayerFixture(sample).scoreHundredths).toBe(-1099);
    sample.metrics.tackles = '0.01';
    expect(() => scorePlayerFixture(sample)).toThrow('whole numbers');
  });
  it('checks every independent forward and back event weight', () => {
    const expected = [
      ['tries', 1500, 1500],
      ['tryAssists', 700, 700],
      ['conversions', 200, 200],
      ['penaltyKicks', 300, 300],
      ['dropGoals', 500, 500],
      ['metresCarried', 10, 10],
      ['cleanBreaks', 400, 400],
      ['defendersBeaten', 200, 200],
      ['turnoversWon', 500, 400],
      ['tackles', 150, 100],
      ['missedTackles', -100, -100],
      ['yellowCards', -500, -500],
      ['redCards', -1500, -1500],
      ['lineoutSteals', 500, 0],
      ['scrumPenaltiesWon', 300, 0],
      ['penaltiesConceded', -200, 0],
    ] as const;
    for (const [metric, forward, back] of expected) {
      for (const [position, weight] of [
        ['prop', forward],
        ['centre', back],
      ] as const) {
        const sample = stats({ position, started: false });
        sample.metrics[metric] = '1';
        expect(scorePlayerFixture(sample).scoreHundredths, `${position} ${metric}`).toBe(
          200 + weight,
        );
      }
    }
  });
  it('sums separately rounded fixtures before captain bonus', () => {
    const players = Array.from({ length: 18 }, (_, index) => ({
      id: String(index),
      position: 'prop',
      seasonId: 's',
      nationId: 'n',
      name: 'p',
      priceTenths: 1,
      eligible: true,
    })) as Player[];
    const selection: SquadSelection = {
      slots: players.map((player, index) => ({ slot: index + 1, playerId: player.id })),
      captainId: '0',
      viceCaptainId: '1',
    };
    const observations = players.flatMap((player) =>
      ['a', 'b'].map((fixtureId) => {
        const row = stats({
          playerId: player.id,
          fixtureId,
          participated: player.id === '0',
          started: false,
        });
        row.metrics.metresCarried = '0.25';
        return row;
      }),
    );
    const result = scoreRound('entry', selection, players, observations);
    expect(result.captainBonusHundredths).toBe(406);
    expect(result.scoreHundredths).toBe(812);
  });
  it('preserves unknown participation and coverage', () => {
    const sample = stats();
    sample.metrics.tries = null;
    expect(scorePlayerFixture(sample).scoreHundredths).toBeNull();
    expect(scorePlayerFixture(sample).missingMetrics).toContain('tries');
    expect(scorePlayerFixture(stats({ participated: false, started: null })).scoreHundredths).toBe(
      0,
    );
  });
  it('resolves ordered same-position reserves once and signed captain fallback', () => {
    const players = Array.from({ length: 18 }, (_, index) => ({
      id: String(index),
      position: 'prop',
      seasonId: 's',
      nationId: 'n',
      name: 'p',
      priceTenths: 1,
      eligible: true,
    })) as Player[];
    const selection: SquadSelection = {
      slots: players.map((player, index) => ({ slot: index + 1, playerId: player.id })),
      captainId: '0',
      viceCaptainId: '1',
    };
    const observations = players.map((player) =>
      stats({ playerId: player.id, participated: !['0', '2'].includes(player.id) }),
    );
    observations[1]!.metrics.redCards = '1';
    observations[15]!.metrics.redCards = '1';
    const result = scoreRound('entry', selection, players, observations);
    expect(result.effectivePlayerIds[0]).toBe('15');
    expect(result.effectivePlayerIds[2]).toBe('16');
    expect(result.captainId).toBe('1');
    expect(result.captainBonusHundredths).toBe(-1100);
    expect(result.scoreHundredths).toBe(1900);
    const preview = projectHalftime(
      selection,
      observations.map((observation) => ({
        ...observation,
        metrics: { ...observation.metrics, tries: null },
      })),
    );
    expect(preview.scoreHundredths).toBeNull();
    expect(preview.reservesPending).toBe(true);
  });
  it('assigns competition ties and signed captain tiebreak', () => {
    const common = {
      displayName: 'p',
      scoreHundredths: 1,
      captainBonusHundredths: -1,
      contributingTries: 0,
      registeredAt: '2027-01-01T00:00:00Z',
    };
    expect(
      rankStandings([
        { ...common, entryId: 'a', scoreHundredths: 2 },
        { ...common, entryId: 'b' },
        { ...common, entryId: 'c' },
        { ...common, entryId: 'd', scoreHundredths: 0 },
      ]).map((row) => row.rank),
    ).toEqual([1, 2, 2, 4]);
  });
});
