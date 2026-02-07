import './coverage';
import { test, expect } from '@playwright/test';
import { dismissHowTo, ensureCatalogExpanded } from './helpers';

test('@smoke grid toggle shows/hides overlay', async ({ page }) => {
  await page.goto('/');
  await dismissHowTo(page);

  const grid = page.getByTestId('grid-overlay');
  await expect(grid).toBeVisible();

  await page.getByTitle('Toggle grid (G)').click();
  await expect(grid).toHaveCount(0);

  await page.getByTitle('Toggle grid (G)').click();
  await expect(grid).toBeVisible();
});

test('snap input updates value', async ({ page }) => {
  await page.goto('/');
  await dismissHowTo(page);

  const snapInput = page.getByLabel('Snap to grid');
  await expect(snapInput).toHaveValue('1');
  await snapInput.fill('0.5');
  await expect(snapInput).toHaveValue('0.5');
  await snapInput.fill('1.5');
  await expect(snapInput).toHaveValue('1.5');
});

test('paint mode shows persistent chip and exits from chip', async ({ page }) => {
  await page.goto('/');
  await ensureCatalogExpanded(page);
  await dismissHowTo(page);

  await page.locator('[data-testid="bin-card"]').first().click();
  await page.getByTestId('paint-mode-toggle').click();
  await expect(page.getByTestId('paint-mode-chip')).toBeVisible();

  await page.getByTestId('paint-mode-chip').click();
  await expect(page.getByTestId('paint-mode-chip')).toHaveCount(0);
});
