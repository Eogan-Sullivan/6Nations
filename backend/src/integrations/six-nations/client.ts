import { createHash } from 'node:crypto';
import type { Metric, NormalizedObservation, Position } from '../../contracts/types.js';
import {
  authorizedGet,
  requireEntitlement,
  ProviderError,
  type Entitlement,
  type HttpTransport,
  type RequestReservation,
} from '../http.js';
import { parseXml, mapPlayerStatistics, type SourcePlayerRow } from './xml.js';
/** The approved agreement supplies route and schema. No guessed production endpoint is embedded. */
export interface SixNationsConfiguration {
  endpointTemplate: string;
  season: string;
  entitlement: Entitlement;
  combinedCostCents: number;
  rowsPath: string[];
  fields: {
    playerId: string;
    participated: string;
    started: string;
    scope: string;
    statistics: string;
  };
  statusPath: string[];
  definitions: Record<string, Metric>;
  identities: Record<string, { playerId: string; position: Position }>;
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new ProviderError('DATA_INCOMPLETE', 'Unexpected XML schema');
  return value as Record<string, unknown>;
}
function boolean(value: unknown): boolean | null {
  if (value === true || value === 'true' || value === '1') return true;
  if (value === false || value === 'false' || value === '0') return false;
  return null;
}
export async function fetchSixNationsObservation(
  config: SixNationsConfiguration,
  fixtureId: string,
  providerFixtureId: string,
  headers: Record<string, string>,
  reservation: RequestReservation,
  transport?: HttpTransport,
): Promise<NormalizedObservation> {
  requireEntitlement(config.entitlement, config.season, config.combinedCostCents);
  if (!config.endpointTemplate.includes('{matchId}'))
    throw new ProviderError('PROVIDER_DISABLED', 'Approved match route required');
  const url = new URL(
    config.endpointTemplate.replace('{matchId}', encodeURIComponent(providerFixtureId)),
  );
  const raw = await authorizedGet(
    url,
    headers,
    reservation,
    `match:${providerFixtureId}`,
    transport,
  );
  const parsed = parseXml(raw);
  let status: unknown = parsed;
  for (const path of config.statusPath) status = object(status)[path];
  if (typeof status !== 'string') throw new ProviderError('DATA_INCOMPLETE', 'Match state missing');
  let selected: unknown = parsed;
  for (const path of config.rowsPath) selected = object(selected)[path];
  const rows = (Array.isArray(selected) ? selected : [selected]).map((value) => {
    const row = object(value);
    const fields = config.fields;
    const scope = row[fields.scope];
    if (scope !== 'player' && scope !== 'team')
      throw new ProviderError('DATA_INCOMPLETE', 'Individual/team attribution missing');
    const id = row[fields.playerId];
    if (typeof id !== 'string' || !id)
      throw new ProviderError('DATA_INCOMPLETE', 'Provider identity missing');
    const values = object(row[fields.statistics]);
    const normalized = Object.fromEntries(
      Object.entries(values).map(([key, value]) => {
        if (value !== null && typeof value !== 'string')
          throw new ProviderError('DATA_INCOMPLETE', 'Unexpected metric type');
        return [key, value === '' ? null : value];
      }),
    ) as Record<string, string | null>;
    return {
      providerPlayerId: id,
      scope,
      participated: boolean(row[fields.participated]),
      started: boolean(row[fields.started]),
      values: normalized,
    } as SourcePlayerRow;
  });
  return {
    source: 'six-nations',
    sourceRevision: createHash('sha256').update(raw).digest('hex'),
    fixtureId,
    observedAt: new Date().toISOString(),
    statistics: mapPlayerStatistics(fixtureId, rows, config.identities, config.definitions),
    provenance: {
      entitlementReference: config.entitlement.evidenceReference,
      providerFixtureId,
      season: config.season,
      matchState: status,
      label: /^half[ -]?time$/i.test(status) ? 'Halftime update' : 'Mid-match snapshot',
    },
  };
}
