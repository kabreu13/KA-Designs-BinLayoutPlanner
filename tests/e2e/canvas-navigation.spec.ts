import './coverage';
import { test, expect } from '@playwright/test';

const getTransformState = async (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const container = document.querySelector('[data-testid="canvas-scroll-container"]') as HTMLElement | null;
    if (!container) return null;
    return {
      scale: Number(container.dataset.canvasScale ?? '1'),
      x: Number(container.dataset.canvasX ?? '0'),
      y: Number(container.dataset.canvasY ?? '0')
    };
  });

test('header keeps only branding and title input', async ({ page }) => {
  await page.goto('/');

  const header = page.locator('header').first();
  await expect(header.getByRole('button', { name: 'Export PDF' })).toHaveCount(0);
  await expect(header.getByTitle('Profile')).toHaveCount(0);
  await expect(header.locator('input[aria-label="Layout title"]:visible')).toHaveCount(1);
});

test('@smoke canvas can pan by drag at 1x and zoomed', async ({ page }) => {
  await page.goto('/');

  const container = page.getByTestId('canvas-scroll-container');
  await expect(container).toBeVisible();
  const box = await container.boundingBox();
  if (!box) throw new Error('Missing canvas container bounds');

  const dragFromX = box.x + box.width * 0.55;
  const dragFromY = box.y + box.height * 0.55;

  const before = await getTransformState(page);
  if (!before) throw new Error('Missing initial transform state');
  await page.mouse.move(dragFromX, dragFromY);
  await page.mouse.down();
  await page.mouse.move(dragFromX + 120, dragFromY + 80);
  await page.mouse.up();

  const afterAtOneX = await getTransformState(page);
  if (!afterAtOneX) throw new Error('Missing transform state after first drag');
  expect(Math.abs(afterAtOneX.x - before.x) + Math.abs(afterAtOneX.y - before.y)).toBeGreaterThan(20);

  for (let i = 0; i < 8; i += 1) {
    await page.getByRole('button', { name: 'Zoom in' }).click();
  }
  await expect
    .poll(async () => {
      const state = await getTransformState(page);
      return state?.scale ?? 1;
    })
    .toBeGreaterThan(before.scale);

  const beforeZoomedDrag = await getTransformState(page);
  if (!beforeZoomedDrag) throw new Error('Missing transform state before zoomed drag');
  await page.mouse.move(dragFromX, dragFromY);
  await page.mouse.down();
  await page.mouse.move(dragFromX - 150, dragFromY + 70);
  await page.mouse.up();
  await expect
    .poll(async () => {
      const afterZoomedDrag = await getTransformState(page);
      if (!afterZoomedDrag) return 0;
      return (
        Math.abs(afterZoomedDrag.x - beforeZoomedDrag.x) +
        Math.abs(afterZoomedDrag.y - beforeZoomedDrag.y)
      );
    })
    .toBeGreaterThan(2);
});

test('home canvas recenters view', async ({ page }) => {
  await page.goto('/');

  const container = page.getByTestId('canvas-scroll-container');
  await expect(container).toBeVisible();
  const box = await container.boundingBox();
  if (!box) throw new Error('Missing canvas container bounds');

  for (let i = 0; i < 8; i += 1) {
    await page.getByRole('button', { name: 'Zoom in' }).click();
  }

  const dragFromX = box.x + box.width * 0.6;
  const dragFromY = box.y + box.height * 0.6;
  await page.mouse.move(dragFromX, dragFromY);
  await page.mouse.down();
  await page.mouse.move(dragFromX - 320, dragFromY - 240);
  await page.mouse.up();

  await page.getByTestId('home-canvas-button').click();

  await expect.poll(async () => {
    const state = await page.evaluate(() => {
      const container = document.querySelector('[data-testid="canvas-scroll-container"]') as HTMLElement | null;
      const wrapper = document.querySelector('[data-testid="canvas-transform-wrapper"]') as HTMLElement | null;
      const content = document.querySelector('[data-testid="canvas-transform-content"]') as HTMLElement | null;
      if (!container || !wrapper || !content || !content.firstElementChild) return null;
      const canvas = content.firstElementChild as HTMLElement;
      const scale = Number(container.dataset.canvasScale ?? '1');
      const x = Number(container.dataset.canvasX ?? '0');
      const y = Number(container.dataset.canvasY ?? '0');
      const expectedX = (wrapper.clientWidth - canvas.offsetWidth * scale) / 2;
      const expectedY = (wrapper.clientHeight - canvas.offsetHeight * scale) / 2;
      return { x, y, expectedX, expectedY };
    });
    if (!state) return Number.POSITIVE_INFINITY;
    return Math.abs(state.x - state.expectedX) + Math.abs(state.y - state.expectedY);
  }).toBeLessThan(120);
});

test('wheel zoom updates zoom level around cursor', async ({ page }) => {
  await page.goto('/');

  const container = page.getByTestId('canvas-scroll-container');
  await expect(container).toBeVisible();
  const box = await container.boundingBox();
  if (!box) throw new Error('Missing canvas container bounds');

  const vx = box.width * 0.72;
  const vy = box.height * 0.38;
  const pointerX = box.x + vx;
  const pointerY = box.y + vy;

  const zoomTextBefore = await page.getByTestId('canvas-zoom-value').innerText();

  await page.mouse.move(pointerX, pointerY);
  await page.mouse.wheel(0, -180);

  await expect.poll(async () => page.getByTestId('canvas-zoom-value').innerText()).not.toBe(zoomTextBefore);
  const zoomTextAfter = await page.getByTestId('canvas-zoom-value').innerText();
  const beforePct = Number.parseInt(zoomTextBefore.replace('%', ''), 10);
  const afterPct = Number.parseInt(zoomTextAfter.replace('%', ''), 10);
  expect(Math.abs(afterPct - beforePct)).toBeGreaterThanOrEqual(1);
});
