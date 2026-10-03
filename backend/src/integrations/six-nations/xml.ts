import { XMLParser, XMLValidator } from 'fast-xml-parser';
import {
  METRICS,
  type Metric,
  type PlayerFixtureStatistics,
  type Position,
} from '../../contracts/types.js';
import { ProviderError } from '../http.js';

export function parseXml(xml: string): unknown {
  if (Buffer.byteLength(xml) > 2_000_000 || /<!\s*(?:DOCTYPE|ENTITY)/i.test(xml))
    throw new ProviderError(
      'DATA_INCOMPLETE',
      'XML declarations or excessive document size rejected',
    );
  if (XMLValidator.validate(xml) !== true)
    throw new ProviderError('DATA_INCOMPLETE', 'Invalid XML');
  return new XMLParser({
    processEntities: false,
    ignoreAttributes: false,
    parseTagValue: false,
    parseAttributeValue: false,
  }).parse(xml) as unknown;
}
export interface SourcePlayerRow {
  providerPlayerId: string;
  participated: boolean | null;
  started: boolean | null;
  scope: 'player' | 'team';
  values: Record<string, string | null>;
}
export function mapPlayerStatistics(
  fixtureId: string,
  rows: SourcePlayerRow[],
  identities: Record<string, { playerId: string; position: Position }>,
  definitions: Record<string, Metric>,
): PlayerFixtureStatistics[] {
  return rows
    .filter((row) => row.scope === 'player')
    .map((row) => {
      const identity = identities[row.providerPlayerId];
      if (!identity)
        throw new ProviderError(
          'DATA_INCOMPLETE',
          'Player identity requires administrator mapping',
        );
      const metrics = Object.fromEntries(METRICS.map((metric) => [metric, null])) as Record<
        Metric,
        string | null
      >;
      for (const [key, raw] of Object.entries(row.values)) {
        const metric = definitions[key];
        if (!metric) continue;
        if (
          raw !== null &&
          (raw.length > 128 ||
            !/^\d+(?:\.\d+)?$/.test(raw) ||
            (metric !== 'metresCarried' && !/^\d+$/.test(raw)))
        )
          throw new ProviderError('DATA_INCOMPLETE', 'Invalid individual metric');
        metrics[metric] = raw;
      }
      return {
        fixtureId,
        ...identity,
        participated: row.participated,
        started: row.started,
        metrics,
      };
    });
}
