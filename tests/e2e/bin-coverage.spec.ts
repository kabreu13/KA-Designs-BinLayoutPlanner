import './coverage';
import { test, expect } from '@playwright/test';
import { BINS } from '../../src/data/bins';

const BIN_CARD = '[data-testid="bin-card"]';
const PLACED = '[data-testid="placed-bin"]';

const binsById = new Map(BINS.map((bin) => [bin.id, bin]));

type Placement = { id: string; binId: string; x: number; y: number };

const getPlacements = async (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const raw = localStorage.getItem('bin-layout-state');
    return raw ? (JSON.parse(raw).placements ?? []) : [];
  });

const setDrawerSize = async (page: import('@playwright/test').Page, width: number, length: number) => {
  const inputs = page.locator('input[type="number"]');
  await inputs.nth(0).fill(String(width));
  await inputs.nth(1).fill(String(length));
};

const searchAndClickBin = async (page: import('@playwright/test').Page, query: string) => {
  const search = page.getByPlaceholder('Search sizes...');
  await search.fill(query);
  await page.locator(BIN_CARD).first().click();
};

test('blocked placement when drawer is full', async ({ page }) => {
  await page.goto('/');

  await setDrawerSize(page, 6, 6);
  await searchAndClickBin(page, '6x6');

  const placementsAfterFirst = (await getPlacements(page)) as Placement[];
  expect(placementsAfterFirst.length).toBe(1);

  await searchAndClickBin(page, '2x2');
  const placementsAfterSecond = (await getPlacements(page)) as Placement[];
  expect(placementsAfterSecond.length).toBe(1);
});

test('clamps to drawer edges when dragged beyond bounds', async ({ page }) => {
  await page.goto('/');

  await setDrawerSize(page, 6, 6);
  await searchAndClickBin(page, '4x4');

  const placed = page.locator(PLACED).first();
  await placed.waitFor({ state: 'visible' });

  const box = await placed.boundingBox();
  if (!box) throw new Error('Missing placed bin bounding box');

  // Drag far to bottom-right to force clamping.
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 1000, box.y + 1000, { steps: 12 });
  await page.mouse.up();

  const placements = (await getPlacements(page)) as Placement[];
  const placedData = placements[0];
  const bin = binsById.get(placedData.binId);
  if (!bin) throw new Error('Missing bin metadata');

  const maxX = 6 - bin.width;
  const maxY = 6 - bin.length;

  expect(placedData.x).toBeCloseTo(maxX, 1);
  expect(placedData.y).toBeCloseTo(maxY, 1);
});

test('drag delta stays consistent at 1x scale', async ({ page }) => {
  await page.goto('/');

  await page.locator(BIN_CARD).first().click();
  const placed = page.locator(PLACED).first();
  await placed.waitFor({ state: 'visible' });

  const before = (await getPlacements(page)) as Placement[];
  const beforePlacement = before[0];

  const box = await placed.boundingBox();
  if (!box) throw new Error('Missing placed bin bounding box');

  const deltaPx = { x: 75, y: 50 };
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + deltaPx.x, box.y + box.height / 2 + deltaPx.y, { steps: 12 });
  await page.mouse.up();

  const expectedDx = deltaPx.x / 25;
  const expectedDy = deltaPx.y / 25;

  await expect
    .poll(async () => {
      const after = (await getPlacements(page)) as Placement[];
      return after[0]?.x - beforePlacement.x;
    })
    .toBeCloseTo(expectedDx, 1);
  await expect
    .poll(async () => {
      const after = (await getPlacements(page)) as Placement[];
      return after[0]?.y - beforePlacement.y;
    })
    .toBeCloseTo(expectedDy, 1);
});

test('drag delta is consistent with snap 1 and snap 0.5', async ({ page }) => {
  await page.goto('/');

  const magnet = page.getByTitle(/Snap to/i);
  await page.locator(BIN_CARD).first().click();
  const placed = page.locator(PLACED).first();
  await placed.waitFor({ state: 'visible' });

  const before = (await getPlacements(page)) as Placement[];
  const beforePlacement = before[0];

  const box = await placed.boundingBox();
  if (!box) throw new Error('Missing placed bin bounding box');

  const deltaPx = { x: 50, y: 25 };
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + deltaPx.x, box.y + box.height / 2 + deltaPx.y, { steps: 10 });
  await page.mouse.up();

  const mid = (await getPlacements(page)) as Placement[];
  const midPlacement = mid[0];
  expect(midPlacement.x - beforePlacement.x).toBeCloseTo(deltaPx.x / 25, 1);
  expect(midPlacement.y - beforePlacement.y).toBeCloseTo(deltaPx.y / 25, 1);

  // Toggle to 0.5" snap (currently no snapping applied; this ensures behavior remains consistent).
  await magnet.click();

  const box2 = await placed.boundingBox();
  if (!box2) throw new Error('Missing placed bin bounding box');

  const deltaPx2 = { x: 30, y: 40 };
  await page.mouse.move(box2.x + box2.width / 2, box2.y + box2.height / 2);
  await page.mouse.down();
  await page.mouse.move(box2.x + box2.width / 2 + deltaPx2.x, box2.y + box2.height / 2 + deltaPx2.y, { steps: 10 });
  await page.mouse.up();

  const after = (await getPlacements(page)) as Placement[];
  const afterPlacement = after[0];
  expect(afterPlacement.x - midPlacement.x).toBeCloseTo(deltaPx2.x / 25, 1);
  expect(afterPlacement.y - midPlacement.y).toBeCloseTo(deltaPx2.y / 25, 1);
});
