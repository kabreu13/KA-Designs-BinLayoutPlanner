import './coverage';
import { test, expect } from '@playwright/test';
import { ensureCatalogExpanded, expectStoredPlacementsCount } from './helpers';

const BIN_CARD = '[data-testid="bin-card"]';
const PLACED = '[data-testid="placed-bin"]';

test('catalog cards can be activated with keyboard', async ({ page }) => {
  await page.goto('/');
  await ensureCatalogExpanded(page);

  const card = page.locator(BIN_CARD).first();
  await card.focus();
  await page.keyboard.press('Enter');

  await expect(page.locator(PLACED)).toHaveCount(1);
  await expectStoredPlacementsCount(page, 1);
});

test('placed-item groups open editor on keyboard activation', async ({ page }) => {
  await page.goto('/');
  await ensureCatalogExpanded(page);

  const card = page.locator(BIN_CARD).first();
  await card.click();

  const groupButton = page.getByTestId('placed-item-group').first();
  await expect(groupButton).toBeVisible();
  await groupButton.focus();
  await page.keyboard.press('Enter');

  await expect(page.getByTestId('placement-editor')).toBeVisible();
});
