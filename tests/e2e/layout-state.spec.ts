import './coverage';
import { test, expect } from '@playwright/test';

const BIN_CARD = '[data-testid="bin-card"]';
const PLACED = '[data-testid="placed-bin"]';

test('loads state from localStorage on refresh', async ({ page }) => {
  await page.goto('/');
  await page.locator(BIN_CARD).first().click();
  await expect(page.locator(PLACED)).toHaveCount(1);

  await page.reload();
  await expect(page.locator(PLACED)).toHaveCount(1);
});

test('loads state from share link query param', async ({ page }) => {
  const state = {
    drawerWidth: 24,
    drawerLength: 18,
    placements: [{ id: 'p1', binId: 'bin-2x2', x: 1, y: 1 }],
    usage: { 'bin-2x2': 1 }
  };
  const encoded = encodeURIComponent(Buffer.from(JSON.stringify(state)).toString('base64'));
  await page.goto(`/?layout=${encoded}`);

  await expect(page.locator(PLACED)).toHaveCount(1);
});

test('share link overrides localStorage state', async ({ page }) => {
  const localState = {
    drawerWidth: 24,
    drawerLength: 18,
    placements: [{ id: 'local', binId: 'bin-2x2', x: 4, y: 4 }],
    usage: { 'bin-2x2': 1 }
  };
  const paramState = {
    drawerWidth: 24,
    drawerLength: 18,
    placements: [{ id: 'param', binId: 'bin-2x2', x: 1, y: 1 }],
    usage: { 'bin-2x2': 1 }
  };

  await page.addInitScript((state) => {
    localStorage.setItem('bin-layout-state', JSON.stringify(state));
  }, localState);

  const encoded = encodeURIComponent(Buffer.from(JSON.stringify(paramState)).toString('base64'));
  await page.goto(`/?layout=${encoded}`);

  const placements = await page.evaluate(() => {
    const raw = localStorage.getItem('bin-layout-state');
    return raw ? JSON.parse(raw).placements : [];
  });
  expect(placements[0].x).toBe(1);
  expect(placements[0].y).toBe(1);
});

test('invalid localStorage JSON does not break load', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('bin-layout-state', '{bad json');
  });

  await page.goto('/');
  await expect(page.locator(BIN_CARD).first()).toBeVisible();
});
