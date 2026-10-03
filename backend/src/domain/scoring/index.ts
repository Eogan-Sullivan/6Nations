import {
  METRICS,
  type PlayerFixtureStatistics,
  type FixtureScore,
  type Player,
  type SquadSelection,
  type EntryRoundResult,
  type Standing,
} from '../../contracts/types.js';

const forwards = new Set(['prop', 'hooker', 'lock', 'back_row']);
const weights = [1500, 700, 200, 300, 500, 10, 400, 200, 400, 100, -100, -500, -1500, 0, 0, 0];
/** Arbitrary decimal precision, accumulated before the single fixture rounding. */
function decimal(value: string): { n: bigint; scale: bigint } {
  if (!/^\d+(?:\.\d+)?$/.test(value) || value.length > 128)
    throw new Error('Invalid nonnegative statistic decimal');
  const [whole, fraction = ''] = value.split('.');
  return { n: BigInt(whole! + fraction), scale: 10n ** BigInt(fraction.length) };
}
function integer(n: bigint): number {
  const value = Number(n);
  if (!Number.isSafeInteger(value)) throw new Error('Score exceeds safe integer range');
  return value;
}
function round(n: bigint, scale: bigint): number {
  const sign = n < 0n ? -1n : 1n;
  const absolute = n * sign;
  return integer(sign * (absolute / scale + ((absolute % scale) * 2n >= scale ? 1n : 0n)));
}
export function scorePlayerFixture(stats: PlayerFixtureStatistics): FixtureScore {
  if (stats.participated === false)
    return {
      playerId: stats.playerId,
      fixtureId: stats.fixtureId,
      participated: false,
      scoreHundredths: 0,
      knownScoreHundredths: 0,
      missingMetrics: [],
      tries: 0,
    };
  const missingMetrics: string[] = [];
  if (stats.participated === null) missingMetrics.push('participated');
  if (stats.started === null) missingMetrics.push('started');
  let sum =
    stats.participated === true && stats.started !== null ? BigInt(stats.started ? 400 : 200) : 0n;
  let scale = 1n;
  const isForward = forwards.has(stats.position);
  METRICS.forEach((metric, index) => {
    let weight = weights[index]!;
    if (isForward)
      weight =
        (
          {
            turnoversWon: 500,
            tackles: 150,
            lineoutSteals: 500,
            scrumPenaltiesWon: 300,
            penaltiesConceded: -200,
          } as Record<string, number>
        )[metric] ?? weight;
    if (weight === 0) return; // Not applicable is distinct from missing required coverage.
    const raw = stats.metrics[metric];
    if (raw === null || raw === undefined) {
      missingMetrics.push(metric);
      return;
    }
    const d = decimal(raw);
    if (metric !== 'metresCarried' && d.n % d.scale !== 0n)
      throw new Error('Event counts must be whole numbers');
    const common = d.scale > scale ? d.scale : scale;
    sum = sum * (common / scale) + d.n * BigInt(weight) * (common / d.scale);
    scale = common;
  });
  const knownScoreHundredths = round(sum, scale);
  const tries =
    stats.metrics.tries == null
      ? null
      : integer(decimal(stats.metrics.tries).n / decimal(stats.metrics.tries).scale);
  return {
    playerId: stats.playerId,
    fixtureId: stats.fixtureId,
    participated: stats.participated,
    missingMetrics,
    knownScoreHundredths,
    scoreHundredths: missingMetrics.length ? null : knownScoreHundredths,
    tries,
  };
}
export class IncompleteScoringError extends Error {
  readonly code = 'DATA_INCOMPLETE';
}
export function projectHalftime(
  selection: SquadSelection,
  statistics: readonly PlayerFixtureStatistics[],
) {
  const playerScores = statistics
    .filter((stat) =>
      selection.slots.some((slot) => slot.slot <= 15 && slot.playerId === stat.playerId),
    )
    .map(scorePlayerFixture);
  const missingPlayers = selection.slots
    .filter(
      (slot) => slot.slot <= 15 && !statistics.some((stat) => stat.playerId === slot.playerId),
    )
    .map((slot) => slot.playerId);
  const complete =
    missingPlayers.length === 0 && playerScores.every((score) => score.scoreHundredths !== null);
  const captain = playerScores.filter((score) => score.playerId === selection.captainId);
  const knownScoreHundredths =
    playerScores.reduce((sum, score) => sum + score.knownScoreHundredths, 0) +
    captain.reduce((sum, score) => sum + score.knownScoreHundredths, 0);
  return {
    status: complete ? 'provisional' : 'incomplete',
    scoreHundredths: complete ? knownScoreHundredths : null,
    knownScoreHundredths,
    playerScores,
    missingPlayers,
    reservesPending: true,
    captainFallbackPending: true,
  } as const;
}
export function scoreRound(
  entryId: string,
  selection: SquadSelection,
  players: readonly Player[],
  statistics: readonly PlayerFixtureStatistics[],
  mode: 'official' | 'halftime' = 'official',
): EntryRoundResult {
  const catalog = new Map(players.map((player) => [player.id, player]));
  const scores = new Map<string, { score: number; tries: number; participated: boolean }>();
  const observed = new Set<string>();
  for (const stat of statistics) {
    const key = stat.playerId + ':' + stat.fixtureId;
    if (observed.has(key)) throw new Error('Duplicate player fixture statistics');
    observed.add(key);
    const configuredPlayer = catalog.get(stat.playerId);
    if (!configuredPlayer)
      throw new IncompleteScoringError('Statistics player lacks season configuration');
    const result = scorePlayerFixture({ ...stat, position: configuredPlayer.position });
    if (result.scoreHundredths === null)
      throw new IncompleteScoringError('Required player statistics are incomplete');
    const prior = scores.get(stat.playerId) ?? { score: 0, tries: 0, participated: false };
    scores.set(stat.playerId, {
      score: integer(BigInt(prior.score) + BigInt(result.scoreHundredths)),
      tries: prior.tries + result.tries!,
      participated: prior.participated || stat.participated === true,
    });
  }
  const slots = [...selection.slots].sort((a, b) => a.slot - b.slot);
  for (const slot of slots)
    if (!scores.has(slot.playerId) || !catalog.has(slot.playerId))
      throw new IncompleteScoringError('Selected player lacks explicit participation evidence');
  const used = new Set<string>();
  const effectivePlayerIds: string[] = [];
  for (const slot of slots.filter((slot) => slot.slot <= 15)) {
    let playerId = slot.playerId;
    if (mode === 'official' && !scores.get(playerId)!.participated) {
      const reserve = slots.find(
        (candidate) =>
          candidate.slot > 15 &&
          !used.has(candidate.playerId) &&
          scores.get(candidate.playerId)!.participated &&
          catalog.get(candidate.playerId)!.position === catalog.get(playerId)!.position,
      );
      if (reserve) {
        playerId = reserve.playerId;
        used.add(playerId);
      }
    }
    effectivePlayerIds.push(playerId);
  }
  const captainId = scores.get(selection.captainId)?.participated
    ? selection.captainId
    : mode === 'official' && scores.get(selection.viceCaptainId)?.participated
      ? selection.viceCaptainId
      : null;
  const captainBonusHundredths = captainId ? scores.get(captainId)!.score : 0;
  return {
    entryId,
    scoreHundredths: integer(
      effectivePlayerIds.reduce(
        (sum, id) => sum + BigInt(scores.get(id)!.score),
        BigInt(captainBonusHundredths),
      ),
    ),
    captainBonusHundredths,
    contributingTries: effectivePlayerIds.reduce((sum, id) => sum + scores.get(id)!.tries, 0),
    effectivePlayerIds,
    captainId,
  };
}
export function rankStandings(entries: readonly Omit<Standing, 'rank'>[]): Standing[] {
  const compare = (a: Omit<Standing, 'rank'>, b: Omit<Standing, 'rank'>) =>
    b.scoreHundredths - a.scoreHundredths ||
    b.captainBonusHundredths - a.captainBonusHundredths ||
    b.contributingTries - a.contributingTries ||
    Date.parse(a.registeredAt) - Date.parse(b.registeredAt);
  const ordered = [...entries].sort((a, b) => compare(a, b) || a.entryId.localeCompare(b.entryId));
  return ordered
    .map((entry, index) => ({
      ...entry,
      rank: index && compare(entry, ordered[index - 1]!) === 0 ? 0 : index + 1,
    }))
    .map((entry, index, array) => {
      if (!entry.rank) entry.rank = array[index - 1]!.rank;
      return entry;
    });
}
