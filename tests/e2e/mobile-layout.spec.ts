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

  await page.getByTestId('mobile-tab-summary').click();
  await expect(page.getByText('Drawer Settings')).toBeVisible();
  await expect(page.getByTestId('drawer-width-input')).toBeVisible();
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

test('quick actions can collapse and expand on desktop', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByTestId('suggest-layout-button')).toBeVisible();
  await page.getByTestId('quick-actions-toggle').click();
  await expect(page.getByTestId('suggest-layout-button')).toHaveCount(0);
  await page.getByTestId('quick-actions-toggle').click();
  await expect(page.getByTestId('suggest-layout-button')).toBeVisible();
});

test('quick actions bar can be dragged on desktop', async ({ page }) => {
  await page.goto('/');

  const bar = page.locator('[data-tour="quick-actions-pill"]');
  const handle = page.getByTestId('quick-actions-drag-handle');
  await expect(bar).toBeVisible();
  await expect(handle).toBeVisible();

  const beforeX = Number.parseFloat((await bar.getAttribute('data-actions-offset-x')) ?? '0');
  const beforeY = Number.parseFloat((await bar.getAttribute('data-actions-offset-y')) ?? '0');
  const dragged = await page.evaluate(() => {
    const handleEl = document.querySelector('[data-testid="quick-actions-drag-handle"]') as HTMLElement | null;
    if (!handleEl) return false;
    const rect = handleEl.getBoundingClientRect();
    const startX = rect.left + rect.width / 2;
    const startY = rect.top + rect.height / 2;
    const endX = startX + 120;
    const endY = startY - 40;

    handleEl.dispatchEvent(
      new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        button: 0,
        clientX: startX,
        clientY: startY
      })
    );
    window.dispatchEvent(
      new MouseEvent('mousemove', {
        bubbles: true,
        cancelable: true,
        buttons: 1,
        clientX: endX,
        clientY: endY
      })
    );
    window.dispatchEvent(
      new MouseEvent('mouseup', {
        bubbles: true,
        cancelable: true,
        button: 0,
        clientX: endX,
        clientY: endY
      })
    );
    return true;
  });
  expect(dragged).toBe(true);
  await expect
    .poll(async () => {
      const afterX = Number.parseFloat((await bar.getAttribute('data-actions-offset-x')) ?? '0');
      const afterY = Number.parseFloat((await bar.getAttribute('data-actions-offset-y')) ?? '0');
      return Math.abs(afterX - beforeX) + Math.abs(afterY - beforeY);
    })
    .toBeGreaterThan(30);
});

test('quick actions can collapse and expand on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const toggle = page.getByTestId('quick-actions-toggle');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await expect(page.getByTestId('suggest-layout-button')).toBeVisible();
  await page.getByTestId('quick-actions-toggle').click();
  await expect(page.getByTestId('suggest-layout-button')).toHaveCount(0);
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
