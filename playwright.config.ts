import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  retries: 0,
  workers: process.env.E2E_COVERAGE === '1' ? 1 : undefined,
  globalTeardown: process.env.E2E_COVERAGE === '1' ? './tests/e2e/coverage-merge.ts' : undefined,
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:4173',
    headless: true
  },
  webServer: {
    command: 'npm run dev -- --host --port 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    stdout: 'ignore',
    stderr: 'ignore'
  }
});
