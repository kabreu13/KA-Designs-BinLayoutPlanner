import { defineConfig } from '@playwright/test';

const webServerCommand = process.env.PLAYWRIGHT_WEB_SERVER_COMMAND || 'npm run dev -- --host --port 4173';
const isCi = Boolean(process.env.CI);

export default defineConfig({
  testDir: './tests/e2e',
  retries: isCi ? 1 : 0,
  workers: process.env.E2E_COVERAGE === '1' ? 1 : undefined,
  globalTeardown: process.env.E2E_COVERAGE === '1' ? './tests/e2e/coverage-merge.ts' : undefined,
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:4173',
    headless: true,
    trace: isCi ? 'on-first-retry' : 'off',
    video: isCi ? 'retain-on-failure' : 'off',
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: webServerCommand,
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    stderr: 'ignore'
  }
});
