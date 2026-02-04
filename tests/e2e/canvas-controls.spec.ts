import './coverage';
import { test, expect } from '@playwright/test';

test('grid toggle shows/hides overlay', async ({ page }) => {
  await page.goto('/');

  const grid = page.getByTestId('grid-overlay');
  await expect(grid).toBeVisible();

  await page.getByTitle('Toggle grid').click();
  await expect(grid).toHaveCount(0);

  await page.getByTitle('Toggle grid').click();
  await expect(grid).toBeVisible();
});

test('snap input updates value', async ({ page }) => {
  await page.goto('/');

  const snapInput = page.getByLabel('Snap to grid');
  await expect(snapInput).toHaveValue('1');
  await snapInput.fill('0.5');
  await expect(snapInput).toHaveValue('0.5');
  await snapInput.fill('1.5');
  await expect(snapInput).toHaveValue('1.5');
});
