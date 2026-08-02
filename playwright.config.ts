import { defineConfig, devices } from '@playwright/test';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * Normalize to exactly one trailing slash. Relative goto() paths (no
 * leading slash) resolve against baseURL by replacing everything after
 * the last '/' — without a trailing slash here, that would clobber the
 * `/ebikes/s` community path segment instead of appending after it.
 */
const rawBaseURL = process.env.E_BIKES_BASE_URL;
const baseURL = rawBaseURL ? rawBaseURL.replace(/\/+$/, '') + '/' : undefined;

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    /* Auto-open the HTML report (and its Trace Viewer links) after every local run; CI has no display, so it stays 'never' there and relies on the uploaded playwright-report/ artifact instead. */
    ['html', { open: process.env.CI ? 'never' : 'always' }],
    /* Machine-readable results, consumed by scripts/generate-traceability-matrix.mjs to derive live status per @TC-### tag. */
    ['json', { outputFile: 'test-results/results.json' }]
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('')`. */
    baseURL,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* Capture a full-page screenshot after every test (viewport only isn't enough to see the whole product grid). */
    screenshot: { mode: 'on', fullPage: true },

    /* Record video, keeping it only for failed tests. */
    video: 'retain-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    /* Runs auth.setup.ts once to produce the Internal Suite's storageState. */
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },

    /* Guest Suite — public storefront, no session/storageState. */
    {
      name: 'chromium',
      testMatch: /guest-storefront\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      testMatch: /guest-storefront\.spec\.ts/,
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      testMatch: /guest-storefront\.spec\.ts/,
      use: { ...devices['Desktop Safari'] },
    },

    /* Internal Suite — authenticated Lightning app, reuses storageState from auth.setup.ts. */
    {
      name: 'chromium-internal',
      testMatch: /internal-app\.spec\.ts/,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: 'playwright/.auth/user.json' },
    },

    {
      name: 'firefox-internal',
      testMatch: /internal-app\.spec\.ts/,
      dependencies: ['setup'],
      use: { ...devices['Desktop Firefox'], storageState: 'playwright/.auth/user.json' },
    },

    {
      name: 'webkit-internal',
      testMatch: /internal-app\.spec\.ts/,
      dependencies: ['setup'],
      use: { ...devices['Desktop Safari'], storageState: 'playwright/.auth/user.json' },
    },

    /* API Suite — direct Salesforce REST API calls via `request`, no
     * browser/page involved. A single project is enough: there's no
     * browser-engine-dependent behavior in raw HTTP calls, unlike the
     * suites above. Auth is a bearer token (pages/apiSession.ts), not
     * storageState, so this has no dependency on `setup`. */
    {
      name: 'api',
      testMatch: /api\.spec\.ts/,
    },

    /* Penetration Suite — guest authorization-boundary tests. Uses a real
     * browser (fresh guest contexts + page.route() tampering), but only
     * one engine: these tests probe server-side authorization enforcement,
     * not rendering, so multiplying across browsers would just be slower
     * without adding coverage. Depends on `setup` so its storageState file
     * exists in time for TC-030, the one test in this suite that needs the
     * internal session (to confirm a guest-submitted XSS payload doesn't
     * execute in an internal agent's view) — every other test here still
     * creates its own fresh, unauthenticated guest context by default;
     * only TC-030 opts into storageState via a per-test `test.use()`. */
    {
      name: 'penetration',
      testMatch: /penetration\.spec\.ts/,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'] },
    },

    /* Accessibility Suite — axe-core scans (WCAG 2.1/2.2 A/AA) against both
     * Guest and Internal pages from a single spec file. One engine only:
     * axe-core evaluates the rendered DOM/ARIA tree, not rendering-engine
     * quirks, so multiplying across browsers wouldn't add coverage. Needs
     * the `setup` dependency + storageState for its Internal-page tests,
     * same as the `-internal` projects above; its Guest-page tests simply
     * don't visit any internal-app URL, so the shared storageState is
     * harmless for those. */
    {
      name: 'accessibility',
      testMatch: /accessibility\.spec\.ts/,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: 'playwright/.auth/user.json' },
    },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
});
