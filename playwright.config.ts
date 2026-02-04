import { defineConfig } from '@playwright/test';

const webServerCommand = process.env.PLAYWRIGHT_WEB_SERVER_COMMAND || 'npm run dev -- --host --port 4173';

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
    command: webServerCommand,
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    stderr: 'ignore'
  }
});
