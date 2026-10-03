import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import { buildApp } from '../../src/api/app.js';
import { FORMATION, METRICS, type Json, type RpcResult } from '../../src/contracts/types.js';
import type { UserRepository } from '../../src/repositories/index.js';
const container = process.env.WORKER_POSTGRES_TEST_CONTAINER;
const database = process.env.WORKER_POSTGRES_TEST_DATABASE ?? 'sixnations';
function sql(query: string) {
  return execFileSync(
    'docker',
    [
      'exec',
      container!,
      'psql',
      '-U',
      'postgres',
      '-d',
      database,
      '-v',
      'ON_ERROR_STOP=1',
      '-Atc',
      query,
    ],
    { encoding: 'utf8' },
  ).trim();
}
function literal(input: unknown) {
  return JSON.stringify(input).replaceAll("'", "''");
}
function repository(userId: string): UserRepository {
  const rpc = async <T>(name: string, operation: string, input: Json): Promise<RpcResult<T>> =>
    JSON.parse(
      sql(
        `set role authenticated;set request.jwt.claims='${literal({ sub: userId, aal: 'aal1' })}';select public.${name}('${operation}','${literal(input)}'::jsonb);`,
      )
        .split('\n')
        .at(-1)!,
    );
  return {
    read: (operation, input) => rpc('game_read', operation, input),
    command: (operation, input) => rpc('game_command', operation, input),
  };
}
describe.skipIf(!container)('API contract against actual PostgreSQL', () => {
  it('serializes reads, confirms transactionally, and preserves league squad privacy', async () => {
    const seasonId = randomUUID(),
      roundId = randomUUID(),
      fixtureId = randomUUID(),
      userId = randomUUID(),
      peerId = randomUUID();
    const players = [...FORMATION, 'prop', 'lock', 'outside_back'].map((position, index) => ({
      id: randomUUID(),
      position,
      nationId: `20000000-0000-4000-8000-${String(index % 6).padStart(12, '0')}`,
    }));
    sql(
      `insert into public.seasons(id,name,year)values('${seasonId}','API contract',${Math.floor(Math.random() * 1e8) + 10000});insert into public.rounds(id,season_id,number,deadline)values('${roundId}','${seasonId}',1,clock_timestamp()+interval '7 days');insert into public.fixtures(id,round_id,kickoff)values('${fixtureId}','${roundId}',clock_timestamp()+interval '7 days');${players.map((player) => `insert into public.players(id,season_id,nation_id,name,position,price_tenths)values('${player.id}','${seasonId}','${player.nationId}','Synthetic','${player.position}',40);`).join('')}`,
    );
    const app = await buildApp({
      authenticate: async (token) => ({
        data: {
          id: token === 'peer' ? peerId : userId,
          aal: 'aal1',
          authenticatedAt: null,
          accessToken: token,
        },
      }),
      repository: (user) => repository(user.id),
    });
    const get = async (path: string, peer = false) =>
      app.inject({ url: path, headers: { authorization: `Bearer ${peer ? 'peer' : 'owner'}` } });
    const post = async (operation: string, input: Record<string, unknown>, peer = false) =>
      app.inject({
        method: 'POST',
        url: `/v1/${operation}`,
        headers: { authorization: `Bearer ${peer ? 'peer' : 'owner'}` },
        payload: { requestId: randomUUID(), ...input },
      });
    try {
      const entered = await post('enter-season', { seasonId });
      expect(entered.statusCode).toBe(200);
      const entryId = entered.json().data.entryId;
      expect((await post('enter-season', { seasonId }, true)).statusCode).toBe(200);
      expect(
        (await get('/v1/seasons'))
          .json()
          .data.some((season: { id: string }) => season.id === seasonId),
      ).toBe(true);
      const rounds = await get(`/v1/rounds?seasonId=${seasonId}`);
      expect(rounds.statusCode).toBe(200);
      expect(rounds.json().data[0].deadline).toBeTruthy();
      const catalog = await get(`/v1/players?seasonId=${seasonId}&limit=100`);
      expect(catalog.statusCode).toBe(200);
      expect(catalog.json().data.items).toHaveLength(18);
      expect(catalog.json().data.items[0].priceTenths).toBe(40);
      const fixtures = await get(`/v1/fixtures?seasonId=${seasonId}&roundId=${roundId}`);
      expect(fixtures.statusCode).toBe(200);
      expect(fixtures.json().data.items[0].id).toBe(fixtureId);
      expect(fixtures.json().data.items[0].roundId).toBe(roundId);
      const publishedPlayer = await get(
        `/v1/player-statistics?seasonId=${seasonId}&playerId=${players[0]!.id}`,
      );
      expect(publishedPlayer.statusCode).toBe(200);
      expect(publishedPlayer.json().data.items).toEqual([]);
      const before = await get(`/v1/squad?roundId=${roundId}`);
      expect(before.statusCode).toBe(200);
      expect(before.json().data.selection).toBeNull();
      const requestId = randomUUID();
      const confirm = {
        requestId,
        roundId,
        expectedRevision: 0,
        slots: players.map((player, index) => ({ slot: index + 1, playerId: player.id })),
        captainId: players[0]!.id,
        viceCaptainId: players[1]!.id,
      };
      const confirmed = await post('confirm-squad', confirm);
      expect(confirmed.statusCode).toBe(200);
      expect(confirmed.json().data.revision).toBe(1);
      expect(confirmed.json().data.selection.slots).toHaveLength(18);
      const retried = await post('confirm-squad', confirm);
      expect(retried.json().data).toEqual(confirmed.json().data);
      expect(
        (await post('confirm-squad', { ...confirm, captainId: players[2]!.id })).json().error.code,
      ).toBe('IDEMPOTENCY_CONFLICT');
      expect(
        (await post('confirm-squad', { ...confirm, requestId: randomUUID() })).json().error.code,
      ).toBe('REVISION_CONFLICT');
      const created = await post('create-league', { seasonId, name: 'API league' });
      expect(created.statusCode).toBe(200);
      const leagueId = created.json().data.leagueId;
      const ownerLeague = await get(`/v1/league?leagueId=${leagueId}`);
      expect(ownerLeague.statusCode).toBe(200);
      const inviteCode = ownerLeague.json().data.league.inviteCode;
      expect(inviteCode).toHaveLength(6);
      expect((await post('join-league', { seasonId, inviteCode }, true)).statusCode).toBe(200);
      const peerLeague = await get(`/v1/league?leagueId=${leagueId}`, true);
      expect(peerLeague.statusCode).toBe(200);
      expect(peerLeague.json().data.league.inviteCode).toBeUndefined();
      expect(peerLeague.json().data.members).toHaveLength(2);
      expect((await get(`/v1/leagues?seasonId=${seasonId}`)).json().data.items).toHaveLength(1);
      expect((await get(`/v1/squad?roundId=${roundId}&entryId=${entryId}`, true)).statusCode).toBe(
        403,
      );
      sql(
        `do $$declare deadline_at timestamptz:=clock_timestamp()-interval '1 second';begin insert into private.deadline_authorizations(round_id,new_deadline,reason,authorized_by,consumed_at)values('${roundId}',deadline_at,'Synthetic contract test','test CTO',clock_timestamp());update public.rounds set deadline=deadline_at,locked_at=clock_timestamp() where id='${roundId}';end$$;update public.squads set locked_at=clock_timestamp() where entry_id='${entryId}'`,
      );
      const shared = await get(`/v1/squad?roundId=${roundId}&entryId=${entryId}`, true);
      expect(shared.statusCode).toBe(200);
      expect(shared.json().data.selection.slots).toHaveLength(18);
      const standings = await get(`/v1/standings?seasonId=${seasonId}&leagueId=${leagueId}`);
      expect(standings.statusCode).toBe(200);
      expect(standings.json().data.status).toBe('unpublished');
      const match = await get(`/v1/match?fixtureId=${fixtureId}`);
      expect(match.statusCode).toBe(200);
      expect(match.json().data.snapshot).toBeNull();
      expect(match.json().data.coverage.complete).toBe(false);
      const observation = {
        source: 'synthetic',
        sourceRevision: 'contract-1',
        fixtureId,
        observedAt: new Date().toISOString(),
        statistics: [
          {
            fixtureId,
            playerId: players[0]!.id,
            position: 'prop',
            participated: true,
            started: true,
            metrics: Object.fromEntries(
              METRICS.map((metric) => [metric, metric === 'metresCarried' ? '12.25' : '0']),
            ),
          },
        ],
        provenance: { synthetic: true },
      };
      sql(
        `insert into public.observations(source,source_revision,fixture_id,observed_at,payload)values('synthetic','contract-1','${fixtureId}',clock_timestamp(),'${literal(observation)}'::jsonb)`,
      );
      const observedMatch = await get(`/v1/match?fixtureId=${fixtureId}`);
      expect(observedMatch.statusCode).toBe(200);
      expect(observedMatch.json().data.snapshot.statistics[0].metrics.metresCarried).toBe('12.25');
      expect(observedMatch.json().data.snapshot.provenance.synthetic).toBe(true);
      expect(observedMatch.json().data.provisionalTotals.scope).toBe('fixture');
      expect(observedMatch.json().data.provisionalTotals.status).toBe('incomplete');
      expect(observedMatch.json().data.provisionalTotals.knownScoreHundredths).toBe(1046);
      expect(observedMatch.json().data.provisionalTotals.missingPlayers).toHaveLength(14);
      expect(observedMatch.json().data.provisionalTotals.reservesPending).toBe(true);
      expect((await get('/v1/profile')).json().data.id).toBe(userId);
      expect((await get('/v1/notifications')).json().data.items).toEqual([]);
      expect((await get('/v1/admin-state')).statusCode).toBe(403);
      expect((await post('request-delete', {})).statusCode).toBe(403);
      expect((await post('leave-league', { leagueId }, true)).statusCode).toBe(200);
      expect((await get(`/v1/squad?roundId=${roundId}&entryId=${entryId}`, true)).statusCode).toBe(
        403,
      );
    } finally {
      await app.close();
      // Immutable evidence remains until the isolated test database is destroyed.
    }
  }, 30_000);
});
