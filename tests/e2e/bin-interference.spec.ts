import './coverage';
import { test, expect } from '@playwright/test';
import { BINS } from '../../src/data/bins';

const FIRST_BIN_CARD = '[data-testid="bin-card"]';
const CANVAS = '[data-testid="canvas-drop-area"]';
const PLACED = '[data-testid="placed-bin"]';

const binsById = new Map(BINS.map((bin) => [bin.id, bin]));

type Placement = { id: string; binId: string; x: number; y: number };

const hasOverlap = (placements: Placement[]) => {
  for (let i = 0; i < placements.length; i += 1) {
    for (let j = i + 1; j < placements.length; j += 1) {
      const a = placements[i];
      const b = placements[j];
      const binA = binsById.get(a.binId);
      const binB = binsById.get(b.binId);
      if (!binA || !binB) continue;
      const overlap =
        a.x < b.x + binB.width &&
        a.x + binA.width > b.x &&
        a.y < b.y + binB.length &&
        a.y + binA.length > b.y;
      if (overlap) return true;
    }
  }
  return false;
};

const getPlacements = async (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const raw = localStorage.getItem('bin-layout-state');
    return raw ? (JSON.parse(raw).placements ?? []) : [];
  });

test('dragging an existing bin onto another does not overlap', async ({ page }) => {
  await page.goto('/');

  const binCard = page.locator(FIRST_BIN_CARD).first();
  const canvas = page.locator(CANVAS);
  await binCard.waitFor({ state: 'visible' });
  await canvas.waitFor({ state: 'visible' });

  // Place two bins via click
  await binCard.click();
  await binCard.click();

  const placed = page.locator(PLACED);
  await expect(placed).toHaveCount(2);

  const target = placed.first();
  const mover = placed.nth(1);

  const targetBox = await target.boundingBox();
  const moverBox = await mover.boundingBox();
  if (!targetBox || !moverBox) throw new Error('Missing bounding boxes');

  await page.mouse.move(moverBox.x + moverBox.width / 2, moverBox.y + moverBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 12 });
  await page.mouse.up();

  const placements = (await getPlacements(page)) as Placement[];
  expect(placements.length).toBeGreaterThanOrEqual(2);
  expect(hasOverlap(placements)).toBe(false);
});

test('dropping a new bin onto an occupied area auto-fits without overlap', async ({ page }) => {
  await page.goto('/');

  const binCard = page.locator(FIRST_BIN_CARD).first();
  const canvas = page.locator(CANVAS);
  await binCard.waitFor({ state: 'visible' });
  await canvas.waitFor({ state: 'visible' });

  // Place one bin via click
  await binCard.click();

  const placed = page.locator(PLACED).first();
  await placed.waitFor({ state: 'visible' });

  const targetBox = await placed.boundingBox();
  const cardBox = await binCard.boundingBox();
  if (!targetBox || !cardBox) throw new Error('Missing bounding boxes');

  // Drag a new bin card onto the occupied bin area
  await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 12 });
  await page.mouse.up();

  const placements = (await getPlacements(page)) as Placement[];
  expect(placements.length).toBeGreaterThanOrEqual(2);
  expect(hasOverlap(placements)).toBe(false);
});

test('interference checks work with different bin sizes', async ({ page }) => {
  await page.goto('/');

  const search = page.getByPlaceholder('Search sizes...');
  await search.fill('8x10');
  await page.locator(FIRST_BIN_CARD).first().click();

  await search.fill('2x2');
  await page.locator(FIRST_BIN_CARD).first().click();

  await expect(page.locator(PLACED)).toHaveCount(2);
  const placements = (await getPlacements(page)) as Placement[];
  expect(placements.length).toBeGreaterThanOrEqual(2);
  expect(hasOverlap(placements)).toBe(false);
});
