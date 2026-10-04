import { expect, test } from '@playwright/test';

test('system theme, immediate toggle, saved preference and shared screens', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue in demo mode', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'My Squad', exact: true })).toBeVisible({ timeout: 30000 });
  const root = page.locator('html');
  await expect(root).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Load example squad', exact: true }).click();
  const navigation = await page.evaluate(() => performance.getEntriesByType('navigation').length);
  await page.getByRole('button', { name: 'Switch to dark mode', exact: true }).click();
  await expect(root).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByTestId('squad-count')).toHaveText('18 / 18');
  expect(await page.evaluate(() => performance.getEntriesByType('navigation').length)).toBe(navigation);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('6nations:theme:v1'))).toBe('dark');
  await page.reload();
  await expect(root).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Switch to light mode', exact: true }).click();
  await expect(root).toHaveAttribute('data-theme', 'light');
  await page.getByRole('tab', { name: 'Match Centre', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Match Centre', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Switch to dark mode', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Switch to dark mode', exact: true }).click();
  await expect(root).toHaveAttribute('data-theme', 'dark');
  expect(errors).toEqual([]);
});

test('both themes fit desktop and mobile and retain readable pitch jerseys', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue in demo mode', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'My Squad', exact: true })).toBeVisible({ timeout: 30000 });
  await page.getByRole('button', { name: 'Load example squad', exact: true }).click();
  for (const theme of ['dark', 'light'] as const) {
    if (theme === 'light') await page.getByRole('button', { name: 'Switch to light mode', exact: true }).click();
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await expect(page.getByRole('button', { name: `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`, exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.getByRole('heading', { name: 'My Squad', exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: `test-results/theme-${theme}-${viewport.width}.png`, fullPage: true });
    }
  }
});
