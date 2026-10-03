import { FORMATION, NATIONS, POSITIONS, emptyDraft, type Draft, type Player } from './model';

const firstNames = ['Finn', 'Louis', 'Oliver', 'Callum', 'Dylan', 'Matteo'];
const surnames = ['Byrne', 'Moreau', 'Bennett', 'Fraser', 'Morgan', 'Rossi'];
export const demoPlayers: Player[] = POSITIONS.flatMap((position, p) =>
  NATIONS.map((nation, n) => ({
    id: `demo-${p}-${n}`,
    name: `${firstNames[n]} ${surnames[(n + p) % surnames.length]}`,
    nation,
    position,
    priceTenths: 43 + ((p * 7 + n * 3) % 25),
    number: p * 6 + n + 1,
    description: `A synthetic ${position.toLowerCase()} in our demo player pool. Fixed position and price for this sample season.`,
    fantasyPoints: 18 + ((p * 11 + n * 7) % 46),
    form: 5.8 + ((p * 3 + n) % 19) / 10,
    appearances: 2 + ((p + n) % 4),
  })),
);
// Premium alternatives let users explore invalid budgets and nation quotas.
demoPlayers.push(
  ...POSITIONS.flatMap((position, p) =>
    NATIONS.map((nation, n) => ({
      id: `demo-premium-${p}-${n}`,
      name: `${['Rory', 'Hugo', 'Theo', 'Angus', 'Rhys', 'Luca'][n]} ${surnames[(n + p + 2) % surnames.length]}`,
      nation,
      position,
      priceTenths: 80 + ((p + n) % 20),
      number: 49 + p * 6 + n,
      description: `A premium-priced synthetic ${position.toLowerCase()}. Explore how this player affects your budget and nation limit.`,
      fantasyPoints: 34 + ((p * 13 + n * 5) % 61),
      form: 7.1 + ((p * 2 + n) % 19) / 10,
      appearances: 3 + ((p + n) % 3),
    })),
  ),
);

export function exampleDraft(): Draft {
  const draft = emptyDraft();
  const counts = new Map<string, number>();
  FORMATION.forEach((position, index) => {
    const player = demoPlayers.find(
      (p) =>
        p.position === position &&
        p.priceTenths < 70 &&
        !draft.slots.includes(p.id) &&
        (counts.get(p.nation) ?? 0) < 3,
    );
    if (!player) throw new Error('Demo pool cannot fill formation');
    draft.slots[index] = player.id;
    counts.set(player.nation, (counts.get(player.nation) ?? 0) + 1);
  });
  ['Prop', 'Back row', 'Outside back'].forEach((position, i) => {
    const player = demoPlayers.find(
      (p) =>
        p.position === position &&
        p.priceTenths < 70 &&
        !draft.slots.includes(p.id) &&
        (counts.get(p.nation) ?? 0) < 4,
    );
    if (!player) throw new Error('Demo pool cannot fill reserves');
    draft.slots[15 + i] = player.id;
    counts.set(player.nation, (counts.get(player.nation) ?? 0) + 1);
  });
  draft.captainId = draft.slots[9] ?? null;
  draft.viceCaptainId = draft.slots[7] ?? null;
  return draft;
}
