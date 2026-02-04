import './coverage';
import { test, expect } from '@playwright/test';

const BIN_CARD = '[data-testid="bin-card"]';

test('bin catalog size labels stay inside the card', async ({ page }) => {
  await page.goto('/');
  const toggle = page.getByTestId('catalog-group-toggle-2');
  await toggle.waitFor({ state: 'visible' });
  if ((await toggle.getAttribute('aria-expanded')) === 'false') {
    await toggle.click();
  }

  const card = page.locator(BIN_CARD).first();
  await card.waitFor({ state: 'visible' });

  const cardBox = await card.boundingBox();
  if (!cardBox) throw new Error('Missing bin card bounding box');

  const labelBoxes = await card.locator('span').evaluateAll((elements) =>
    elements.map((el) => {
      const rect = el.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
    })
  );

  expect(labelBoxes.length).toBeGreaterThanOrEqual(2);

  const tolerance = 2;
  labelBoxes.forEach((box) => {
    expect(box.left).toBeGreaterThanOrEqual(cardBox.x - tolerance);
    expect(box.right).toBeLessThanOrEqual(cardBox.x + cardBox.width + tolerance);
    expect(box.top).toBeGreaterThanOrEqual(cardBox.y - tolerance);
    expect(box.bottom).toBeLessThanOrEqual(cardBox.y + cardBox.height + tolerance);
  });
});

test('bin catalog length headers omit counts', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText(/Length 2"/)).toBeVisible();
  await expect(page.getByText(/Length 2" \(\d+\)/)).toHaveCount(0);
});

test('bin catalog groups can collapse and expand', async ({ page }) => {
  await page.goto('/');

  const toggle = page.getByTestId('catalog-group-toggle-2');
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByTestId('catalog-group-body-2')).toHaveCount(0);

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByTestId('catalog-group-body-2')).toBeVisible();

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByTestId('catalog-group-body-2')).toHaveCount(0);
});
