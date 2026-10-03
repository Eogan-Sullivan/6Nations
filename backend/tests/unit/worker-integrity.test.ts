import { it, expect, vi } from 'vitest';
import type { ScheduledJob } from '../../src/contracts/types.js';
import type { WorkerRepository } from '../../src/repositories/index.js';
import { DurableWorker, JobError } from '../../src/jobs/worker.js';
const job: ScheduledJob = {
  id: 'j',
  kind: 'score_round',
  payload: {},
  attempts: 1,
  maxAttempts: 3,
  leaseToken: 't',
  leaseExpiresAt: '2030-01-01T00:00:00Z',
};
function repository(): WorkerRepository {
  return {
    claimJobs: vi.fn(async () => ({ data: [job] })),
    heartbeatJob: vi.fn(async () => ({ data: job })),
    finishJob: vi.fn(async () => ({ data: { finished: true as const } })),
    retryJob: vi.fn(async () => ({ data: { scheduled: true } })),
    reserveRequest: vi.fn(async () => ({ data: { reserved: true } })),
    ingestObservation: vi.fn(),
    stageRun: vi.fn(),
    publishRun: vi.fn(),
    jobContext: vi.fn(),
    executeJob: vi.fn(),
    deleteAuthUser: vi.fn(),
  } as WorkerRepository;
}
it('fences completion using the database claim token', async () => {
  const db = repository();
  const worker = new DurableWorker(db, async () => ({ done: true }), {
    workerId: 'w',
    leaseSeconds: 10,
    batchSize: 1,
  });
  await worker.tick();
  expect(db.finishJob).toHaveBeenCalledWith({
    jobId: 'j',
    leaseToken: 't',
    workerId: 'w',
    result: { done: true },
  });
  worker.stop();
  await worker.tick();
  expect(db.claimJobs).toHaveBeenCalledTimes(1);
});
it('persists retry rather than sleeping inside the lease', async () => {
  const db = repository();
  await new DurableWorker(
    db,
    async () => {
      throw new JobError({
        code: 'DEPENDENCY_UNAVAILABLE',
        message: 'unavailable',
        retryable: true,
      });
    },
    { workerId: 'w', leaseSeconds: 10, batchSize: 1 },
  ).tick();
  expect(db.finishJob).not.toHaveBeenCalled();
  expect(db.retryJob).toHaveBeenCalledWith(
    expect.objectContaining({ retryAt: expect.any(String) }),
  );
});
it('never creates additional halftime opportunities from retries', async () => {
  const db = repository();
  vi.mocked(db.claimJobs).mockResolvedValue({ data: [{ ...job, kind: 'halftime' }] });
  await new DurableWorker(
    db,
    async () => {
      throw new JobError({
        code: 'DEPENDENCY_UNAVAILABLE',
        message: 'unavailable',
        retryable: true,
      });
    },
    { workerId: 'w', leaseSeconds: 10, batchSize: 1 },
  ).tick();
  expect(db.retryJob).toHaveBeenCalledWith(expect.objectContaining({ retryAt: null }));
});
it('does not finish after lease renewal failure', async () => {
  vi.useFakeTimers();
  const db = repository();
  vi.mocked(db.heartbeatJob).mockResolvedValue({
    error: { code: 'LEASE_LOST', message: 'expired' },
  });
  const worker = new DurableWorker(
    db,
    async () => {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      return {};
    },
    { workerId: 'w', leaseSeconds: 10, batchSize: 1 },
  );
  const run = worker.tick();
  await vi.advanceTimersByTimeAsync(5001);
  await run;
  expect(db.finishJob).not.toHaveBeenCalled();
  vi.useRealTimers();
});
