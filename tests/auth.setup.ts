import { test as setup, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { authFile, originFile } from '../pages/internalSession';

/**
 * Internal Suite auth setup.
 *
 * Rather than driving the Salesforce login UI (and whatever MFA the org
 * enforces), this piggybacks on the `sf` CLI's already-authenticated
 * session: `sf org open --url-only` exchanges the CLI's OAuth access token
 * for a single-use frontdoor.jsp bridge URL (valid ~60s, one navigation
 * only) via Salesforce's Single Access UI Bridge API. Visiting it lands an
 * already-logged-in Lightning session, which we then persist via
 * storageState for the Internal Suite projects to reuse.
 *
 * Requires: `sf` CLI authenticated against the target org (see Guide 1).
 *
 * Also persists the internal Lightning app's origin (see
 * `pages/internalSession.ts`): `playwright.config.ts`'s `baseURL` is the
 * guest Experience Cloud community domain, but the internal Lightning app
 * lives on a completely different origin
 * (`https://<org>.lightning.force.com`), which Internal Suite page objects
 * need as an absolute URL.
 */

const targetOrg = process.env.SF_TARGET_ORG ?? 'mydevorg';

setup('authenticate via sf CLI frontdoor bridge', async ({ page }) => {
  const raw = execFileSync(
    'sf',
    ['org', 'open', '--url-only', '--json', '-o', targetOrg, '-p', 'lightning'],
    {
      encoding: 'utf-8',
      // The Playwright test runner's environment forces color output even
      // with --json, wrapping the JSON in ANSI escape codes; disable it so
      // the output is parseable.
      env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
    }
  );
  const { result } = JSON.parse(raw) as { result: { url: string } };

  await page.goto(result.url);
  await expect(page).toHaveURL(/\/lightning\//, { timeout: 15_000 });

  mkdirSync(path.dirname(authFile), { recursive: true });
  await page.context().storageState({ path: authFile });
  writeFileSync(originFile, JSON.stringify({ origin: new URL(page.url()).origin }));
});
