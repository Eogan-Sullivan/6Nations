import { it, expect } from 'vitest';
import { fetchFixtures } from '../../src/integrations/highlightly/client.js';
const entitlement = {
  enabled: true,
  evidenceReference: 'synthetic-approved-test',
  currentSeason: '2027',
  monthlyCostCents: 0,
  storageAllowed: true,
  displayAllowed: true,
  derivedScoringAllowed: true,
};
it('completes pagination and parses unknown scores without fabricating zero', async () => {
  let calls = 0;
  const fixtures = await fetchFixtures({
    baseUrl: 'https://rugby.highlightly.net',
    leagueId: '44185',
    season: '2027',
    entitlement,
    combinedCostCents: 0,
    key: 'synthetic',
    reservation: { reserve: async () => true },
    transport: async (url) => {
      const offset = Number(url.searchParams.get('offset'));
      calls++;
      return {
        status: 200,
        body: JSON.stringify({
          data: [
            {
              id: offset + 1,
              date: '2027-02-06T14:00:00Z',
              league: { id: 44185, season: 2027 },
              state: { description: 'Finished', score: offset ? 'unknown' : '20 - 18' },
            },
          ],
          pagination: { totalCount: 2, offset, limit: 1 },
        }),
      };
    },
  });
  expect(calls).toBe(2);
  expect(fixtures[0]?.homeScore).toBe(20);
  expect(fixtures[1]?.homeScore).toBeNull();
});
it('rejects another competition and a page with no progress', async () => {
  await expect(
    fetchFixtures({
      baseUrl: 'https://rugby.highlightly.net',
      leagueId: '44185',
      season: '2027',
      entitlement,
      combinedCostCents: 0,
      key: 'synthetic',
      reservation: { reserve: async () => true },
      transport: async () => ({
        status: 200,
        body: JSON.stringify({ data: [], pagination: { totalCount: 2, offset: 0, limit: 100 } }),
      }),
    }),
  ).rejects.toThrow('Incomplete pagination');
});
