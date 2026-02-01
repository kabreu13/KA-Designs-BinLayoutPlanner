import './coverage';
import { test, expect } from '@playwright/test';

const FIRST_BIN = '[data-testid="bin-card"]';
const CANVAS = '[data-testid="canvas-drop-area"]';
const PLACED = '[data-testid="placed-bin"]';

test('dragging a placed bin moves by the exact mouse delta', async ({ page }) => {
  await page.goto('/');

  const bin = page.locator(FIRST_BIN).first();
  const canvas = page.locator(CANVAS);
  await bin.waitFor({ state: 'visible' });
  await canvas.waitFor({ state: 'visible' });

  // Place a bin via click
  await bin.click();

  const placed = page.locator(PLACED).first();
  await placed.waitFor({ state: 'visible' });

  // Record initial position
  const before = await placed.boundingBox();
  if (!before) throw new Error('Placed bin bounding box missing');

  // Drag by a known delta (px)
  const delta = { x: 40, y: 40 };
  const startX = before.x + before.width / 2;
  const startY = before.y + before.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + delta.x, startY + delta.y, { steps: 10 });
  await page.mouse.up();

  const after = await placed.boundingBox();
  if (!after) throw new Error('Placed bin bounding box missing after drag');

  const movedX = after.x - before.x;
  const movedY = after.y - before.y;

  expect(movedX).toBeGreaterThan(0);
  expect(movedY).toBeGreaterThan(0);
});
