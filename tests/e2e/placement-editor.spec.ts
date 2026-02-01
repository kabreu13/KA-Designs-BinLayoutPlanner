import './coverage';
import { test, expect } from '@playwright/test';

test('placed bin editor updates label, color, and size', async ({ page }) => {
  await page.goto('/');

  await page.locator('[data-testid="bin-card"]').first().click();
  const placed = page.getByTestId('placed-bin').first();
  await placed.waitFor({ state: 'visible' });

  await placed.click();
  const editor = page.getByTestId('placement-editor');
  await expect(editor).toBeVisible();

  const labelInput = page.getByTestId('placement-label');
  await labelInput.fill('Spice');
  await labelInput.press('Enter');
  await expect(placed).toContainText('Spice');

  const colorInput = page.getByTestId('placement-color');
  await colorInput.fill('#ff0000');
  await expect(placed).toHaveCSS('background-color', 'rgb(255, 0, 0)');

  await page.getByTestId('size-width-increase').click();
  await page.getByTestId('size-length-increase').click();

  await expect.poll(async () => {
    const placements = await page.evaluate(() => {
      const raw = localStorage.getItem('bin-layout-state');
      return raw ? (JSON.parse(raw).placements ?? []) : [];
    });
    return [placements[0]?.width, placements[0]?.length];
  }).toEqual([4, 4]);
});
