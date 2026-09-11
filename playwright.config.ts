import { defineConfig } from '@playwright/test';

const liveURL = process.env.LIVE_PREVIEW_URL;
const basePath = process.env.PUBLIC_BASE_PATH ?? '/deepsea/pr-e2e';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: 0,
  timeout: 30_000,
  updateSnapshots: 'none',
  reporter: [['list'], ['html', { open: 'never' }]],
  snapshotPathTemplate: '{testDir}/{testFileDir}/screenshots/{arg}-{projectName}{ext}',
  expect: {
    timeout: 2_000,
    toHaveScreenshot: {
      maxDiffPixels: 0,
      maxDiffPixelRatio: 0,
      threshold: 0,
      animations: 'disabled',
      caret: 'hide',
      scale: 'css'
    }
  },
  use: {
    baseURL: liveURL ?? `http://127.0.0.1:4173${basePath}/`,
    browserName: 'chromium',
    headless: true,
    deviceScaleFactor: 1,
    locale: 'en-CA',
    timezoneId: 'UTC',
    colorScheme: 'dark',
    contextOptions: { reducedMotion: 'reduce', permissions: ['clipboard-read', 'clipboard-write'] },
    serviceWorkers: 'block',
    actionTimeout: 2_000,
    navigationTimeout: 2_000,
    trace: 'on',
    launchOptions: {
      args: ['--font-render-hinting=none', '--disable-lcd-text', '--disable-gpu', '--force-device-scale-factor=1']
    }
  },
  projects: [
    { name: 'phone', use: { viewport: { width: 393, height: 852 } } },
    { name: 'desktop', use: { viewport: { width: 1280, height: 900 } } }
  ],
  ...(liveURL ? {} : { webServer: {
    command: 'node scripts/start-test-services.mjs',
    url: `http://127.0.0.1:4173${basePath}/`,
    reuseExistingServer: false,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 },
    stdout: 'pipe',
    timeout: 60_000
  } })
});
