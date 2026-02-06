import './coverage';
import { test, expect } from '@playwright/test';

test('suggest layout resolves overlapping placements', async ({ page }) => {
  const layout = {
    drawerWidth: 4,
    drawerLength: 4,
    placements: [
      { id: 'p1', binId: 'bin-2x2', x: 0, y: 0 },
      { id: 'p2', binId: 'bin-2x2', x: 0, y: 0 }
    ],
    usage: { 'bin-2x2': 2 }
  };

  await page.addInitScript((state) => {
    localStorage.setItem('bin-layout-state', JSON.stringify(state));
  }, layout);

  await page.goto('/');

  await expect(page.getByTestId('placed-bin')).toHaveCount(2);
  const initialPlacements = await page.evaluate(() => {
    const raw = localStorage.getItem('bin-layout-state');
    return raw ? (JSON.parse(raw).placements ?? []) : [];
  });
  expect(initialPlacements.length).toBe(2);
  const initialUnique = new Set(initialPlacements.map((p: { x: number; y: number }) => `${p.x},${p.y}`));
  expect(initialUnique.size).toBe(1);

  const suggestButton = page.getByTestId('suggest-layout-button');
  await expect(suggestButton).toBeEnabled();
  await suggestButton.click({ force: true });

  await expect
    .poll(async () => {
      const placements = await page.evaluate(() => {
        const raw = localStorage.getItem('bin-layout-state');
        return raw ? (JSON.parse(raw).placements ?? []) : [];
      });
      const unique = new Set(placements.map((p: { x: number; y: number }) => `${p.x},${p.y}`));
      return unique.size;
    })
    .toBe(2);
  await expect(page.getByText('Bins packed together.')).toBeVisible();

  await suggestButton.click({ force: true });
  await expect(page.getByText(/Random layout/)).toBeVisible();
});
