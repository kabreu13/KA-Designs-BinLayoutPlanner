import './coverage';
import { test, expect } from '@playwright/test';
import { ensureCatalogExpanded, expectStoredPlacementsCount, getStoredPlacements } from './helpers';

const FIRST_BIN = '[data-testid="bin-card"]';
const PLACED = '[data-testid="placed-bin"]';

test('adding a bin shows it on the canvas', async ({ page }) => {
  await page.goto('/');
  await ensureCatalogExpanded(page);

  const bin = page.locator(FIRST_BIN).first();
  await bin.waitFor({ state: 'visible' });
  await bin.click();

  await expect(page.locator(PLACED).first()).toBeVisible({ timeout: 5000 });
  await expect(page.getByText('Drag bins here')).not.toBeVisible({ timeout: 2000 });
  await expectStoredPlacementsCount(page, 1);

  const placements = await getStoredPlacements(page);
  expect(placements.length).toBeGreaterThan(0);
});
