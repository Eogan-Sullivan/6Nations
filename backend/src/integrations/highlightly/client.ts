import {
  authorizedGet,
  requireEntitlement,
  ProviderError,
  type Entitlement,
  type HttpTransport,
  type RequestReservation,
} from '../http.js';
export interface HighlightlyFixture {
  providerId: string;
  kickoff: string;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
}
export async function fetchFixtures(options: {
  baseUrl: string;
  leagueId: string;
  season: string;
  entitlement: Entitlement;
  combinedCostCents: number;
  key: string;
  reservation: RequestReservation;
  transport?: HttpTransport;
}): Promise<HighlightlyFixture[]> {
  requireEntitlement(options.entitlement, options.season, options.combinedCostCents);
  const fixtures: HighlightlyFixture[] = [];
  const ids = new Set<string>();
  let offset = 0;
  for (let page = 0; page < 100; page++) {
    const url = new URL(
      'matches',
      options.baseUrl.endsWith('/') ? options.baseUrl : `${options.baseUrl}/`,
    );
    url.searchParams.set('leagueId', options.leagueId);
    url.searchParams.set('season', options.season);
    url.searchParams.set('offset', String(offset));
    url.searchParams.set('limit', '100');
    const headers: Record<string, string> = { 'x-rapidapi-key': options.key };
    if (url.hostname.endsWith('.p.rapidapi.com')) headers['x-rapidapi-host'] = url.hostname;
    const text = await authorizedGet(
      url,
      headers,
      options.reservation,
      `fixtures:${options.season}:${offset}`,
      options.transport,
    );
    const result = JSON.parse(text) as {
      data?: Record<string, unknown>[];
      pagination?: { totalCount?: number; limit?: number; offset?: number };
    };
    if (
      !Array.isArray(result.data) ||
      !Number.isInteger(result.pagination?.totalCount) ||
      result.pagination!.totalCount! < 0 ||
      result.pagination?.offset !== offset
    )
      throw new ProviderError('DATA_INCOMPLETE', 'Pagination metadata missing');
    for (const row of result.data) {
      const league = row.league as { id?: unknown; season?: unknown } | undefined;
      if (String(league?.id) !== options.leagueId || String(league?.season) !== options.season)
        throw new ProviderError('DATA_INCOMPLETE', 'Competition identity mismatch');
      const id = String(row.id ?? '');
      if (!id || ids.has(id))
        throw new ProviderError('DATA_INCOMPLETE', 'Duplicate or absent fixture identity');
      ids.add(id);
      const kickoff = String(row.date ?? '');
      if (!Number.isFinite(Date.parse(kickoff)))
        throw new ProviderError('DATA_INCOMPLETE', 'Fixture kickoff missing');
      const state = row.state as { description?: unknown; score?: unknown } | undefined;
      const score =
        typeof state?.score === 'string' ? /^\s*(\d+)\s*-\s*(\d+)\s*$/.exec(state.score) : null;
      fixtures.push({
        providerId: id,
        kickoff,
        status: String(state?.description ?? 'unknown'),
        homeScore: score ? Number(score[1]) : null,
        awayScore: score ? Number(score[2]) : null,
      });
    }
    offset += result.data.length;
    if (offset >= result.pagination!.totalCount!) return fixtures;
    if (!result.data.length) throw new ProviderError('DATA_INCOMPLETE', 'Incomplete pagination');
  }
  throw new ProviderError('DATA_INCOMPLETE', 'Pagination limit exceeded');
}
