import { expect, type Page } from '@playwright/test';

export const dismissHowTo = async (page: Page) => {
  const howTo = page.getByTestId('canvas-how-to');
  if (await howTo.isVisible().catch(() => false)) {
    await howTo.getByRole('button', { name: 'Hide' }).click();
  }
};

export const ensureCatalogExpanded = async (page: Page) => {
  const toggles = page.locator('[data-testid^="catalog-group-toggle-"]');
  const count = await toggles.count();
  for (let index = 0; index < count; index += 1) {
    const toggle = toggles.nth(index);
    await expect(toggle).toBeVisible();
    if ((await toggle.getAttribute('aria-expanded')) !== 'true') {
      await toggle.click();
    }
  }
  await dismissHowTo(page);
};

export const clickBinBySize = async (page: Page, size: `${number}x${number}`) => {
  await ensureCatalogExpanded(page);
  const card = page.locator(`[data-testid="bin-card"]:has([data-size="${size}"])`).first();
  await expect(card).toBeVisible();
  await card.click();
};
