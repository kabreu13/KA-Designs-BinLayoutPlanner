import './coverage';
import { test, expect } from '@playwright/test';
import { ensureCatalogExpanded } from './helpers';

const BIN_CARD = '[data-testid="bin-card"]';
const PLACED = '[data-testid="placed-bin"]';

const getPlacements = async (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const raw = localStorage.getItem('bin-layout-state');
    return raw ? (JSON.parse(raw).placements ?? []) : [];
  });

test('undo and redo update placements', async ({ page }) => {
  await page.goto('/');
  await ensureCatalogExpanded(page);

  const binCard = page.locator(BIN_CARD).first();
  await binCard.waitFor({ state: 'visible' });
  await binCard.click();
  await binCard.click();

  await expect(page.locator(PLACED)).toHaveCount(2);
  expect((await getPlacements(page)).length).toBe(2);

  await page.getByTitle('Undo (Ctrl/Cmd+Z)').click();
  await expect(page.locator(PLACED)).toHaveCount(1);
  expect((await getPlacements(page)).length).toBe(1);

  await page.getByTitle('Redo (Shift+Ctrl/Cmd+Z)').click();
  await expect(page.locator(PLACED)).toHaveCount(2);
  expect((await getPlacements(page)).length).toBe(2);
});

test('keyboard shortcuts undo and redo', async ({ page }) => {
  await page.goto('/');
  await ensureCatalogExpanded(page);

  const binCard = page.locator(BIN_CARD).first();
  await binCard.waitFor({ state: 'visible' });
  await binCard.click();
  await binCard.click();

  await expect(page.locator(PLACED)).toHaveCount(2);

  await page.keyboard.press('Control+Z');
  await expect(page.locator(PLACED)).toHaveCount(1);

  await page.keyboard.press('Control+Shift+Z');
  await expect(page.locator(PLACED)).toHaveCount(2);
});
