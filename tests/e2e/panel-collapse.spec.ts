import './coverage';
import { test, expect } from '@playwright/test';

test('side panels can collapse and expand', async ({ page }) => {
  await page.goto('/');

  const catalogCollapse = page.getByTitle('Collapse Bin catalog');
  const summaryCollapse = page.getByTitle('Collapse Summary panel');

  await expect(catalogCollapse).toBeVisible();
  await expect(summaryCollapse).toBeVisible();

  await catalogCollapse.click();
  await summaryCollapse.click();

  const catalogExpand = page.getByTitle('Expand Bin catalog');
  const summaryExpand = page.getByTitle('Expand Summary panel');

  await expect(catalogExpand).toBeVisible();
  await expect(summaryExpand).toBeVisible();
  await expect(catalogExpand).toBeVisible();
  await expect(summaryExpand).toBeVisible();

  await catalogExpand.click();
  await summaryExpand.click();

  await expect(page.getByTitle('Collapse Bin catalog')).toBeVisible();
  await expect(page.getByTitle('Collapse Summary panel')).toBeVisible();
});
