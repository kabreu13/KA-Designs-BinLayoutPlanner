import './coverage';
import { test, expect } from '@playwright/test';

const BIN_CARD = '[data-testid="bin-card"]';
const PLACED = '[data-testid="placed-bin"]';

const setDrawerSize = async (page: import('@playwright/test').Page, width: number, length: number) => {
  await page.getByTestId('drawer-width-input').fill(String(width));
  await page.getByTestId('drawer-length-input').fill(String(length));
};

const searchAndClickBin = async (page: import('@playwright/test').Page, query: string) => {
  const search = page.getByPlaceholder('Search sizes...');
  await search.fill(query);
  await page.locator(BIN_CARD).first().click();
};

const searchAndDragBinToCanvas = async (page: import('@playwright/test').Page, query: string) => {
  const search = page.getByPlaceholder('Search sizes...');
  await search.fill(query);
  const card = page.locator(BIN_CARD).first();
  await card.waitFor({ state: 'visible' });
  const canvas = page.locator('[data-testid="canvas-drop-area"]');
  await canvas.waitFor({ state: 'visible' });
  const cardBox = await card.boundingBox();
  const canvasBox = await canvas.boundingBox();
  if (!cardBox || !canvasBox) throw new Error('Missing bounding boxes');

  await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2, { steps: 12 });
  await page.mouse.up();
};

test('blocked placement shows error toast', async ({ page }) => {
  await page.goto('/');

  await setDrawerSize(page, 6, 6);
  await searchAndClickBin(page, '6x6');

  await expect(page.locator(PLACED)).toHaveCount(1);

  await searchAndDragBinToCanvas(page, '2x2');
  await expect(page.getByText('No room for that bin.')).toBeVisible();
});

test('auto-fit placement does not show an info toast', async ({ page }) => {
  await page.goto('/');

  await setDrawerSize(page, 6, 6);
  await searchAndClickBin(page, '4x4');
  await expect(page.locator(PLACED)).toHaveCount(1);

  await searchAndDragBinToCanvas(page, '2x2');
  await expect(page.locator(PLACED)).toHaveCount(2);
  await expect(page.getByText(/Auto-fit to/)).toHaveCount(0);
});
