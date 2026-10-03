import Fastify, { type FastifyError } from 'fastify';
import swagger from '@fastify/swagger';
import type {
  Json,
  GameError,
  RpcResult,
  ReadOperation,
  CommandOperation,
  NormalizedObservation,
  SquadView,
  Player,
  Page,
} from '../contracts/types.js';
import { projectHalftime } from '../domain/scoring/index.js';
import {
  authenticateAccessToken,
  createUserRepository,
  type RepositoryConfig,
  type UserRepository,
  type AuthenticatedUser,
} from '../repositories/index.js';
import {
  readDefinitions,
  commandDefinitions,
  commandResponse,
  errorSchema,
  object,
} from './schemas.js';
import { previewImport } from '../imports/preview.js';

export interface AppOptions {
  config?: RepositoryConfig;
  authenticate?: (token: string) => Promise<RpcResult<AuthenticatedUser>>;
  repository?: (user: AuthenticatedUser) => UserRepository;
  ready?: () => Promise<boolean>;
  corsOrigins?: readonly string[];
  logger?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error' | 'silent';
}
export function errorStatus(error: GameError): number {
  if (error.code === 'UNAUTHENTICATED') return 401;
  if (['FORBIDDEN', 'APPROVAL_REQUIRED'].includes(error.code)) return 403;
  if (error.code === 'NOT_FOUND') return 404;
  if (error.code === 'RATE_LIMITED' || error.code === 'QUOTA_EXCEEDED') return 429;
  if (error.code === 'DEPENDENCY_UNAVAILABLE' || error.code === 'PROVIDER_DISABLED') return 503;
  if (error.code === 'INTERNAL_ERROR') return 500;
  if (
    [
      'ROUND_LOCKED',
      'REVISION_CONFLICT',
      'IDEMPOTENCY_CONFLICT',
      'OWNER_TRANSFER_REQUIRED',
      'LEASE_LOST',
    ].includes(error.code)
  )
    return 409;
  return 422;
}
export async function buildApp(options: AppOptions = {}) {
  const app = Fastify({
    logger: options.logger
      ? {
          level: options.logLevel ?? 'info',
          redact: ['req.headers.authorization', 'req.body', 'res.body'],
        }
      : false,
    bodyLimit: 600_000,
    requestTimeout: 15_000,
    ajv: { customOptions: { removeAdditional: false } },
  });
  await app.register(swagger, {
    openapi: {
      info: { title: 'Six Nations Fantasy API', version: '1.0.0' },
      components: {
        securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
      },
    },
    refResolver: { buildLocalReference: (json) => String(json.$id) },
  });
  app.setErrorHandler<FastifyError>((error, request, reply) => {
    const invalid = !!error.validation || error.statusCode === 400 || error.statusCode === 413;
    return reply.code(invalid ? 400 : 500).send({
      requestId: request.id,
      error: {
        code: invalid ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR',
        message: invalid ? 'Request does not match the contract' : 'Unexpected server error',
        retryable: !invalid,
      },
    });
  });
  app.setNotFoundHandler((request, reply) =>
    reply
      .code(404)
      .send({ requestId: request.id, error: { code: 'NOT_FOUND', message: 'Route not found' } }),
  );
  app.addHook('onRequest', async (request, reply) => {
    const origin = request.headers.origin;
    if (origin && options.corsOrigins?.includes(origin)) {
      reply
        .header('Access-Control-Allow-Origin', origin)
        .header('Vary', 'Origin')
        .header('Access-Control-Allow-Headers', 'Authorization, Content-Type')
        .header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    }
    if (request.method === 'OPTIONS') {
      if (origin && !options.corsOrigins?.includes(origin))
        return reply.code(403).send({
          requestId: request.id,
          error: { code: 'FORBIDDEN', message: 'Origin is not allowed' },
        });
      return reply.code(204).send();
    }
  });
  app.get('/health/live', { schema: { hide: true } }, async () => ({ status: 'ok' }));
  app.get('/health/ready', { schema: { hide: true } }, async (_request, reply) => {
    let ready = false;
    try {
      ready = options.ready ? await options.ready() : false;
    } catch {}
    return reply.code(ready ? 200 : 503).send({ status: ready ? 'ready' : 'unavailable' });
  });
  async function repository(
    request: { headers: { authorization?: string }; id: string },
    reply: { code: (status: number) => { send: (body: unknown) => unknown } },
  ): Promise<UserRepository | null> {
    const authorization = request.headers.authorization;
    if (!authorization || !/^Bearer [^\s]+$/.test(authorization)) {
      reply.code(401).send({
        requestId: request.id,
        error: { code: 'UNAUTHENTICATED', message: 'Bearer access token required' },
      });
      return null;
    }
    if (!options.authenticate && !options.config) {
      reply.code(503).send({
        requestId: request.id,
        error: {
          code: 'DEPENDENCY_UNAVAILABLE',
          message: 'Authentication is unavailable',
          retryable: true,
        },
      });
      return null;
    }
    const token = authorization.slice(7);
    const result = await (options.authenticate
      ? options.authenticate(token)
      : authenticateAccessToken(options.config!, token));
    if (result.error) {
      reply.code(errorStatus(result.error)).send({ requestId: request.id, error: result.error });
      return null;
    }
    return options.repository
      ? options.repository(result.data)
      : createUserRepository(options.config!, token);
  }
  for (const [operation, definition] of Object.entries(readDefinitions)) {
    const requestName = `${operation}Request`;
    const responseName = `${operation}Response`;
    app.addSchema({ $id: requestName, ...definition.query });
    app.addSchema({
      $id: responseName,
      ...object({ requestId: { type: 'string' }, data: definition.data }),
    });
    app.get(
      `/v1/${operation.replaceAll('_', '-')}`,
      {
        schema: {
          operationId: operation,
          security: [{ bearerAuth: [] }],
          querystring: { $ref: requestName + '#' },
          response: { 200: { $ref: responseName + '#' }, '4xx': errorSchema, '5xx': errorSchema },
        },
      },
      async (request, reply) => {
        const repo = await repository(request, reply);
        if (!repo) return;
        const result = await repo.read(operation as ReadOperation, request.query as Json);
        if (operation === 'match' && !result.error) {
          const data = result.data as Record<string, unknown>;
          data.provisionalTotals = null;
          const snapshot = data.snapshot as NormalizedObservation | null;
          if (snapshot && typeof data.roundId === 'string' && typeof data.seasonId === 'string') {
            const squad = await repo.read<SquadView>('squad', { roundId: data.roundId });
            if (!squad.error && squad.data.selection) {
              const catalog: Player[] = [];
              let cursor: string | null = null;
              const visited = new Set<string>();
              do {
                const query: Record<string, Json> = { seasonId: data.seasonId, limit: 100 };
                if (cursor) query.cursor = cursor;
                const page: RpcResult<Page<Player>> = await repo.read<Page<Player>>(
                  'players',
                  query,
                );
                if (page.error) {
                  catalog.length = 0;
                  break;
                }
                catalog.push(...page.data.items);
                cursor = page.data.nextCursor;
                if (cursor && visited.has(cursor)) {
                  catalog.length = 0;
                  break;
                }
                if (cursor) visited.add(cursor);
              } while (cursor && catalog.length < 10000);
              const positions = new Map(catalog.map((player) => [player.id, player.position]));
              if (
                snapshot.statistics.every((stat) => positions.has(stat.playerId)) &&
                catalog.length
              ) {
                const statistics = snapshot.statistics.map((stat) => ({
                  ...stat,
                  position: positions.get(stat.playerId)!,
                }));
                data.provisionalTotals = {
                  ...projectHalftime(squad.data.selection, statistics),
                  scope: 'fixture',
                };
              }
            }
          }
        }
        return reply
          .code(result.error ? errorStatus(result.error) : 200)
          .send({ ...result, requestId: request.id });
      },
    );
  }
  for (const [operation, body] of Object.entries(commandDefinitions)) {
    const requestName = `${operation}Request`;
    const responseName = `${operation}Response`;
    app.addSchema({ $id: requestName, ...body });
    app.addSchema({
      $id: responseName,
      ...object({ requestId: { type: 'string' }, data: commandResponse(operation) }),
    });
    app.post(
      `/v1/${operation.replaceAll('_', '-')}`,
      {
        schema: {
          operationId: operation,
          security: [{ bearerAuth: [] }],
          body: { $ref: requestName + '#' },
          response: { 200: { $ref: responseName + '#' }, '4xx': errorSchema, '5xx': errorSchema },
        },
      },
      async (request, reply) => {
        const repo = await repository(request, reply);
        if (!repo) return;
        let input = request.body as Record<string, Json>;
        if (operation === 'preview_import') {
          try {
            const preview = previewImport(String(input.content));
            input = {
              requestId: input.requestId!,
              seasonId: input.seasonId!,
              reason: input.reason!,
              observation: preview.observation as unknown as Json,
              sha256: preview.sha256,
            };
          } catch {
            return reply.code(422).send({
              requestId: request.id,
              error: { code: 'VALIDATION_ERROR', message: 'Invalid normalized JSON import' },
            });
          }
        }
        const result = await repo.command(operation as CommandOperation, input);
        return reply
          .code(result.error ? errorStatus(result.error) : 200)
          .send({ ...result, requestId: request.id });
      },
    );
  }
  return app;
}
