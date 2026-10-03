import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config/index.js';

const baseline = {
  SUPABASE_URL: 'https://project.example',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example',
};
describe('runtime boundaries', () => {
  it('disables providers and caps the combined budget by default', () => {
    const config = loadConfig(baseline);
    expect(config.providersEnabled).toBe(false);
    expect(config.providerMonthlyBudgetCents).toBe(500);
    expect(() => loadConfig({ ...baseline, PROVIDER_MONTHLY_BUDGET_CENTS: '501' })).toThrow();
  });
  it('rejects privileged keys in the ordinary API configuration', () => {
    expect(() =>
      loadConfig({ ...baseline, SUPABASE_PUBLISHABLE_KEY: 'sb_secret_example' }),
    ).toThrow();
    const encoded = Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url');
    expect(() =>
      loadConfig({ ...baseline, SUPABASE_PUBLISHABLE_KEY: `header.${encoded}.signature` }),
    ).toThrow();
  });
  it('permits HTTP only for local nonproduction connections', () => {
    expect(
      loadConfig({ ...baseline, SUPABASE_URL: 'http://127.0.0.1:54321' }).supabaseUrl,
    ).toContain('127.0.0.1');
    expect(() =>
      loadConfig({ ...baseline, NODE_ENV: 'production', SUPABASE_URL: 'http://127.0.0.1:54321' }),
    ).toThrow();
    expect(() =>
      loadConfig({ ...baseline, SUPABASE_URL: 'https://username:password@project.example' }),
    ).toThrow();
  });
  it('requires explicit valid web origins', () => {
    expect(() => loadConfig({ ...baseline, CORS_ORIGINS: '*' })).toThrow();
    expect(() =>
      loadConfig({ ...baseline, CORS_ORIGINS: 'https://frontend.example/path' }),
    ).toThrow();
    expect(
      loadConfig({ ...baseline, CORS_ORIGINS: 'https://frontend.example' }).corsOrigins,
    ).toEqual(['https://frontend.example']);
  });
});
