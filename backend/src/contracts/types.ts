/** Backend-owned wire contracts. Public consumers use generated OpenAPI types. */
export type UUID = string;
export type Instant = string;
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type Position =
  'prop' | 'hooker' | 'lock' | 'back_row' | 'scrum_half' | 'fly_half' | 'centre' | 'outside_back';
export const FORMATION: readonly Position[] = [
  'prop',
  'prop',
  'hooker',
  'lock',
  'lock',
  'back_row',
  'back_row',
  'back_row',
  'scrum_half',
  'fly_half',
  'centre',
  'centre',
  'outside_back',
  'outside_back',
  'outside_back',
];
export const ERROR_CODES = [
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'VALIDATION_ERROR',
  'ROUND_LOCKED',
  'REVISION_CONFLICT',
  'OVER_BUDGET',
  'INVALID_FORMATION',
  'NATION_LIMIT',
  'INVALID_CAPTAIN',
  'DUPLICATE_PLAYER',
  'INELIGIBLE_PLAYER',
  'IDEMPOTENCY_CONFLICT',
  'DATA_INCOMPLETE',
  'OWNER_TRANSFER_REQUIRED',
  'INVALID_INVITE',
  'RATE_LIMITED',
  'LEASE_LOST',
  'QUOTA_EXCEEDED',
  'PROVIDER_DISABLED',
  'APPROVAL_REQUIRED',
  'INTERNAL_ERROR',
  'DEPENDENCY_UNAVAILABLE',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];
export interface GameError {
  code: ErrorCode;
  message: string;
  details?: Json;
  retryable?: boolean;
}
export type RpcResult<T> = { data: T; error?: never } | { error: GameError; data?: never };
export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}
export interface Player {
  id: UUID;
  seasonId: UUID;
  nationId: UUID;
  name: string;
  position: Position;
  priceTenths: number;
  eligible: boolean;
}
/** Slots 1–15 are FORMATION order; 16–18 are reserve priority order. */
export interface SquadSlot {
  slot: number;
  playerId: UUID;
}
export interface SquadSelection {
  slots: SquadSlot[];
  captainId: UUID;
  viceCaptainId: UUID;
}
export interface ConfirmSquadInput extends SquadSelection {
  requestId: UUID;
  roundId: UUID;
  expectedRevision: number;
}
export interface SquadView {
  id: UUID | null;
  entryId: UUID;
  roundId: UUID;
  revision: number;
  selection: SquadSelection | null;
  deadline: Instant;
  serverTime: Instant;
  locked: boolean;
  provenance: 'confirmed' | 'carried' | null;
}
export interface Standing {
  entryId: UUID;
  displayName: string;
  rank: number;
  scoreHundredths: number;
  captainBonusHundredths: number;
  contributingTries: number;
  registeredAt: Instant;
}
export interface StandingsView extends Page<Standing> {
  versionId: UUID | null;
  ownRank: number | null;
  status: 'unpublished' | 'official';
}
export interface League {
  id: UUID;
  seasonId: UUID;
  name: string;
  ownerId: UUID;
  archived: boolean;
  inviteCode?: string;
}
export type ReadOperation =
  | 'player_statistics'
  | 'seasons'
  | 'rounds'
  | 'players'
  | 'squad'
  | 'leagues'
  | 'league'
  | 'standings'
  | 'fixtures'
  | 'match'
  | 'profile'
  | 'notifications'
  | 'operation'
  | 'admin_state';
export type CommandOperation =
  | 'enter_season'
  | 'confirm_squad'
  | 'create_league'
  | 'join_league'
  | 'leave_league'
  | 'rotate_invite'
  | 'remove_member'
  | 'transfer_league'
  | 'archive_league'
  | 'update_profile'
  | 'register_push'
  | 'detach_push'
  | 'mark_notification_read'
  | 'request_export'
  | 'request_delete'
  | 'preview_import'
  | 'commit_import'
  | 'approve_run'
  | 'publish_run'
  | 'correct_run'
  | 'schedule_job'
  | 'fixture_disposition'
  | 'publish_deadline'
  | 'release_override';
export interface CommandInput {
  requestId: UUID;
  [key: string]: Json;
}
export const METRICS = [
  'tries',
  'tryAssists',
  'conversions',
  'penaltyKicks',
  'dropGoals',
  'metresCarried',
  'cleanBreaks',
  'defendersBeaten',
  'turnoversWon',
  'tackles',
  'missedTackles',
  'yellowCards',
  'redCards',
  'lineoutSteals',
  'scrumPenaltiesWon',
  'penaltiesConceded',
] as const;
export type Metric = (typeof METRICS)[number];
/** Decimal strings preserve source precision; null is unknown, never implicit zero. */
export interface PlayerFixtureStatistics {
  fixtureId: UUID;
  playerId: UUID;
  position: Position;
  participated: boolean | null;
  started: boolean | null;
  metrics: Record<Metric, string | null>;
}
export interface FixtureScore {
  playerId: UUID;
  fixtureId: UUID;
  scoreHundredths: number | null;
  knownScoreHundredths: number;
  missingMetrics: string[];
  participated: boolean | null;
  tries: number | null;
}
export interface EntryRoundResult {
  entryId: UUID;
  scoreHundredths: number;
  captainBonusHundredths: number;
  contributingTries: number;
  effectivePlayerIds: UUID[];
  captainId: UUID | null;
}
export type JobKind =
  | 'lock_round'
  | 'halftime'
  | 'reconcile'
  | 'recovery'
  | 'ingest_import'
  | 'score_round'
  | 'publish'
  | 'notify'
  | 'export_account'
  | 'delete_account'
  | 'reminder';
export interface ScheduledJob {
  id: UUID;
  kind: JobKind;
  payload: Json;
  attempts: number;
  maxAttempts: number;
  leaseToken: UUID;
  leaseExpiresAt: Instant;
}
export interface LeaseInput {
  jobId: UUID;
  leaseToken: UUID;
  workerId: string;
}
export interface ClaimJobsInput {
  workerId: string;
  limit: number;
  leaseSeconds: number;
}
export interface FinishJobInput extends LeaseInput {
  result: Json;
}
export interface RetryJobInput extends LeaseInput {
  error: GameError;
  retryAt: Instant | null;
}
export interface HeartbeatJobInput extends LeaseInput {
  leaseSeconds: number;
}
export interface ReserveRequestInput extends LeaseInput {
  provider: string;
  requestKey: string;
  opportunityKey: string;
  maxRequests: number;
}
export interface StageRunInput extends LeaseInput {
  roundId: UUID;
  statisticsRevisionId: UUID;
  inputManifest: Json;
  results: EntryRoundResult[];
  playerScores: FixtureScore[];
  complete: boolean;
}
export interface PublishRunInput extends LeaseInput {
  runId: UUID;
  approvalId: UUID;
}
export interface NormalizedObservation {
  source: string;
  sourceRevision: string;
  fixtureId: UUID;
  observedAt: Instant;
  statistics: PlayerFixtureStatistics[];
  provenance: Json;
}
