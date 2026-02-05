import './coverage';
import { test, expect } from '@playwright/test';
import { ensureCatalogExpanded, expectStoredPlacementsCount, getStoredPlacements } from './helpers';

const BIN_CARD = '[data-testid="bin-card"]';
const PLACED = '[data-testid="placed-bin"]';

test('drawer size inputs update canvas labels', async ({ page }) => {
  await page.goto('/');

  await page.getByTestId('drawer-width-input').fill('30');
  await page.getByTestId('drawer-length-input').fill('20');

  await expect(page.getByText('30" Width')).toBeVisible();
  await expect(page.getByText('20" Length')).toBeVisible();
});

test('@smoke space used bar increases with placements', async ({ page }) => {
  await page.goto('/');
  await ensureCatalogExpanded(page);

  const bar = page.locator('div.h-2 > div.h-full');
  const beforeWidth = await bar.getAttribute('style');

  const binCard = page.locator(BIN_CARD).first();
  await binCard.waitFor({ state: 'visible' });
  await binCard.click();
  await binCard.click();

  const afterWidth = await bar.getAttribute('style');
  expect(beforeWidth).not.toBe(afterWidth);
  await expect(page.getByText(/bins placed/)).toBeVisible();
});

test('status shows when bins need attention', async ({ page }) => {
  const state = {
    drawerWidth: 4,
    drawerLength: 4,
    placements: [
      { id: 'p1', binId: 'bin-2x2', x: 0, y: 0 },
      { id: 'p2', binId: 'bin-2x2', x: 0, y: 0 }
    ],
    usage: { 'bin-2x2': 2 }
  };
  await page.addInitScript((layout) => {
    localStorage.setItem('bin-layout-state', JSON.stringify(layout));
  }, state);
  await page.goto('/');
  await expect(page.getByText(/need attention/)).toBeVisible();
});

test('status shows when bins are safely placed', async ({ page }) => {
  const state = {
    drawerWidth: 6,
    drawerLength: 4,
    placements: [
      { id: 'p1', binId: 'bin-2x2', x: 0, y: 0 },
      { id: 'p2', binId: 'bin-2x2', x: 2, y: 0 }
    ],
    usage: { 'bin-2x2': 2 }
  };
  await page.addInitScript((layout) => {
    localStorage.setItem('bin-layout-state', JSON.stringify(layout));
  }, state);
  await page.goto('/');
  await expect(page.getByText('All bins safely placed.')).toBeVisible();
});

test('summary groups identical bins with a count', async ({ page }) => {
  await page.goto('/');
  await ensureCatalogExpanded(page);

  const binCard = page.locator(BIN_CARD).first();
  await binCard.waitFor({ state: 'visible' });
  await binCard.click();
  await binCard.click();

  await expect(page.getByText(/Amount: 2/)).toBeVisible();
});

test('remove bin from summary updates placements', async ({ page }) => {
  await page.goto('/');
  await ensureCatalogExpanded(page);

  const binCard = page.locator(BIN_CARD).first();
  await binCard.waitFor({ state: 'visible' });
  await binCard.click();
  await binCard.click();

  await expect(page.locator(PLACED)).toHaveCount(2);
  await expectStoredPlacementsCount(page, 2);
  const before = await getStoredPlacements(page);
  expect(before.length).toBe(2);

  const removeButton = page
    .locator('[data-testid="placed-item-group"]')
    .first()
    .getByRole('button', { name: 'Delete bin' });
  await removeButton.click({ force: true });

  await expectStoredPlacementsCount(page, 1);
  const after = await getStoredPlacements(page);
  expect(after.length).toBe(1);
});

test('export PDF downloads a file', async ({ page }) => {
  await page.goto('/');

  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('side-panel-right').getByRole('button', { name: 'Export PDF' }).click();
  const download = await downloadPromise;
  const filename = download.suggestedFilename();
  expect(filename).toBe('bin-layout.pdf');
});
