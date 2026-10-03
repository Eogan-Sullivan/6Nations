import { createClient } from '@supabase/supabase-js';
import { loadConfig } from '../config/index.js';
import { buildApp } from '../api/app.js';
const config = loadConfig();
const app = await buildApp({
  config: { ...config, supabaseServiceRoleKey: '' },
  corsOrigins: config.corsOrigins,
  logger: true,
  logLevel: config.logLevel,
  ready: async () => {
    const client = createClient(config.supabaseUrl, config.supabasePublishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client.rpc('health_check');
    return !error && data?.ready === true;
  },
});
let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  await app.close();
}
process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());
await app.listen({ host: config.host, port: config.port });
