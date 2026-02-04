import './coverage';
import { test, expect } from '@playwright/test';
import { clickBinBySize, ensureCatalogExpanded } from './helpers';

const PLACED = '[data-testid="placed-bin"]';

const setDrawerSize = async (page: import('@playwright/test').Page, width: number, length: number) => {
  await page.getByTestId('drawer-width-input').fill(String(width));
  await page.getByTestId('drawer-length-input').fill(String(length));
};

const dragPlacedBinOntoAnother = async (page: import('@playwright/test').Page, sourceIndex: number, targetIndex: number) => {
  const source = page.locator(PLACED).nth(sourceIndex);
  const target = page.locator(PLACED).nth(targetIndex);
  await source.waitFor({ state: 'visible' });
  await target.waitFor({ state: 'visible' });
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  if (!sourceBox || !targetBox) throw new Error('Missing placed bin bounding boxes');

  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 12 });
  await page.mouse.up();
};

test('blocked add keeps placement count unchanged', async ({ page }) => {
  await page.goto('/');
  await ensureCatalogExpanded(page);

  await setDrawerSize(page, 6, 6);
  await clickBinBySize(page, '6x6');
  await expect(page.locator(PLACED)).toHaveCount(1);

  await clickBinBySize(page, '2x2');
  await expect(page.locator(PLACED)).toHaveCount(1);
});

test('auto-fit placement does not show an info toast', async ({ page }) => {
  await page.goto('/');
  await ensureCatalogExpanded(page);

  await setDrawerSize(page, 4, 4);
  await clickBinBySize(page, '2x2');
  await clickBinBySize(page, '2x2');
  await expect(page.locator(PLACED)).toHaveCount(2);
  await dragPlacedBinOntoAnother(page, 1, 0);
  await expect(page.locator(PLACED)).toHaveCount(2);
  await expect(page.getByText(/Auto-fit to/)).toHaveCount(0);
});
