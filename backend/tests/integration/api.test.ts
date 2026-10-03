import { describe, it, expect } from 'vitest';
import { buildApp } from '../../src/api/app.js';
import type { UserRepository } from '../../src/repositories/index.js';
import { readDefinitions, commandDefinitions, type Schema } from '../../src/api/schemas.js';
import { METRICS } from '../../src/contracts/types.js';
const id = '00000000-0000-4000-8000-000000000001';
function options(repo: UserRepository) {
  return {
    authenticate: async () => ({
      data: { id, aal: 'aal1', authenticatedAt: 1, accessToken: 'validated' },
    }),
    repository: () => repo,
  };
}
function sample(schema: Schema): unknown {
  if (Array.isArray(schema.enum)) return schema.enum[0];
  if (Array.isArray(schema.anyOf)) return sample(schema.anyOf[0] as Schema);
  if (schema.type === 'object') {
    const properties = schema.properties as Record<string, Schema>;
    return Object.fromEntries(
      ((schema.required ?? []) as string[]).map((key) => [key, sample(properties[key]!)]),
    );
  }
  if (schema.type === 'array')
    return Array.from({ length: Number(schema.minItems ?? 0) }, () =>
      sample(schema.items as Schema),
    );
  if (schema.type === 'integer') return schema.minimum ?? 0;
  if (schema.type === 'boolean') return true;
  if (schema.format === 'uuid') return id;
  if (schema.format === 'date-time') return '2027-01-01T00:00:00Z';
  if (schema.pattern === '^[A-Z0-9]{6}$') return 'ABC123';
  if (schema.type === 'null') return null;
  return 'valid';
}
describe('API boundary', () => {
  it('never creates user repositories for rejected tokens', async () => {
    let opened = false;
    const app = await buildApp({
      authenticate: async () => ({ error: { code: 'UNAUTHENTICATED', message: 'Invalid token' } }),
      repository: () => {
        opened = true;
        throw new Error('unreachable');
      },
    });
    expect(
      (await app.inject({ url: '/v1/seasons', headers: { authorization: 'Bearer forged' } }))
        .statusCode,
    ).toBe(401);
    expect(opened).toBe(false);
    await app.close();
  });
  it('requires validated authentication and bounds pagination', async () => {
    let calls = 0;
    const app = await buildApp(
      options({
        read: async () => {
          calls++;
          return { data: [] as never };
        },
        command: async () => ({ data: {} as never }),
      }),
    );
    expect((await app.inject('/v1/seasons')).statusCode).toBe(401);
    expect(
      (
        await app.inject({
          url: `/v1/players?seasonId=${id}&limit=101`,
          headers: { authorization: 'Bearer token' },
        })
      ).statusCode,
    ).toBe(400);
    expect(calls).toBe(0);
    await app.close();
  });
  it('dispatches only validated complete commands and preserves stable conflicts', async () => {
    let calls = 0;
    const app = await buildApp(
      options({
        read: async () => ({ data: [] as never }),
        command: async () => {
          calls++;
          return { error: { code: 'ROUND_LOCKED', message: 'Round is locked' } };
        },
      }),
    );
    const response = await app.inject({
      method: 'POST',
      url: '/v1/enter-season',
      headers: { authorization: 'Bearer token' },
      payload: { requestId: id, seasonId: id },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('ROUND_LOCKED');
    expect(calls).toBe(1);
    const invalid = await app.inject({
      method: 'POST',
      url: '/v1/enter-season',
      headers: { authorization: 'Bearer token' },
      payload: { requestId: id, seasonId: id, privileged: true },
    });
    expect(invalid.statusCode).toBe(400);
    expect(calls).toBe(1);
    await app.close();
  });
  it('generates all operation schemas without credentials and sanitizes failures', async () => {
    const app = await buildApp(
      options({
        read: async () => {
          throw new Error('secret');
        },
        command: async () => ({ data: {} as never }),
      }),
    );
    await app.ready();
    expect(Object.keys(app.swagger().paths ?? {})).toHaveLength(38);
    const response = await app.inject({
      url: '/v1/seasons',
      headers: { authorization: 'Bearer token' },
    });
    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain('secret');
    await app.close();
  });
  it('restricts browser preflights to configured origins and reports failed readiness', async () => {
    const app = await buildApp({ corsOrigins: ['https://game.example'], ready: async () => false });
    const allowed = await app.inject({
      method: 'OPTIONS',
      url: '/v1/seasons',
      headers: { origin: 'https://game.example' },
    });
    expect(allowed.statusCode).toBe(204);
    expect(allowed.headers['access-control-allow-origin']).toBe('https://game.example');
    const denied = await app.inject({
      method: 'OPTIONS',
      url: '/v1/seasons',
      headers: { origin: 'https://other.example' },
    });
    expect(denied.statusCode).toBe(403);
    expect((await app.inject('/health/ready')).statusCode).toBe(503);
    await app.close();
  });
  it('rejects malformed requests for every public operation before persistence', async () => {
    let calls = 0;
    const app = await buildApp(
      options({
        read: async () => {
          calls++;
          return { data: [] as never };
        },
        command: async () => {
          calls++;
          return { data: {} as never };
        },
      }),
    );
    for (const operation of Object.keys(readDefinitions)) {
      const response = await app.inject({
        url: `/v1/${operation.replaceAll('_', '-')}?unknown=invalid`,
        headers: { authorization: 'Bearer token' },
      });
      expect(response.statusCode, operation).toBe(400);
      expect(response.json().error.code).toBe('VALIDATION_ERROR');
    }
    for (const operation of Object.keys(commandDefinitions)) {
      const response = await app.inject({
        method: 'POST',
        url: `/v1/${operation.replaceAll('_', '-')}`,
        headers: { authorization: 'Bearer token' },
        payload: { requestId: 'invalid' },
      });
      expect(response.statusCode, operation).toBe(400);
      expect(response.json().error.code).toBe('VALIDATION_ERROR');
    }
    expect(calls).toBe(0);
    await app.close();
  });
  it('reports semantic oversized bodies with a stable validation envelope', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/preview-import',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ content: 'x'.repeat(600001) }),
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
    await app.close();
  });
  it('preserves repository authorization errors for all 36 valid operations', async () => {
    let calls = 0;
    const deny = async () => {
      calls++;
      return { error: { code: 'FORBIDDEN' as const, message: 'Denied by database' } };
    };
    const app = await buildApp(options({ read: deny, command: deny }));
    for (const [operation, definition] of Object.entries(readDefinitions)) {
      const query = new URLSearchParams(sample(definition.query) as Record<string, string>);
      const response = await app.inject({
        url: `/v1/${operation.replaceAll('_', '-')}?${query}`,
        headers: { authorization: 'Bearer token' },
      });
      expect(response.statusCode, operation).toBe(403);
      expect(response.json().error.code).toBe('FORBIDDEN');
    }
    for (const [operation, schema] of Object.entries(commandDefinitions)) {
      const payload = sample(schema) as Record<string, unknown>;
      if (operation === 'preview_import')
        payload.content = JSON.stringify({
          source: 'manual',
          sourceRevision: '1',
          fixtureId: id,
          observedAt: '2027-01-01T00:00:00Z',
          statistics: [
            {
              fixtureId: id,
              playerId: id,
              position: 'prop',
              participated: true,
              started: true,
              metrics: Object.fromEntries(METRICS.map((metric) => [metric, '0'])),
            },
          ],
          provenance: {},
        });
      const response = await app.inject({
        method: 'POST',
        url: `/v1/${operation.replaceAll('_', '-')}`,
        headers: { authorization: 'Bearer token' },
        payload,
      });
      expect(response.statusCode, operation).toBe(403);
      expect(response.json().error.code).toBe('FORBIDDEN');
    }
    expect(calls).toBe(38);
    await app.close();
  });
});
