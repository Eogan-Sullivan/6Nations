import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { loadConfig } from '../config/index.js';
import { createWorkerRepository } from '../repositories/index.js';
import { createJobHandler } from '../jobs/handlers.js';
import { DurableWorker } from '../jobs/worker.js';
import { log } from '../observability/logger.js';
import type { SixNationsConfiguration } from '../integrations/six-nations/client.js';

const config = loadConfig();
if (!config.supabaseServiceRoleKey) throw new Error('Worker service-role credential required');
const repository = createWorkerRepository({
  ...config,
  supabaseServiceRoleKey: config.supabaseServiceRoleKey,
});
const provider =
  config.providersEnabled && process.env.SIX_NATIONS_PROVIDER_CONFIG
    ? {
        config: JSON.parse(process.env.SIX_NATIONS_PROVIDER_CONFIG) as SixNationsConfiguration,
        headers: JSON.parse(process.env.SIX_NATIONS_PROVIDER_HEADERS ?? '{}') as Record<
          string,
          string
        >,
        maxRequests: Number(process.env.SIX_NATIONS_REQUEST_LIMIT ?? 60),
      }
    : undefined;
if (
  provider &&
  (!Number.isInteger(provider.maxRequests) ||
    provider.maxRequests < 1 ||
    provider.maxRequests > 10_000)
)
  throw new Error('Invalid provider quota');
if (
  provider &&
  (!config.providerEntitlements.includes(provider.config.entitlement.evidenceReference) ||
    provider.config.combinedCostCents > config.providerMonthlyBudgetCents)
)
  throw new Error('Configured provider entitlement or combined budget is not approved');
const worker = new DurableWorker(repository, createJobHandler(repository, provider), {
  workerId: `${config.workerId}-${randomUUID()}`,
  leaseSeconds: config.workerLeaseSeconds,
  batchSize: config.workerBatchSize,
  onHeartbeat: () => writeFile('/tmp/worker-heartbeat', String(Date.now())),
});
let running = true;
for (const signal of ['SIGTERM', 'SIGINT'] as const)
  process.on(signal, () => {
    running = false;
    worker.stop();
  });
while (running) {
  try {
    await worker.tick();
  } catch {
    log('worker_poll_failed', { code: 'DEPENDENCY_UNAVAILABLE' });
  }
  if (running) await delay(config.workerPollMs);
}
log('worker_stopped');
