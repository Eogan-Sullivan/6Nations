import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/web',
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: 'http://127.0.0.1:8082',
    headless: true,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        launchOptions: process.env.PLAYWRIGHT_FIREFOX_EXECUTABLE_PATH
          ? { executablePath: process.env.PLAYWRIGHT_FIREFOX_EXECUTABLE_PATH }
          : {},
      },
    },
  ],
  webServer: {
    command: 'EXPO_PUBLIC_DEMO_MODE=true EXPO_PUBLIC_SUPABASE_URL= EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY= EXPO_PUBLIC_API_URL= EXPO_NO_DOTENV=1 npm run web -- --host localhost --port 8082',
    url: 'http://127.0.0.1:8082',
    reuseExistingServer: true,
    timeout: 120000,
  },
});
