import assert from 'node:assert/strict';
import { test } from 'node:test';
import { demoPlayers, exampleDraft } from '../src/features/squad/demo';
import {
  FORMATION,
  NATIONS,
  assignCaptain,
  emptyDraft,
  moveReserve,
  parseDraft,
  putPlayer,
  removePlayer,
  selectedPlayers,
  validateDraft,
} from '../src/features/squad/model';

test('demo has an affordable legal 18-player squad spanning every starter position', () => {
  const draft = exampleDraft();
  const players = selectedPlayers(draft, demoPlayers);
  assert.equal(players.length, 18);
  assert.equal(new Set(players.map((p) => p.id)).size, 18);
  assert.ok(players.reduce((sum, p) => sum + p.priceTenths, 0) <= 1000);
  for (const nation of NATIONS) assert.ok(players.filter((p) => p.nation === nation).length <= 4);
  FORMATION.forEach((position, i) => assert.equal(players[i]?.position, position));
  assert.deepEqual(validateDraft(draft, demoPlayers), []);
});

test('empty squad explains missing slots and both captaincy assignments', () => {
  assert.deepEqual(
    validateDraft(emptyDraft(), demoPlayers).map((i) => i.code),
    ['INCOMPLETE', 'CAPTAIN', 'VICE'],
  );
});

test('budget allows exactly 100.0 credits and rejects one tenth over', () => {
  const draft = exampleDraft();
  const total = selectedPlayers(draft, demoPlayers).reduce((sum, p) => sum + p.priceTenths, 0);
  const pool = demoPlayers.map((p) =>
    p.id === draft.slots[0] ? { ...p, priceTenths: p.priceTenths + 1000 - total } : p,
  );
  assert.ok(!validateDraft(draft, pool).some((i) => i.code === 'BUDGET'));
  const over = pool.map((p) =>
    p.id === draft.slots[0] ? { ...p, priceTenths: p.priceTenths + 1 } : p,
  );
  assert.equal(
    validateDraft(draft, over).find((i) => i.code === 'BUDGET')?.message,
    'Over budget by 0.1 credits. Choose a lower-priced player.',
  );
});

test('nation quota includes reserves', () => {
  const draft = exampleDraft();
  const pool = demoPlayers.map((p) => ({ ...p, nation: 'Ireland' as const }));
  assert.equal(
    validateDraft(draft, pool).find((i) => i.code === 'NATION')?.message,
    'Ireland: 18 players selected. Maximum four per nation.',
  );
});

test('formation and duplicate constraints detect malformed persisted selections', () => {
  const draft = exampleDraft();
  const malformed = { ...draft, slots: [...draft.slots] };
  malformed.slots[1] = malformed.slots[0] ?? null;
  const codes = validateDraft(malformed, demoPlayers).map((i) => i.code);
  assert.ok(codes.includes('DUPLICATE'));
  assert.ok(codes.includes('FORMATION'));
});

test('selection prevents incompatible positions and duplicates while allowing replacement', () => {
  const draft = exampleDraft();
  const hooker = demoPlayers.find((p) => p.id === draft.slots[1])!;
  assert.equal(putPlayer(draft, 0, hooker), draft);
  const reserve = demoPlayers.find((p) => p.id === draft.slots[15])!;
  assert.equal(putPlayer(draft, 0, reserve), draft);
  const replacement = demoPlayers.find(
    (p) => p.position === 'Prop' && !draft.slots.includes(p.id),
  )!;
  assert.equal(putPlayer(draft, 0, replacement).slots[0], replacement.id);
  assert.equal(draft.slots[0], exampleDraft().slots[0]);
});

test('captaincy requires starters, switches roles safely, and clears on removal/replacement', () => {
  const draft = exampleDraft();
  assert.equal(assignCaptain(draft, draft.slots[15]!, 'captain'), draft);
  const changed = assignCaptain(draft, draft.viceCaptainId!, 'captain');
  assert.equal(changed.viceCaptainId, null);
  const index = draft.slots.indexOf(draft.captainId);
  assert.equal(removePlayer(draft, index).captainId, null);
  const replacement = demoPlayers.find(
    (p) => p.position === FORMATION[index] && !draft.slots.includes(p.id),
  )!;
  assert.equal(putPlayer(draft, index, replacement).captainId, null);
  assert.ok(
    validateDraft({ ...draft, viceCaptainId: draft.captainId }, demoPlayers).some(
      (i) => i.code === 'CAPTAIN_DISTINCT',
    ),
  );
});

test('reserves reorder without changing starters, captaincy, or squad validity', () => {
  const draft = exampleDraft();
  const moved = moveReserve(draft, 16, -1);
  assert.equal(moved.slots[15], draft.slots[16]);
  assert.equal(moved.slots[16], draft.slots[15]);
  assert.deepEqual(moved.slots.slice(0, 15), draft.slots.slice(0, 15));
  assert.deepEqual(validateDraft(moved, demoPlayers), []);
  assert.equal(moveReserve(draft, 15, -1), draft);
  assert.equal(moveReserve(draft, 17, 1), draft);
});

test('restoration accepts incomplete drafts but rejects unknown players and incompatible formats', () => {
  const draft = exampleDraft();
  assert.deepEqual(parseDraft(JSON.parse(JSON.stringify(draft)), demoPlayers), draft);
  assert.deepEqual(parseDraft(emptyDraft(), demoPlayers), emptyDraft());
  assert.equal(
    parseDraft({ ...draft, slots: ['unknown', ...draft.slots.slice(1)] }, demoPlayers),
    null,
  );
  assert.equal(parseDraft({ ...draft, captainId: draft.slots[15] }, demoPlayers), null);
  assert.equal(parseDraft({ slots: [] }, demoPlayers), null);
});
