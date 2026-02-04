import { test } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, writeFileSync } from 'fs';

const coverageEnabled = () => process.env.E2E_COVERAGE === '1';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const nycOutputDir = path.resolve(__dirname, '../../.nyc_output');

test.afterEach(async ({ page }) => {
  if (!coverageEnabled()) return;
  if (page.isClosed()) return;
  const coverage = await page.evaluate(() => (window as { __coverage__?: unknown }).__coverage__ ?? null);
  if (coverage) {
    mkdirSync(nycOutputDir, { recursive: true });
    const filename = path.join(
      nycOutputDir,
      `coverage-${Date.now()}-${Math.random().toString(16).slice(2)}.json`
    );
    writeFileSync(filename, JSON.stringify(coverage));
  }
});
