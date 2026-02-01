import './coverage';
import { test, expect } from '@playwright/test';

const BIN_CARD = '[data-testid="bin-card"]';
const PLACED = '[data-testid="placed-bin"]';

const getPlacements = async (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const raw = localStorage.getItem('bin-layout-state');
    return raw ? (JSON.parse(raw).placements ?? []) : [];
  });

test('drawer size inputs update canvas labels', async ({ page }) => {
  await page.goto('/');

  const inputs = page.locator('input[type="number"]');
  await inputs.nth(0).fill('30');
  await inputs.nth(1).fill('20');

  await expect(page.getByText('30" Width')).toBeVisible();
  await expect(page.getByText('20" Length')).toBeVisible();
});

test('space used bar increases with placements', async ({ page }) => {
  await page.goto('/');

  const bar = page.locator('div.h-2 > div.h-full');
  const beforeWidth = await bar.getAttribute('style');

  const binCard = page.locator(BIN_CARD).first();
  await binCard.waitFor({ state: 'visible' });
  await binCard.click();
  await binCard.click();

  const afterWidth = await bar.getAttribute('style');
  expect(beforeWidth).not.toBe(afterWidth);
  await expect(page.getByText(/bins placed/)).toBeVisible();
});

test('remove bin from summary updates placements', async ({ page }) => {
  await page.goto('/');

  const binCard = page.locator(BIN_CARD).first();
  await binCard.waitFor({ state: 'visible' });
  await binCard.click();
  await binCard.click();

  await expect(page.locator(PLACED)).toHaveCount(2);
  const before = await getPlacements(page);
  expect(before.length).toBe(2);

  const removeButton = page.locator('button:has(svg.lucide-trash-2)').first();
  await removeButton.click({ force: true });

  const after = await getPlacements(page);
  expect(after.length).toBe(1);
});

test('copy share link shows status', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Copy Share Link' }).click();
  await expect(page.getByText(/Share link copied to clipboard|Failed to copy share link/)).toBeVisible();
});

test('copy share link works without clipboard API', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Copy Share Link' }).click();
  await expect(page.getByText('Share link copied to clipboard')).toBeVisible();
});

test('copy share link handles clipboard write failure', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: () => Promise.reject(new Error('nope'))
      },
      configurable: true
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Copy Share Link' }).click();
  await expect(page.getByText('Failed to copy share link')).toBeVisible();
});

test('import JSON populates placements and shows status', async ({ page }) => {
  await page.goto('/');

  const state = {
    drawerWidth: 24,
    drawerLength: 18,
    placements: [{ id: 'p1', binId: 'bin-2x2', x: 1, y: 1 }],
    usage: { 'bin-2x2': 1 }
  };

  await page.setInputFiles('#layout-import', {
    name: 'layout.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(state))
  });

  await expect(page.getByText('Layout imported')).toBeVisible();
  const placements = await getPlacements(page);
  expect(placements.length).toBe(1);
});

test('export JSON downloads a file', async ({ page }) => {
  await page.goto('/');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON' }).click();
  const download = await downloadPromise;
  const filename = download.suggestedFilename();
  expect(filename).toBe('bin-layout.json');
});

test('export PDF downloads a file', async ({ page }) => {
  await page.goto('/');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export PDF' }).click();
  const download = await downloadPromise;
  const filename = download.suggestedFilename();
  expect(filename).toBe('bin-layout.pdf');
});

test('import JSON shows error on invalid JSON', async ({ page }) => {
  await page.goto('/');

  await page.setInputFiles('#layout-import', {
    name: 'layout.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{this is not valid json')
  });

  await expect(page.getByText('Import failed: bad JSON')).toBeVisible();
});

test('import JSON shows error on invalid layout', async ({ page }) => {
  await page.goto('/');

  const badLayout = { drawerWidth: 24, placements: [] };
  await page.setInputFiles('#layout-import', {
    name: 'layout.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(badLayout))
  });

  await expect(page.getByText('Invalid layout file')).toBeVisible();
});
