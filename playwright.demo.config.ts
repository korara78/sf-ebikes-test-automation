import { defineConfig, devices } from '@playwright/test';

/**
 * Standalone config for tests/reporting-demo.spec.ts only. Deliberately
 * separate from playwright.config.ts: that file's projects are each
 * scoped via testMatch to one specific spec file, so this test matches
 * none of them and would otherwise never run. Output paths are nested
 * under test-results/ and playwright-report/ (already gitignored) but
 * namespaced under demo/ so a demo run never overwrites the real suite's
 * test-results/results.json that scripts/generate-traceability-matrix.mjs
 * reads.
 */
const rawBaseURL = process.env.E_BIKES_BASE_URL;
const baseURL = rawBaseURL ? rawBaseURL.replace(/\/+$/, '') + '/' : undefined;

export default defineConfig({
  testDir: './tests',
  testMatch: /reporting-demo\.spec\.ts/,
  outputDir: 'test-results/demo',
  retries: 1,
  reporter: [
    ['html', { open: 'always', outputFolder: 'playwright-report/demo' }],
    ['json', { outputFile: 'test-results/demo/results.json' }]
  ],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: { mode: 'on', fullPage: true },
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
});
