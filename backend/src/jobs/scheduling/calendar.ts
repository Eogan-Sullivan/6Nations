import { Temporal } from '@js-temporal/polyfill';

export const TIME_ZONE = 'Europe/Dublin';
export function halftimeOpportunities(kickoff: string): string[] {
  const start = Temporal.Instant.from(kickoff);
  return [45, 50, 55].map((minutes) => start.add({ minutes }).toString());
}
export function sundayReconciliation(date: string): string {
  const day = Temporal.PlainDate.from(date);
  if (day.dayOfWeek !== 7) throw new Error('Reconciliation date must be Sunday');
  return day.toZonedDateTime({ timeZone: TIME_ZONE, plainTime: '20:00' }).toInstant().toString();
}
export function recoveryMorning(reconciliation: string): string {
  return Temporal.Instant.from(reconciliation)
    .toZonedDateTimeISO(TIME_ZONE)
    .toPlainDate()
    .add({ days: 1 })
    .toZonedDateTime({ timeZone: TIME_ZONE, plainTime: '09:00' })
    .toInstant()
    .toString();
}
export function publicationEligibleAt(fullTime: string): string {
  return Temporal.Instant.from(fullTime).add({ minutes: 120 }).toString();
}
