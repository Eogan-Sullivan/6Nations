import type { GameError, Json, LeaseInput, RpcResult, ScheduledJob } from '../contracts/types.js';
import type { WorkerRepository } from '../repositories/index.js';
import { log } from '../observability/logger.js';

export class JobError extends Error {
  constructor(public readonly detail: GameError) {
    super(detail.message);
  }
}
export function unwrap<T>(result: RpcResult<T>): T {
  if (result.error) throw new JobError(result.error);
  return result.data;
}
export type JobHandler = (
  job: ScheduledJob,
  lease: LeaseInput,
  signal: AbortSignal,
) => Promise<Json>;
export class DurableWorker {
  private stopping = false;
  constructor(
    private readonly repository: WorkerRepository,
    private readonly handler: JobHandler,
    private readonly options: {
      workerId: string;
      leaseSeconds: number;
      batchSize: number;
      onHeartbeat?: () => Promise<void>;
    },
  ) {}
  stop(): void {
    this.stopping = true;
  }
  async tick(): Promise<number> {
    if (this.stopping) return 0;
    // Claim only what can start immediately; sequential processing must not let queued leases expire.
    const jobs = unwrap(
      await this.repository.claimJobs({
        workerId: this.options.workerId,
        limit: this.options.batchSize,
        leaseSeconds: this.options.leaseSeconds,
      }),
    );
    await Promise.all(jobs.map((job) => this.run(job)));
    await this.options.onHeartbeat?.();
    return jobs.length;
  }
  private async run(job: ScheduledJob): Promise<void> {
    const lease = { jobId: job.id, leaseToken: job.leaseToken, workerId: this.options.workerId };
    const abort = new AbortController();
    let renewing: Promise<void> | null = null;
    let leaseError: unknown;
    const timer = setInterval(
      () => {
        if (renewing) return;
        renewing = this.repository
          .heartbeatJob({ ...lease, leaseSeconds: this.options.leaseSeconds })
          .then(async (result) => {
            unwrap(result);
            await this.options.onHeartbeat?.();
          })
          .catch((error) => {
            leaseError = error;
            abort.abort();
          })
          .finally(() => {
            renewing = null;
          });
      },
      Math.max(1000, Math.floor((this.options.leaseSeconds * 1000) / 3)),
    );
    try {
      const result = await this.handler(job, lease, abort.signal);
      if (leaseError) throw leaseError;
      unwrap(await this.repository.finishJob({ ...lease, result }));
      log('job_completed', { jobId: job.id, kind: job.kind });
    } catch (error) {
      const detail: GameError =
        error instanceof JobError
          ? error.detail
          : { code: 'DEPENDENCY_UNAVAILABLE', message: 'Worker job failed', retryable: true };
      // Halftime/recovery opportunities are separately scheduled; infrastructure retries never add provider opportunities.
      const retryable =
        detail.retryable === true &&
        job.attempts < job.maxAttempts &&
        !['halftime', 'recovery'].includes(job.kind);
      const retryAt = retryable
        ? new Date(
            Date.now() + Math.min(300_000, 1000 * 2 ** Math.min(job.attempts, 8)),
          ).toISOString()
        : null;
      const outcome = await this.repository.retryJob({ ...lease, error: detail, retryAt });
      log('job_failed', {
        jobId: job.id,
        kind: job.kind,
        code: detail.code,
        rescheduled: outcome.data?.scheduled ?? false,
      });
    } finally {
      clearInterval(timer);
      if (renewing) await renewing;
    }
  }
}
