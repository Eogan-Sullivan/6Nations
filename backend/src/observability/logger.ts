import type { Json } from '../contracts/types.js';
/** Callers log event codes/identifiers, never upstream bodies, keys, tokens or personal fields. */
export function log(event: string, fields: Record<string, Json> = {}): void {
  process.stdout.write(`${JSON.stringify({ at: new Date().toISOString(), event, ...fields })}\n`);
}
