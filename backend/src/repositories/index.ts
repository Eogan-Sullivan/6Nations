import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  ClaimJobsInput,
  CommandOperation,
  FinishJobInput,
  HeartbeatJobInput,
  Json,
  LeaseInput,
  NormalizedObservation,
  PublishRunInput,
  ReadOperation,
  ReserveRequestInput,
  RetryJobInput,
  RpcResult,
  ScheduledJob,
  StageRunInput,
} from '../contracts/types.js';

export interface RepositoryConfig {
  supabaseUrl: string;
  supabasePublishableKey: string;
  supabaseServiceRoleKey?: string;
}
export interface AuthenticatedUser {
  id: string;
  aal: string;
  authenticatedAt: number | null;
  accessToken: string;
}
export interface UserRepository {
  read<T = Json>(operation: ReadOperation, input: Json): Promise<RpcResult<T>>;
  command<T = Json>(operation: CommandOperation, input: Json): Promise<RpcResult<T>>;
}
export interface WorkerRepository {
  claimJobs(input: ClaimJobsInput): Promise<RpcResult<ScheduledJob[]>>;
  heartbeatJob(input: HeartbeatJobInput): Promise<RpcResult<ScheduledJob>>;
  finishJob(input: FinishJobInput): Promise<RpcResult<{ finished: true }>>;
  retryJob(input: RetryJobInput): Promise<RpcResult<{ scheduled: boolean }>>;
  reserveRequest(input: ReserveRequestInput): Promise<RpcResult<{ reserved: boolean }>>;
  ingestObservation(
    input: LeaseInput & { observation: NormalizedObservation },
  ): Promise<RpcResult<{ statisticsRevisionId: string }>>;
  stageRun(input: StageRunInput): Promise<RpcResult<{ runId: string }>>;
  publishRun(input: PublishRunInput): Promise<RpcResult<{ versionId: string }>>;
  deleteAuthUser(userId: string): Promise<RpcResult<{ deleted: true }>>;
  executeJob(
    input: LeaseInput & { kind?: string; deliveries?: Json; authDeleted?: boolean },
  ): Promise<RpcResult<Json>>;
  jobContext<T = Json>(input: LeaseInput): Promise<RpcResult<T>>;
}
function client(config: RepositoryConfig, token?: string): SupabaseClient {
  return createClient(
    config.supabaseUrl,
    token ? config.supabasePublishableKey : (config.supabaseServiceRoleKey ?? ''),
    {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      ...(token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}),
    },
  );
}
async function rpc<T>(
  db: SupabaseClient,
  name: string,
  input: Record<string, unknown>,
): Promise<RpcResult<T>> {
  try {
    const { data, error } = await db.rpc(name, input);
    if (error)
      return {
        error: {
          code: 'DEPENDENCY_UNAVAILABLE',
          message: 'Database operation failed',
          retryable: true,
        },
      };
    if (!data || typeof data !== 'object' || (!('data' in data) && !('error' in data)))
      return { error: { code: 'INTERNAL_ERROR', message: 'Invalid database response' } };
    return data as RpcResult<T>;
  } catch {
    return {
      error: { code: 'DEPENDENCY_UNAVAILABLE', message: 'Database unavailable', retryable: true },
    };
  }
}
export async function authenticateAccessToken(
  config: RepositoryConfig,
  token: string,
): Promise<RpcResult<AuthenticatedUser>> {
  const db = client(config, token);
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user)
    return { error: { code: 'UNAUTHENTICATED', message: 'Invalid or expired access token' } };
  const verified = await db.auth.getClaims(token);
  if (verified.error || !verified.data || verified.data.claims.sub !== data.user.id)
    return { error: { code: 'UNAUTHENTICATED', message: 'Invalid access token claims' } };
  const claims = verified.data.claims as Record<string, unknown>;
  const amr = Array.isArray(claims.amr) ? claims.amr : [];
  const times = amr
    .filter(
      (v): v is { timestamp: number; method: string } =>
        !!v &&
        typeof v === 'object' &&
        typeof (v as { timestamp?: unknown }).timestamp === 'number' &&
        (v as { method?: unknown }).method !== 'token_refresh',
    )
    .map((v) => v.timestamp);
  return {
    data: {
      id: data.user.id,
      aal: typeof claims.aal === 'string' ? claims.aal : 'aal1',
      authenticatedAt: times.length ? Math.max(...times) : null,
      accessToken: token,
    },
  };
}
export function createUserRepository(
  config: RepositoryConfig,
  accessToken: string,
): UserRepository {
  const db = client(config, accessToken);
  return {
    read: (operation, input) => rpc(db, 'game_read', { p_operation: operation, p_input: input }),
    command: (operation, input) =>
      rpc(db, 'game_command', { p_operation: operation, p_input: input }),
  };
}
export function createWorkerRepository(config: RepositoryConfig): WorkerRepository {
  const db = client(config);
  return {
    claimJobs: (i) => rpc(db, 'worker_claim_jobs', { p_input: i }),
    heartbeatJob: (i) => rpc(db, 'worker_heartbeat_job', { p_input: i }),
    finishJob: (i) => rpc(db, 'worker_finish_job', { p_input: i }),
    retryJob: (i) => rpc(db, 'worker_retry_job', { p_input: i }),
    reserveRequest: (i) => rpc(db, 'worker_reserve_request', { p_input: i }),
    ingestObservation: (i) => rpc(db, 'worker_ingest_observation', { p_input: i }),
    stageRun: (i) => rpc(db, 'worker_stage_run', { p_input: i }),
    publishRun: (i) => rpc(db, 'worker_publish_run', { p_input: i }),
    deleteAuthUser: async (userId) => {
      const { error } = await db.auth.admin.deleteUser(userId);
      return error && error.status !== 404
        ? {
            error: {
              code: 'DEPENDENCY_UNAVAILABLE',
              message: 'Account identity removal failed',
              retryable: true,
            },
          }
        : { data: { deleted: true } };
    },
    executeJob: (i) => rpc(db, 'worker_execute_job', { p_input: i }),
    jobContext: (i) => rpc(db, 'worker_job_context', { p_input: i }),
  };
}
