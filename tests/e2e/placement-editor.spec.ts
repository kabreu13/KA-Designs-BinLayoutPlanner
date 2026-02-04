import './coverage';
import { test, expect } from '@playwright/test';
import { ensureCatalogExpanded } from './helpers';

test('placed bin editor updates label, color, and size', async ({ page }) => {
  await page.goto('/');
  await ensureCatalogExpanded(page);

  await page.locator('[data-testid="bin-card"]').first().click();
  const placed = page.getByTestId('placed-bin').first();
  await placed.waitFor({ state: 'visible' });

  await placed.click();
  const editor = page.getByTestId('placement-editor');
  await expect(editor).toBeVisible();

  const labelInput = page.getByTestId('placement-label');
  await labelInput.fill('Spice');
  await labelInput.press('Enter');
  await expect(placed).toContainText('Spice');

  const colorInput = page.getByTestId('placement-color');
  await colorInput.selectOption('#dc2626');
  await expect(placed).toHaveCSS('background-color', 'rgb(220, 38, 38)');

  await page.getByTestId('size-width-increase').click();
  await page.getByTestId('size-length-increase').click();

  await expect.poll(async () => {
    const placements = await page.evaluate(() => {
      const raw = localStorage.getItem('bin-layout-state');
      return raw ? (JSON.parse(raw).placements ?? []) : [];
    });
    return [placements[0]?.width, placements[0]?.length];
  }).toEqual([4, 4]);
});

test('resize allows out-of-bounds bins with red border', async ({ page }) => {
  await page.goto('/');
  await ensureCatalogExpanded(page);

  await page.getByTestId('drawer-width-input').fill('4');
  await page.getByTestId('drawer-length-input').fill('4');

  await page.locator('[data-testid="bin-card"]').first().click();
  const placed = page.getByTestId('placed-bin').first();
  await placed.waitFor({ state: 'visible' });

  await placed.click();
  await page.getByTestId('size-width-increase').click();
  await page.getByTestId('size-width-increase').click();

  await expect.poll(async () => {
    const placements = await page.evaluate(() => {
      const raw = localStorage.getItem('bin-layout-state');
      return raw ? (JSON.parse(raw).placements ?? []) : [];
    });
    return placements[0]?.width;
  }).toBe(6);

  await expect(placed).toHaveCSS('border-color', 'rgb(153, 27, 27)');
});

test('resize allows overlapping bins with red borders', async ({ page }) => {
  const layout = {
    drawerWidth: 8,
    drawerLength: 4,
    placements: [
      { id: 'p1', binId: 'bin-2x2', x: 0, y: 0 },
      { id: 'p2', binId: 'bin-2x2', x: 4, y: 0 }
    ],
    usage: { 'bin-2x2': 2 }
  };

  await page.addInitScript((state) => {
    localStorage.setItem('bin-layout-state', JSON.stringify(state));
  }, layout);

  await page.goto('/');

  const placed = page.getByTestId('placed-bin');
  await expect(placed).toHaveCount(2);

  await placed.first().click();
  await page.getByTestId('size-width-increase').click();
  await page.getByTestId('size-width-increase').click();

  await expect.poll(async () => {
    const placements = await page.evaluate(() => {
      const raw = localStorage.getItem('bin-layout-state');
      return raw ? (JSON.parse(raw).placements ?? []) : [];
    });
    const resized = placements.find((p: { id: string }) => p.id === 'p1');
    return resized?.width;
  }).toBe(6);

  await expect(placed.first()).toHaveCSS('border-color', 'rgb(153, 27, 27)');
  await expect(placed.nth(1)).toHaveCSS('border-color', 'rgb(153, 27, 27)');
});
