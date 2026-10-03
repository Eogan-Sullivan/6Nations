import { ERROR_CODES, FORMATION, METRICS } from '../contracts/types.js';
export type Schema = Record<string, unknown>;
export const uuid: Schema = { type: 'string', format: 'uuid' };
const text = (maxLength = 200): Schema => ({ type: 'string', minLength: 1, maxLength });
export const integer: Schema = { type: 'integer', minimum: 0 };
export const instant: Schema = { type: 'string', format: 'date-time' };
export const object = (
  properties: Record<string, Schema>,
  required = Object.keys(properties),
): Schema => ({ type: 'object', properties, required, additionalProperties: false });
export const array = (items: Schema): Schema => ({ type: 'array', items, maxItems: 10000 });
export const nullable = (schema: Schema): Schema => ({ anyOf: [schema, { type: 'null' }] });
export const json: Schema = {
  anyOf: [
    { type: 'null' },
    { type: 'boolean' },
    { type: 'number' },
    { type: 'string' },
    { type: 'array', items: {} },
    { type: 'object', additionalProperties: true },
  ],
};
export const selection = {
  slots: {
    type: 'array',
    minItems: 18,
    maxItems: 18,
    items: object({ slot: { type: 'integer', minimum: 1, maximum: 18 }, playerId: uuid }),
  },
  captainId: uuid,
  viceCaptainId: uuid,
};
export const player = object({
  id: uuid,
  seasonId: uuid,
  nationId: uuid,
  name: text(),
  position: { type: 'string', enum: [...new Set(FORMATION)] },
  priceTenths: integer,
  eligible: { type: 'boolean' },
});
export const league = object(
  {
    id: uuid,
    seasonId: uuid,
    name: text(80),
    ownerId: uuid,
    archived: { type: 'boolean' },
    inviteCode: { type: 'string', pattern: '^[A-Z0-9]{6}$' },
  },
  ['id', 'seasonId', 'name', 'ownerId', 'archived'],
);
export const standing = object({
  entryId: uuid,
  displayName: text(),
  rank: integer,
  scoreHundredths: { type: 'integer' },
  captainBonusHundredths: { type: 'integer' },
  contributingTries: integer,
  registeredAt: instant,
});
export const page = (items: Schema): Schema =>
  object({ items: array(items), nextCursor: nullable(text(512)) });
