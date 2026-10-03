import { createHash } from 'node:crypto';
import {
  METRICS,
  FORMATION,
  type NormalizedObservation,
  type PlayerFixtureStatistics,
} from '../contracts/types.js';
export interface ImportPreview {
  sha256: string;
  observation: NormalizedObservation;
  missingMetrics: number;
  playerCount: number;
}
export function previewImport(text: string): ImportPreview {
  if (Buffer.byteLength(text) > 2_000_000) throw new Error('Import exceeds 2 MB');
  const value = JSON.parse(text) as NormalizedObservation;
  if (
    !value ||
    !value.source ||
    !value.sourceRevision ||
    !value.fixtureId ||
    !Number.isFinite(Date.parse(value.observedAt)) ||
    !Array.isArray(value.statistics) ||
    value.statistics.length > 100
  )
    throw new Error('Invalid observation import');
  const seen = new Set<string>();
  let missingMetrics = 0;
  for (const row of value.statistics as PlayerFixtureStatistics[]) {
    if (
      !row.playerId ||
      seen.has(row.playerId) ||
      row.fixtureId !== value.fixtureId ||
      !FORMATION.includes(row.position) ||
      ![true, false, null].includes(row.participated) ||
      ![true, false, null].includes(row.started) ||
      !row.metrics
    )
      throw new Error('Invalid player row');
    seen.add(row.playerId);
    for (const metric of METRICS) {
      const raw = row.metrics[metric];
      if (raw === null) missingMetrics++;
      else if (
        typeof raw !== 'string' ||
        raw.length > 128 ||
        !/^\d+(?:\.\d+)?$/.test(raw) ||
        (metric !== 'metresCarried' && !/^\d+$/.test(raw))
      )
        throw new Error(`Invalid metric ${metric}`);
    }
  }
  return {
    sha256: createHash('sha256').update(text).digest('hex'),
    observation: value,
    missingMetrics,
    playerCount: seen.size,
  };
}
