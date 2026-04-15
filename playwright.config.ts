import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  retries: 0,
  reporter: [
    ['list'],
    ['junit', { outputFile: 'test-results/results.xml' }],
  ],
  use: {
    baseURL: process.env.BASE_URL || 'https://876f-123-201-90-70.ngrok-free.app',
    headless: true,
    extraHTTPHeaders: {
      'ngrok-skip-browser-warning': 'true',
    },
  },
});
