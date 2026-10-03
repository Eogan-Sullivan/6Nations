import { describe, it, expect } from 'vitest';
import {
  halftimeOpportunities,
  sundayReconciliation,
  recoveryMorning,
  publicationEligibleAt,
} from '../../src/jobs/scheduling/calendar.js';
import { parseXml, mapPlayerStatistics } from '../../src/integrations/six-nations/xml.js';
import { authorizedGet, requireEntitlement } from '../../src/integrations/http.js';

describe('durable scheduling policy', () => {
  it('uses exactly three elapsed-time halftime opportunities', () => {
    expect(halftimeOpportunities('2027-02-06T14:00:00Z')).toEqual([
      '2027-02-06T14:45:00Z',
      '2027-02-06T14:50:00Z',
      '2027-02-06T14:55:00Z',
    ]);
  });
  it('preserves Dublin civil time across spring and autumn DST', () => {
    expect(sundayReconciliation('2027-03-28')).toBe('2027-03-28T19:00:00Z');
    expect(recoveryMorning('2027-03-28T19:00:00Z')).toBe('2027-03-29T08:00:00Z');
    expect(sundayReconciliation('2027-10-31')).toBe('2027-10-31T20:00:00Z');
    expect(recoveryMorning('2027-10-31T20:00:00Z')).toBe('2027-11-01T09:00:00Z');
  });
  it('late Sunday full time still requires the complete verification window', () => {
    expect(publicationEligibleAt('2027-02-07T23:15:00Z')).toBe('2027-02-08T01:15:00Z');
  });
});
describe('provider safety and unknown values', () => {
  it('rejects external entities and DTDs before parsing', () => {
    expect(() =>
      parseXml('<!DOCTYPE r [<!ENTITY x SYSTEM "file:///etc/passwd">]><r>&x;</r>'),
    ).toThrow();
    expect(parseXml('<r><value>0</value></r>')).toEqual({ r: { value: '0' } });
  });
  it('does not convert missing values or team statistics to individual zero', () => {
    const rows = mapPlayerStatistics(
      'f',
      [
        {
          providerPlayerId: 'p',
          scope: 'player',
          participated: true,
          started: true,
          values: { t: '0' },
        },
      ],
      { p: { playerId: 'i', position: 'prop' } },
      { t: 'tries' },
    );
    expect(rows[0]?.metrics.tries).toBe('0');
    expect(rows[0]?.metrics.tackles).toBeNull();
  });
  it('does not call HTTP when quota reservation fails', async () => {
    let called = false;
    await expect(
      authorizedGet(
        new URL('https://example.com'),
        {},
        { reserve: async () => false },
        'key',
        async () => {
          called = true;
          return { status: 200, body: 'ok' };
        },
      ),
    ).rejects.toThrow();
    expect(called).toBe(false);
  });
  it('rejects unapproved entitlement despite an enabled flag', () => {
    expect(() =>
      requireEntitlement(
        {
          enabled: true,
          evidenceReference: '',
          currentSeason: '2027',
          monthlyCostCents: 0,
          storageAllowed: true,
          displayAllowed: true,
          derivedScoringAllowed: true,
        },
        '2027',
        0,
      ),
    ).toThrow();
  });
});
