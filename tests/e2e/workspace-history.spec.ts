import './coverage';
import { test, expect } from '@playwright/test';
import { ensureCatalogExpanded, expectStoredPlacementsCount, getStoredPlacements } from './helpers';

const BIN_CARD = '[data-testid="bin-card"]';
const PLACED = '[data-testid="placed-bin"]';

const triggerHistoryShortcut = async (page: import('@playwright/test').Page, action: 'undo' | 'redo') => {
  await page.evaluate((kind) => {
    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'z',
        ctrlKey: true,
        shiftKey: kind === 'redo',
        bubbles: true,
        cancelable: true
      })
    );
  }, action);
};

test('@smoke undo and redo update placements', async ({ page }) => {
  await page.goto('/');
  await ensureCatalogExpanded(page);

  const binCard = page.locator(BIN_CARD).first();
  await binCard.waitFor({ state: 'visible' });
  await binCard.click();
  await binCard.click();

  await expect(page.locator(PLACED)).toHaveCount(2);
  await expectStoredPlacementsCount(page, 2);
  expect((await getStoredPlacements(page)).length).toBe(2);

  await page.getByTitle('Undo (Ctrl/Cmd+Z)').click();
  await expect(page.locator(PLACED)).toHaveCount(1);
  await expectStoredPlacementsCount(page, 1);
  expect((await getStoredPlacements(page)).length).toBe(1);

  await page.getByTitle('Redo (Shift+Ctrl/Cmd+Z)').click();
  await expect(page.locator(PLACED)).toHaveCount(2);
  await expectStoredPlacementsCount(page, 2);
  expect((await getStoredPlacements(page)).length).toBe(2);
});

test('keyboard shortcuts undo and redo', async ({ page }) => {
  await page.goto('/');
  await ensureCatalogExpanded(page);

  const binCard = page.locator(BIN_CARD).first();
  await binCard.waitFor({ state: 'visible' });
  await binCard.click();
  await binCard.click();

  await expect(page.locator(PLACED)).toHaveCount(2);

  await triggerHistoryShortcut(page, 'undo');
  await expect(page.locator(PLACED)).toHaveCount(1);

  await triggerHistoryShortcut(page, 'redo');
  await expect(page.locator(PLACED)).toHaveCount(2);
});

test('keyboard shortcuts ignore layout title input', async ({ page }) => {
  await page.goto('/');
  await ensureCatalogExpanded(page);

  const binCard = page.locator(BIN_CARD).first();
  await binCard.waitFor({ state: 'visible' });
  await binCard.click();
  await expect(page.locator(PLACED)).toHaveCount(1);

  const titleInput = page.getByTestId('layout-title-input');
  await titleInput.click();
  await page.keyboard.type('Test Layout');
  await page.keyboard.press('Control+Z');

  await expect(page.locator(PLACED)).toHaveCount(1);
});
