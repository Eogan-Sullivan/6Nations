export interface RuntimeConfig {
  nodeEnv: 'development' | 'test' | 'production';
  host: string;
  port: number;
  corsOrigins: string[];
  logLevel: 'debug' | 'info' | 'warn' | 'error' | 'silent';
  supabaseUrl: string;
  supabasePublishableKey: string;
  supabaseServiceRoleKey?: string;
  workerId: string;
  workerPollMs: number;
  workerLeaseSeconds: number;
  workerBatchSize: number;
  providersEnabled: boolean;
  providerEntitlements: string[];
  providerMonthlyBudgetCents: number;
}

function integer(value: string | undefined, fallback: number, min: number, max: number): number {
  const result = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(result) || result < min || result > max)
    throw new Error('Invalid integer configuration');
  return result;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const nodeEnv = env.NODE_ENV ?? 'development';
  if (!['development', 'test', 'production'].includes(nodeEnv)) throw new Error('Invalid NODE_ENV');
  const supabaseUrl = env.SUPABASE_URL;
  const supabasePublishableKey = env.SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabasePublishableKey)
    throw new Error('SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required');
  const parsed = new URL(supabaseUrl);
  if (parsed.username || parsed.password)
    throw new Error('Credentials must not be embedded in URLs');
  if (supabasePublishableKey.startsWith('sb_secret_'))
    throw new Error('A privileged key cannot be the publishable key');
  const legacyPayload = supabasePublishableKey.split('.')[1];
  if (legacyPayload) {
    let role: unknown;
    try {
      role = (
        JSON.parse(Buffer.from(legacyPayload, 'base64url').toString('utf8')) as { role?: unknown }
      ).role;
    } catch {
      /* Auth verifies actual tokens; this guard detects configuration mistakes. */
    }
    if (role === 'service_role') throw new Error('A privileged key cannot be the publishable key');
  }
  if (
    parsed.protocol !== 'https:' &&
    !(
      nodeEnv !== 'production' &&
      parsed.protocol === 'http:' &&
      ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)
    )
  ) {
    throw new Error('Supabase must use HTTPS outside local development');
  }
  const logLevel = env.LOG_LEVEL ?? 'info';
  if (!['debug', 'info', 'warn', 'error', 'silent'].includes(logLevel))
    throw new Error('Invalid LOG_LEVEL');
  const corsOrigins = (env.CORS_ORIGINS ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  if (corsOrigins.includes('*')) throw new Error('Use explicit CORS origins');
  for (const origin of corsOrigins) {
    if (new URL(origin).origin !== origin) throw new Error('Invalid CORS origin');
  }
  return {
    nodeEnv: nodeEnv as RuntimeConfig['nodeEnv'],
    host: env.HOST ?? '0.0.0.0',
    port: integer(env.PORT, 3000, 1, 65535),
    corsOrigins,
    logLevel: logLevel as RuntimeConfig['logLevel'],
    supabaseUrl,
    supabasePublishableKey,
    supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    workerId: env.WORKER_ID ?? `worker-${process.pid}`,
    workerPollMs: integer(env.WORKER_POLL_MS, 1000, 100, 60_000),
    workerLeaseSeconds: integer(env.WORKER_LEASE_SECONDS, 120, 10, 3600),
    workerBatchSize: integer(env.WORKER_BATCH_SIZE, 5, 1, 100),
    providersEnabled: env.PROVIDERS_ENABLED === 'true',
    providerEntitlements: (env.PROVIDER_ENTITLEMENTS ?? '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean),
    providerMonthlyBudgetCents: integer(env.PROVIDER_MONTHLY_BUDGET_CENTS, 500, 0, 500),
  };
}
