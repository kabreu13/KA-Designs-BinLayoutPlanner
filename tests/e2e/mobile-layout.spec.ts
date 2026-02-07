import './coverage';
import { test, expect } from '@playwright/test';

test('mobile bottom sheet switches between catalog and summary', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const toggle = page.getByTestId('mobile-panel-toggle');
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');

  await page.getByTestId('mobile-tab-catalog').click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByText('Bin Catalog')).toBeVisible();
  await expect(page.getByTestId('mobile-tab-catalog')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('mobile-tab-summary')).toHaveAttribute('aria-selected', 'false');
  await expect(page.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'mobile-tab-catalog');

  await page.getByTestId('mobile-tab-summary').click();
  await expect(page.getByText('Drawer Settings')).toBeVisible();
  await expect(page.getByTestId('drawer-width-input')).toBeVisible();
  await expect(page.getByTestId('mobile-tab-catalog')).toHaveAttribute('aria-selected', 'false');
  await expect(page.getByTestId('mobile-tab-summary')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'mobile-tab-summary');
});

test('mobile layout avoids horizontal page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');

  const hasHorizontalOverflow = await page.evaluate(() => {
    const rootOverflow = document.documentElement.scrollWidth - window.innerWidth;
    const bodyOverflow = document.body.scrollWidth - window.innerWidth;
    return rootOverflow > 1 || bodyOverflow > 1;
  });

  expect(hasHorizontalOverflow).toBe(false);
});

test('quick actions stay pinned on desktop', async ({ page }) => {
  await page.goto('/');

  const bar = page.locator('[data-tour="quick-actions-pill"]');
  await expect(bar).toBeVisible();
  await expect(page.getByTestId('suggest-layout-button')).toBeVisible();
  await expect(page.getByTestId('suggest-layout-button')).toBeDisabled();
  await expect(page.getByTestId('quick-actions-toggle')).toHaveCount(0);
});

test('quick actions can collapse and expand on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  await expect(page.getByRole('button', { name: 'More' })).toBeVisible();
  await expect(page.getByTestId('quick-actions-toggle')).toHaveAttribute('aria-expanded', 'true');

  await page.getByRole('button', { name: 'More' }).click();
  await expect(page.getByTestId('suggest-layout-button')).toBeVisible();
  await expect(page.getByTestId('suggest-layout-button')).toBeDisabled();

  const toggle = page.getByTestId('quick-actions-toggle');
  await toggle.click();
  await expect(page.getByTestId('suggest-layout-button')).toHaveCount(0);
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('button', { name: 'More' })).toBeVisible();
});

test('mobile summary drawer settings can collapse and expand', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  await page.getByTestId('mobile-tab-summary').click();
  await expect(page.getByTestId('drawer-width-input')).toBeVisible();

  await page.getByTestId('drawer-settings-toggle').click();
  await expect(page.getByTestId('drawer-width-input')).toHaveCount(0);

  await page.getByTestId('drawer-settings-toggle').click();
  await expect(page.getByTestId('drawer-width-input')).toBeVisible();
});

test('mobile panel interactions remain tappable when quick actions are expanded', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  await page.getByRole('button', { name: 'More' }).click();
  await expect(page.getByTestId('suggest-layout-button')).toBeVisible();

  await page.getByTestId('mobile-tab-catalog').click({ trial: true });
  await page.getByTestId('mobile-tab-catalog').click();
  await expect(page.getByTestId('mobile-panel-toggle')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByTestId('quick-actions-toggle')).toHaveAttribute('aria-expanded', 'true');

  const firstBinCard = page.locator('[data-testid="bin-card"]').first();
  await firstBinCard.click();
  await expect(page.locator('[data-testid="placed-bin"]')).toHaveCount(1);

  await page.getByTestId('mobile-tab-summary').click();
  await page.getByRole('button', { name: 'Open Etsy Cart' }).click();
  await expect(page.getByRole('alert')).toContainText('Set ETSY_LISTING_ID in src/config/etsy.ts');

  await page.getByTestId('mobile-panel-toggle').click();
  await expect(page.getByTestId('mobile-panel-toggle')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByTestId('quick-actions-toggle')).toHaveAttribute('aria-expanded', 'true');
});
