import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/web',
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: 'http://127.0.0.1:8081',
    headless: true,
    trace: 'retain-on-failure',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {},
  },
  webServer: {
    command: 'npm run web -- --host localhost',
    url: 'http://127.0.0.1:8081',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
