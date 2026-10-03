import type { JobKind, Json } from '../../contracts/types.js';
import { halftimeOpportunities, recoveryMorning, sundayReconciliation } from './calendar.js';
export interface PlannedJob {
  kind: JobKind;
  runAt: string;
  maxAttempts: number;
  idempotencyKey: string;
  payload: Json;
}
/** Persist via the admin schedule command; no in-memory timer schedules provider access. */
export function fixtureHalftimePlan(fixtureId: string, kickoff: string): PlannedJob[] {
  return halftimeOpportunities(kickoff).map((runAt, index) => ({
    kind: 'halftime',
    runAt,
    maxAttempts: 1,
    idempotencyKey: `halftime:${fixtureId}:${index + 1}`,
    payload: { fixtureId, opportunity: index + 1 },
  }));
}
export function roundReconciliationPlan(roundId: string, sundayDate: string): PlannedJob[] {
  const runAt = sundayReconciliation(sundayDate);
  return [
    {
      kind: 'reconcile',
      runAt,
      maxAttempts: 1,
      idempotencyKey: `reconcile:${roundId}`,
      payload: { roundId },
    },
    {
      kind: 'recovery',
      runAt: recoveryMorning(runAt),
      maxAttempts: 1,
      idempotencyKey: `recovery:${roundId}`,
      payload: { roundId, recoveryAttempt: 1 },
    },
  ];
}
