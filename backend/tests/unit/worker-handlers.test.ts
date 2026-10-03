import { it, expect, vi } from 'vitest';
import { createJobHandler } from '../../src/jobs/handlers.js';
import type { WorkerRepository } from '../../src/repositories/index.js';
import type { ScheduledJob } from '../../src/contracts/types.js';
const lease = { jobId: 'j', leaseToken: 't', workerId: 'w' };
const job: ScheduledJob = {
  id: 'j',
  kind: 'delete_account',
  payload: {},
  attempts: 1,
  maxAttempts: 3,
  leaseToken: 't',
  leaseExpiresAt: '2030-01-01T00:00:00Z',
};
it('completes deletion only after database anonymization and Auth deletion succeed', async () => {
  const order: string[] = [];
  const repository = {
    jobContext: async () => ({ data: {} }),
    executeJob: async (input: { authDeleted?: boolean }) => {
      order.push(input.authDeleted ? 'completed' : 'anonymized');
      return { data: input.authDeleted ? { completed: true } : { userId: 'u', anonymized: true } };
    },
    deleteAuthUser: async () => {
      order.push('auth_deleted');
      return { data: { deleted: true } };
    },
  } as unknown as WorkerRepository;
  await createJobHandler(repository)(job, lease, new AbortController().signal);
  expect(order).toEqual(['anonymized', 'auth_deleted', 'completed']);
});
it('does not mark failed Auth deletion completed', async () => {
  const execute = vi.fn(async () => ({ data: { userId: 'u', anonymized: true } }));
  const repository = {
    jobContext: async () => ({ data: {} }),
    executeJob: execute,
    deleteAuthUser: async () => ({
      error: { code: 'DEPENDENCY_UNAVAILABLE', message: 'synthetic', retryable: true },
    }),
  } as unknown as WorkerRepository;
  await expect(
    createJobHandler(repository)(job, lease, new AbortController().signal),
  ).rejects.toThrow();
  expect(execute).toHaveBeenCalledTimes(1);
});
it('rejects scoring context without exact input manifest', async () => {
  const stage = vi.fn();
  const repository = {
    jobContext: async () => ({
      data: { roundId: 'r', statisticsRevisionId: 'rev', statistics: [], players: [], entries: [] },
    }),
    stageRun: stage,
  } as unknown as WorkerRepository;
  await expect(
    createJobHandler(repository)(
      { ...job, kind: 'score_round' },
      lease,
      new AbortController().signal,
    ),
  ).rejects.toThrow('Scoring inputs missing');
  expect(stage).not.toHaveBeenCalled();
});
it('does not fetch or ingest a skipped later opportunity', async () => {
  const ingest = vi.fn();
  const repository = {
    jobContext: async () => ({ data: { skip: true } }),
    ingestObservation: ingest,
  } as unknown as WorkerRepository;
  expect(
    await createJobHandler(repository)(
      { ...job, kind: 'halftime' },
      lease,
      new AbortController().signal,
    ),
  ).toEqual({ skipped: true });
  expect(ingest).not.toHaveBeenCalled();
});
