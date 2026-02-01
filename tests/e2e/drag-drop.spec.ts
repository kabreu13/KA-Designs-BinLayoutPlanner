import './coverage';
import { test, expect } from '@playwright/test';

const FIRST_BIN = '[data-testid="bin-card"]';
const CANVAS = '[data-testid="canvas-drop-area"]';
const PLACED = '[data-testid="placed-bin"]';

// Requires app running at BASE_URL (defaults to http://localhost:4173)
test('drag and drop a bin onto the canvas', async ({ page }) => {
  await page.goto('/');

  const bin = page.locator(FIRST_BIN).first();
  const canvas = page.locator(CANVAS);
  await bin.waitFor({ state: 'visible' });
  await canvas.waitFor({ state: 'visible' });

  const binBox = await bin.boundingBox();
  const canvasBox = await canvas.boundingBox();
  if (!binBox || !canvasBox) throw new Error('Missing bounding boxes');

  const target = {
    x: canvasBox.x + canvasBox.width / 2,
    y: canvasBox.y + canvasBox.height / 2
  };

  await page.mouse.move(binBox.x + binBox.width / 2, binBox.y + binBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 12 });
  await page.mouse.up();

  const placements = await page.evaluate(() => {
    const raw = localStorage.getItem('bin-layout-state');
    return raw ? JSON.parse(raw).placements : [];
  });

  await expect(page.locator(PLACED).first()).toBeVisible({ timeout: 5000 });
  await expect(page.getByText('Drag bins here')).not.toBeVisible({ timeout: 2000 });
  expect(placements.length).toBeGreaterThan(0);
});
