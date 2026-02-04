import './coverage';
import { test, expect } from '@playwright/test';
import { ensureCatalogExpanded } from './helpers';

const FIRST_BIN = '[data-testid="bin-card"]';
const PLACED = '[data-testid="placed-bin"]';

test('adding a bin shows it on the canvas', async ({ page }) => {
  await page.goto('/');
  await ensureCatalogExpanded(page);

  const bin = page.locator(FIRST_BIN).first();
  await bin.waitFor({ state: 'visible' });
  await bin.click();

  const placements = await page.evaluate(() => {
    const raw = localStorage.getItem('bin-layout-state');
    return raw ? JSON.parse(raw).placements : [];
  });

  await expect(page.locator(PLACED).first()).toBeVisible({ timeout: 5000 });
  await expect(page.getByText('Drag bins here')).not.toBeVisible({ timeout: 2000 });
  expect(placements.length).toBeGreaterThan(0);
});