const statistics = object({
  fixtureId: uuid,
  playerId: uuid,
  position: { type: 'string', enum: [...new Set(FORMATION)] },
  participated: nullable({ type: 'boolean' }),
  started: nullable({ type: 'boolean' }),
  metrics: object(
    Object.fromEntries(
      METRICS.map((metric) => [
        metric,
        nullable({
          type: 'string',
          pattern: metric === 'metresCarried' ? '^\\d+(?:\\.\\d+)?$' : '^\\d+(?:\\.0+)?$',
        }),
      ]),
    ),
  ),
});
const observation = object({
  source: text(100),
  sourceRevision: text(200),
  fixtureId: uuid,
  observedAt: instant,
  statistics: array(statistics),
  provenance: json,
});
const coverage = object(
  { complete: { type: 'boolean' }, missingMetrics: array(text(100)), missingPlayers: array(uuid) },
  ['complete'],
);
const freshness = object(
  {
    observedAt: nullable(instant),
    nextUpdateAt: nullable(instant),
    label: { type: 'string', enum: ['Halftime update', 'Mid-match snapshot', 'Sunday update'] },
    stale: { type: 'boolean' },
  },
  ['observedAt', 'stale'],
);
const publication = object({
  versionId: nullable(uuid),
  status: {
    type: 'string',
    enum: ['unpublished', 'incomplete', 'provisional', 'official', 'corrected'],
  },
});
export const readDefinitions: Record<string, { query: Schema; data: Schema }> = {
  player_statistics: {
    query: object(
      {
        seasonId: uuid,
        playerId: uuid,
        cursor: text(512),
        limit: { type: 'integer', minimum: 1, maximum: 100 },
      },
      ['seasonId', 'playerId'],
    ),
    data: page(
      object({
        fixtureId: uuid,
        roundId: uuid,
        versionId: uuid,
        statistics,
        scoreHundredths: nullable({ type: 'integer' }),
        provenance: json,
        observedAt: instant,
      }),
    ),
  },
  seasons: {
    query: object({}, []),
    data: array(object({ id: uuid, name: text(), entryOpen: { type: 'boolean' } }, ['id', 'name'])),
  },
  rounds: {
    query: object({ seasonId: uuid }),
    data: array(
      object({ id: uuid, seasonId: uuid, number: integer, deadline: instant, status: text() }, [
        'id',
        'seasonId',
        'number',
        'deadline',
      ]),
    ),
  },
  players: {
    query: object(
      {
        seasonId: uuid,
        position: { type: 'string', enum: [...new Set(FORMATION)] },
        nationId: uuid,
        cursor: text(512),
        limit: { type: 'integer', minimum: 1, maximum: 100 },
        search: text(100),
      },
      ['seasonId'],
    ),
    data: page(player),
  },
  squad: {
    query: object({ roundId: uuid, entryId: uuid }, ['roundId']),
    data: object({
      id: nullable(uuid),
      entryId: uuid,
      roundId: uuid,
      revision: integer,
      selection: nullable(object(selection)),
      deadline: instant,
      serverTime: instant,
      locked: { type: 'boolean' },
      provenance: { enum: ['confirmed', 'carried', null] },
    }),
  },
  leagues: {
    query: object(
      { seasonId: uuid, cursor: text(512), limit: { type: 'integer', minimum: 1, maximum: 100 } },
      ['seasonId'],
    ),
    data: page(league),
  },
  league: {
    query: object({ leagueId: uuid }),
    data: object(
      { league, members: array(object({ userId: uuid, displayName: text() }, ['userId'])) },
      ['league'],
    ),
  },
  standings: {
    query: object(
      {
        seasonId: uuid,
        leagueId: uuid,
        cursor: text(512),
        limit: { type: 'integer', minimum: 1, maximum: 100 },
      },
      ['seasonId'],
    ),
    data: object({
      items: array(standing),
      nextCursor: nullable(text(512)),
      versionId: nullable(uuid),
      ownRank: nullable(integer),
      status: { enum: ['unpublished', 'official'] },
    }),
  },
  fixtures: {
    query: object(
      {
        seasonId: uuid,
        roundId: uuid,
        cursor: text(512),
        limit: { type: 'integer', minimum: 1, maximum: 100 },
      },
      ['seasonId'],
    ),
    data: page(
      object({
        id: uuid,
        roundId: uuid,
        kickoff: instant,
        status: text(),
        fullTime: nullable(instant),
        disposition: nullable(text()),
        dispositionApproved: { type: 'boolean' },
        homeNationId: nullable(uuid),
        awayNationId: nullable(uuid),
        homeScore: nullable(integer),
        awayScore: nullable(integer),
      }),
    ),
  },
  match: {
    query: object({ fixtureId: uuid }),
    data: object(
      {
        fixtureId: uuid,
        roundId: uuid,
        seasonId: uuid,
        status: text(),
        snapshot: nullable(observation),
        coverage,
        provisionalTotals: nullable(
          object({
            scope: { const: 'fixture', type: 'string' },
            status: { enum: ['provisional', 'incomplete'] },
            scoreHundredths: nullable({ type: 'integer' }),
            knownScoreHundredths: { type: 'integer' },
            playerScores: array(
              object({
                playerId: uuid,
                fixtureId: uuid,
                scoreHundredths: nullable({ type: 'integer' }),
                knownScoreHundredths: { type: 'integer' },
                missingMetrics: array(text()),
                participated: nullable({ type: 'boolean' }),
                tries: nullable(integer),
              }),
            ),
            missingPlayers: array(uuid),
            reservesPending: { const: true, type: 'boolean' },
            captainFallbackPending: { const: true, type: 'boolean' },
          }),
        ),
        observedAt: nullable(instant),
        versionId: nullable(uuid),
        freshness,
        publication,
      },
      ['fixtureId', 'status', 'snapshot', 'coverage', 'observedAt', 'versionId'],
    ),
  },
  profile: {
    query: object({}, []),
    data: object({ id: uuid, displayName: text(), reminders: { type: 'boolean' } }, [
      'id',
      'displayName',
    ]),
  },
  notifications: {
    query: object({ cursor: text(512), limit: { type: 'integer', minimum: 1, maximum: 100 } }, []),
    data: page(
      object(
        { id: uuid, kind: text(), payload: json, readAt: nullable(instant), createdAt: instant },
        ['id', 'kind', 'payload', 'createdAt'],
      ),
    ),
  },
  operation: {
    query: object({ operationId: uuid }),
    data: object({ id: uuid, kind: text(), status: text(), result: nullable(json) }, [
      'id',
      'kind',
      'status',
    ]),
  },
  admin_state: {
    query: object({ seasonId: uuid }, []),
    data: object(
      { jobs: array(json), imports: array(json), runs: array(json), coverage: array(json) },
      [],
    ),
  },
};
const commands: Record<string, Record<string, Schema>> = {
  enter_season: { seasonId: uuid },
  confirm_squad: { roundId: uuid, expectedRevision: integer, ...selection },
  create_league: { seasonId: uuid, name: text(80) },
  join_league: { seasonId: uuid, inviteCode: { type: 'string', pattern: '^[A-Z0-9]{6}$' } },
  leave_league: { leagueId: uuid },
  rotate_invite: { leagueId: uuid },
  remove_member: { leagueId: uuid, userId: uuid },
  transfer_league: { leagueId: uuid, userId: uuid },
  archive_league: { leagueId: uuid },
  update_profile: { displayName: text(60), reminders: { type: 'boolean' } },
  register_push: { token: text(256), platform: { enum: ['ios', 'android', 'web'] } },
  detach_push: { token: text(256) },
  mark_notification_read: { notificationId: uuid },
  request_export: {},
  request_delete: {},
  preview_import: {
    seasonId: uuid,
    format: { enum: ['json'] },
    content: text(524288),
    reason: text(1000),
  },
  commit_import: { previewId: uuid, reason: text(1000) },
  approve_run: { runId: uuid, reason: text(1000) },
  publish_run: { runId: uuid, reason: text(1000) },
  correct_run: { runId: uuid, reason: text(1000) },
  schedule_job: {
    kind: {
      type: 'string',
      enum: [
        'lock_round',
        'halftime',
        'reconcile',
        'recovery',
        'ingest_import',
        'score_round',
        'publish',
        'notify',
        'export_account',
        'delete_account',
        'reminder',
      ],
    },
    runAt: instant,
    maxAttempts: { type: 'integer', minimum: 1, maximum: 10 },
    idempotencyKey: text(200),
    payload: json,
    reason: text(1000),
  },
  fixture_disposition: {
    fixtureId: uuid,
    disposition: { enum: ['cancelled', 'abandoned', 'awarded', 'played', 'postponed'] },
    reason: text(1000),
  },
  publish_deadline: { roundId: uuid, deadline: instant, reason: text(1000) },
  release_override: { statisticsRevisionId: uuid, reason: text(1000) },
};
export const commandDefinitions = Object.fromEntries(
  Object.entries(commands).map(([name, fields]) => [name, object({ requestId: uuid, ...fields })]),
);
export const errorSchema = object({
  requestId: text(128),
  error: object(
    {
      code: { enum: ERROR_CODES },
      message: text(1000),
      details: json,
      retryable: { type: 'boolean' },
    },
    ['code', 'message'],
  ),
});
export const commandResult = object(
  {
    id: uuid,
    entryId: uuid,
    leagueId: uuid,
    roundId: uuid,
    approvalId: uuid,
    importId: uuid,
    league,
    revision: integer,
    selection: object(selection),
    operationId: uuid,
    jobId: uuid,
    runId: uuid,
    versionId: uuid,
    previewId: uuid,
    inviteCode: text(6),
    report: json,
    success: { type: 'boolean' },
    updated: { type: 'boolean' },
    registered: { type: 'boolean' },
    detached: { type: 'boolean' },
    released: { type: 'boolean' },
    deadline: instant,
    serverTime: instant,
    locked: { type: 'boolean' },
    provenance: { enum: ['confirmed', 'carried', null] },
  },
  [],
);
export function commandResponse(operation: string): Schema {
  if (operation === 'confirm_squad') return readDefinitions.squad!.data;
  if (operation === 'enter_season') return object({ entryId: uuid });
  if (
    [
      'create_league',
      'join_league',
      'leave_league',
      'rotate_invite',
      'remove_member',
      'transfer_league',
      'archive_league',
    ].includes(operation)
  )
    return object({ leagueId: uuid });
  if (
    [
      'update_profile',
      'mark_notification_read',
      'fixture_disposition',
      'publish_deadline',
    ].includes(operation)
  )
    return object({ updated: { type: 'boolean' } });
  if (operation === 'register_push') return object({ registered: { type: 'boolean' } });
  if (operation === 'detach_push') return object({ detached: { type: 'boolean' } });
  if (operation === 'release_override') return object({ released: { type: 'boolean' } });
  if (['request_export', 'request_delete'].includes(operation))
    return object({ operationId: uuid });
  if (operation === 'preview_import')
    return object({ previewId: uuid, valid: { type: 'boolean' } });
  if (operation === 'commit_import') return object({ importId: uuid });
  if (operation === 'approve_run') return object({ approvalId: uuid });
  if (['publish_run', 'correct_run'].includes(operation)) return object({ versionId: uuid });
  if (operation === 'schedule_job') return object({ jobId: uuid });
  return commandResult;
}
