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

test('bin catalog length headers show counts', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText(/Length 2" \(\d+\)/)).toBeVisible();
});

test('bin catalog groups can collapse and expand', async ({ page }) => {
  await page.goto('/');

  const toggle = page.getByTestId('catalog-group-toggle-2');
  await expect(toggle).toBeVisible();
  const body = page.getByTestId('catalog-group-body-2');
  const initiallyExpanded = (await toggle.getAttribute('aria-expanded')) === 'true';

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', initiallyExpanded ? 'false' : 'true');
  await expect(body).toHaveCount(initiallyExpanded ? 0 : 1);

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', initiallyExpanded ? 'true' : 'false');
  await expect(body).toHaveCount(initiallyExpanded ? 1 : 0);
});
