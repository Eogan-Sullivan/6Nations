export type MockFixture = { title: string; meta: string; status: string };
export type MockLeague = { title: string; meta: string; rank: string };
export type MockStat = { title: string; meta: string };

export const mockFixtures: MockFixture[] = [
  { title: 'Ireland v Wales', meta: 'Saturday · 14:15 · Synthetic preview', status: 'HALFTIME UPDATE' },
  { title: 'France v England', meta: 'Saturday · 16:45 · Synthetic preview', status: 'SUNDAY UPDATE' },
  { title: 'Scotland v Italy', meta: 'Sunday · 15:00 · Synthetic preview', status: 'PENDING' },
];

export const mockLeagues: MockLeague[] = [
  { title: 'Office League', meta: '12 managers · Invite only', rank: 'Rank —' },
  { title: 'Friends League', meta: 'Private · Round 01 points pending', rank: 'OPEN' },
];

export const mockStats: MockStat[] = [
  { title: 'Player statistics', meta: 'Published metrics and fantasy points' },
  { title: 'Fixtures', meta: 'Full tournament calendar and postponed-round context' },
  { title: 'Publication status', meta: 'Round 01 · Synthetic · Incomplete' },
];
