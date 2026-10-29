import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

/**
 * This environment ships a pre-installed Chromium that may not match the
 * revision our pinned @playwright/test would download, and the download is
 * blocked anyway. Point at it when it is there, otherwise let Playwright
 * resolve its own.
 */
const PREINSTALLED_CHROMIUM = '/opt/pw-browsers/chromium';
const launchOptions = existsSync(PREINSTALLED_CHROMIUM)
  ? { executablePath: PREINSTALLED_CHROMIUM, args: ['--no-sandbox'] }
  : {};

/**
 * Offline test suite — the release gate. §2, §8.
 *
 * "A build that fails the offline test suite does not ship." This is the file
 * that makes that sentence true rather than aspirational.
 *
 * Tests run against the production build served statically, because the
 * service worker and the precached content pack are the things under test.
 */
export default defineConfig({
  testDir: './tests/offline',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env['CI'],
  retries: 0,
  reporter: process.env['CI'] ? 'list' : [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'mid-range-android',
      use: {
        // The device class the performance budget is written for.
        ...devices['Pixel 5'],
        launchOptions,
      },
    },
  ],
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env['CI'],
    timeout: 60_000,
  },
});
