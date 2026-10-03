import { expect, test } from '@playwright/test';
import { demoPlayers, exampleDraft } from '../../src/features/squad/demo';

let consoleErrors: string[];
test.beforeEach(async ({ page }) => {
  consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Your squad. Your call.' })).toBeVisible();
});

test.afterEach(() => {
  expect(consoleErrors).toEqual([]);
});

test('renders the current-screen tactical shell without introducing page overflow', async ({ page }) => {
  for (const viewport of [
    { width: 320, height: 800 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(page.getByText('MY SQUAD', { exact: true })).toBeVisible();
    await expect(page.getByText('MATCHES', { exact: true })).toBeVisible();
    await expect(page.getByText('LEAGUES', { exact: true })).toBeVisible();
    await expect(page.getByText('STATS', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
      true,
    );
  }
});

test('build a legal squad manually, confirm locally and restore it after reload', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const draft = exampleDraft();
  for (const [index, id] of draft.slots.entries()) {
    const p = demoPlayers.find((p) => p.id === id)!;
    if (index >= 15)
      await page
        .getByRole('button', { name: `Filter position: ${p.position}`, exact: true })
        .click();
    await page
      .getByRole('button', { name: `Select ${p.name}, ${p.position}, ${p.nation}`, exact: true })
      .click();
  }
  await expect(page.getByTestId('squad-count')).toHaveText('18 / 18');
  await page.getByRole('button', { name: /^Edit 10 · Fly-half:/ }).click();
  const captain = demoPlayers.find((p) => p.id === draft.captainId)!;
  await page.getByRole('button', { name: `Make ${captain.name} captain`, exact: true }).click();
  await page.getByRole('button', { name: /^Edit 8 · Back row:/ }).click();
  const vice = demoPlayers.find((p) => p.id === draft.viceCaptainId)!;
  await page.getByRole('button', { name: `Make ${vice.name} vice-captain`, exact: true }).click();
  await page.getByRole('button', { name: 'Review squad', exact: true }).click();
  await expect(page.getByText('All squad checks passed.')).toBeVisible();
  await page.getByRole('button', { name: 'Confirm demo squad', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your demo squad is ready.' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to squad', exact: true }).click();
  await expect(page.getByText('Saved on this device', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('squad-count')).toHaveText('18 / 18');
  await expect(
    page.getByText('Demo squad confirmed on this device.', { exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  await page.getByRole('heading', { name: 'Your squad. Your call.' }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/squad-desktop.png', fullPage: true });
});

test('invalid draft cannot be confirmed; removing a captain clears the role', async ({ page }) => {
  await page.getByRole('button', { name: 'Review squad', exact: true }).click();
  await expect(page.getByText('Fill all 18 slots (0/18 selected).')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Confirm demo squad', exact: true }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Continue editing', exact: true }).click();
  await page.getByRole('button', { name: 'Load example squad', exact: true }).click();
  await page.getByRole('button', { name: /^Edit 10 · Fly-half:/ }).click();
  const captain = demoPlayers.find((p) => p.id === exampleDraft().captainId)!;
  await page.getByRole('button', { name: `Remove ${captain.name}`, exact: true }).click();
  await expect(page.getByText('Choose your captain', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Review squad', exact: true }).click();
  await expect(page.getByText('Choose a captain from your starters.')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Confirm demo squad', exact: true }),
  ).toBeDisabled();
});

test('search, empty state, details and ordered reserves work on narrow web', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Load example squad', exact: true }).click();
  const before = await page
    .getByRole('button', { name: /^Edit Reserve 1:/ })
    .getAttribute('aria-label');
  const second = await page
    .getByRole('button', { name: /^Edit Reserve 2:/ })
    .getAttribute('aria-label');
  await page.getByRole('button', { name: 'Move reserve 2 earlier', exact: true }).click();
  const after = await page
    .getByRole('button', { name: /^Edit Reserve 1:/ })
    .getAttribute('aria-label');
  expect(after?.split(': ')[1]).toBe(second?.split(': ')[1]);
  expect(after).not.toBe(before);
  await page.getByRole('button', { name: 'List', exact: true }).click();
  await page.getByRole('button', { name: /^Edit 1 · Prop:/ }).click();
  await page.getByRole('textbox', { name: 'Search players' }).fill('nobody-matches');
  await expect(page.getByText('No players found', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await page.getByRole('button', { name: 'Filter nation: Italy', exact: true }).click();
  const player = demoPlayers.find((p) => p.position === 'Prop' && p.nation === 'Italy')!;
  await page
    .getByRole('button', {
      name: `View ${player.name}, ${player.position}, ${player.nation}`,
      exact: true,
    })
    .click();
  await expect(page.getByText('SYNTHETIC PLAYER PROFILE', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close player details', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('heading', { name: 'Your squad. Your call.' }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/squad-mobile.png', fullPage: true });
});

test('storage corruption is visible and recoverable without silent overwrite', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('6nations:squad-demo:v1', 'broken-json'));
  await page.reload();
  await expect(page.getByText(/Could not restore the local draft/)).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Load example squad', exact: true }),
  ).toBeDisabled();
  expect(await page.evaluate(() => localStorage.getItem('6nations:squad-demo:v1'))).toBe(
    'broken-json',
  );
  await page.getByRole('button', { name: 'Start a new draft', exact: true }).click();
  await page.getByRole('button', { name: 'Clear saved demo', exact: true }).click();
  await expect(page.getByText('Saved on this device', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Load example squad', exact: true }).click();
  await expect(page.getByTestId('squad-count')).toHaveText('18 / 18');
});

test('failed local writes do not claim confirmation and can be retried', async ({ page }) => {
  await page.getByRole('button', { name: 'Load example squad', exact: true }).click();
  await expect(page.getByText('Saved on this device', { exact: true })).toBeVisible();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    (window as typeof window & { restoreStorage: () => void }).restoreStorage = () => {
      Storage.prototype.setItem = original;
    };
    Storage.prototype.setItem = () => {
      throw new Error('Simulated quota error');
    };
  });
  await page.getByRole('button', { name: 'Review squad', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm demo squad', exact: true }).click();
  await expect(page.getByText(/Your changes are in memory/).last()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your demo squad is ready.' })).toHaveCount(0);
  await page.evaluate(() =>
    (window as typeof window & { restoreStorage: () => void }).restoreStorage(),
  );
  await page.getByRole('button', { name: 'Confirm demo squad', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your demo squad is ready.' })).toBeVisible();
});
