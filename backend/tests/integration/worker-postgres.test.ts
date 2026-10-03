import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import type { RpcResult, ScheduledJob } from '../../src/contracts/types.js';
import type { WorkerRepository } from '../../src/repositories/index.js';
import { DurableWorker, unwrap } from '../../src/jobs/worker.js';
const container = process.env.WORKER_POSTGRES_TEST_CONTAINER;
function sql(query: string): string {
  return execFileSync(
    'docker',
    [
      'exec',
      container!,
      'psql',
      '-U',
      'postgres',
      '-d',
      'sixnations',
      '-v',
      'ON_ERROR_STOP=1',
      '-Atc',
      query,
    ],
    { encoding: 'utf8' },
  ).trim();
}
function rpc<T>(name: string, input: unknown): Promise<RpcResult<T>> {
  const literal = JSON.stringify(input).replaceAll("'", "''");
  return Promise.resolve(
    JSON.parse(
      sql(`set role service_role;select public.${name}('${literal}'::jsonb);`).split('\n').at(-1)!,
    ) as RpcResult<T>,
  );
}
describe.skipIf(!container)('worker with actual PostgreSQL leases', () => {
  it('recovers an expired claim and refuses stale completion, then finishes exactly once', async () => {
    const id = randomUUID();
    const key = `worker-integration:${id}`;
    sql(
      `insert into public.scheduled_jobs(id,kind,payload,due_at,max_attempts,dedupe_key) values('${id}','score_round','{}',clock_timestamp()-interval '1 day',3,'${key}')`,
    );
    try {
      const first = unwrap(
        await rpc<ScheduledJob[]>('worker_claim_jobs', {
          workerId: 'dead-worker',
          limit: 1,
          leaseSeconds: 60,
        }),
      )[0]!;
      expect(first.id).toBe(id);
      sql(
        `update public.scheduled_jobs set lease_expires_at=clock_timestamp()-interval '1 second' where id='${id}'`,
      );
      const db = {
        claimJobs: (i: unknown) => rpc('worker_claim_jobs', i),
        heartbeatJob: (i: unknown) => rpc('worker_heartbeat_job', i),
        finishJob: (i: unknown) => rpc('worker_finish_job', i),
        retryJob: (i: unknown) => rpc('worker_retry_job', i),
      } as WorkerRepository;
      let executed = 0;
      const worker = new DurableWorker(
        db,
        async () => {
          executed++;
          return { verified: true };
        },
        { workerId: 'replacement', leaseSeconds: 60, batchSize: 1 },
      );
      await worker.tick();
      expect(executed).toBe(1);
      const stale = await rpc('worker_finish_job', {
        jobId: id,
        leaseToken: first.leaseToken,
        workerId: 'dead-worker',
        result: { wrong: true },
      });
      expect(stale.error?.code).toBe('LEASE_LOST');
      expect(sql(`select status||':'||attempts from public.scheduled_jobs where id='${id}'`)).toBe(
        'finished:2',
      );
      await worker.tick();
      expect(executed).toBe(1);
    } finally {
      sql(`delete from public.scheduled_jobs where id='${id}'`);
    }
  });
  it('exhausts bounded attempts durably without another eligible claim', async () => {
    const id = randomUUID();
    sql(
      `insert into public.scheduled_jobs(id,kind,due_at,max_attempts,dedupe_key) values('${id}','score_round',clock_timestamp()-interval '1 day',1,'worker-integration:${id}')`,
    );
    try {
      const claim = unwrap(
        await rpc<ScheduledJob[]>('worker_claim_jobs', {
          workerId: 'bounded',
          limit: 1,
          leaseSeconds: 60,
        }),
      )[0]!;
      expect(claim.id).toBe(id);
      expect(
        unwrap(
          await rpc<{ scheduled: boolean }>('worker_retry_job', {
            jobId: id,
            leaseToken: claim.leaseToken,
            workerId: 'bounded',
            error: { code: 'DEPENDENCY_UNAVAILABLE', message: 'synthetic' },
            retryAt: new Date(0).toISOString(),
          }),
        ).scheduled,
      ).toBe(false);
      expect(sql(`select status from public.scheduled_jobs where id='${id}'`)).toBe('failed');
      expect(
        unwrap(
          await rpc<ScheduledJob[]>('worker_claim_jobs', {
            workerId: 'bounded',
            limit: 1,
            leaseSeconds: 60,
          }),
        ).some((job) => job.id === id),
      ).toBe(false);
    } finally {
      sql(`delete from public.scheduled_jobs where id='${id}'`);
    }
  });
});
