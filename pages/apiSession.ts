import { execFileSync } from 'node:child_process';
import type { APIRequestContext } from '@playwright/test';

/**
 * Bearer-token session for the standalone API Suite (tests/api.spec.ts).
 *
 * Every other suite in this repo drives a browser (cookie-based
 * storageState for the Internal Suite, no session at all for the Guest
 * Suite). The API Suite instead calls Salesforce's REST/UI API directly
 * with an OAuth access token, read off the already-authenticated `sf` CLI
 * session (the same `mydevorg` alias every other file in this repo
 * defaults to) — no separate login step or connected app needed.
 *
 * Confirmed against the live org: `sf org display`, even with `--verbose`,
 * no longer includes the real `accessToken` in its JSON output on current
 * CLI versions — it's replaced with a literal
 * `"[REDACTED] Use 'sf org auth show-access-token' to view"` placeholder
 * string (a deliberate CLI security change, per its own warning: "Secrets
 * are now hidden from 'sf org display' command output"). Blindly sending
 * that placeholder as a bearer token produces a uniform 401 on every
 * authenticated call — exactly what happened on the first real run of
 * this suite. The actual token requires the dedicated
 * `sf org auth show-access-token` command, which still requires `--json`
 * (or `--no-prompt`) to skip its own separate confirmation prompt.
 * `instanceUrl` isn't considered sensitive and is still returned normally
 * by `org display`, so that part is unaffected.
 */

const SF_TARGET_ORG = process.env.SF_TARGET_ORG ?? 'mydevorg';

export interface ApiSession {
  accessToken: string;
  instanceUrl: string;
}

export function getApiSession(): ApiSession {
  const displayRaw = execFileSync(
    'sf',
    ['org', 'display', '--json', '-o', SF_TARGET_ORG],
    { encoding: 'utf-8', env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' } }
  );
  const { result: display } = JSON.parse(displayRaw) as {
    result: { instanceUrl: string };
  };

  const tokenRaw = execFileSync(
    'sf',
    ['org', 'auth', 'show-access-token', '-o', SF_TARGET_ORG, '--json'],
    { encoding: 'utf-8', env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' } }
  );
  const { result: token } = JSON.parse(tokenRaw) as {
    result: { accessToken: string };
  };

  return {
    accessToken: token.accessToken,
    instanceUrl: display.instanceUrl.replace(/\/+$/, '')
  };
}

/**
 * Resolves the current highest REST API version rather than hardcoding one
 * (`GET /services/data/` — no version prefix — is Salesforce's own
 * unauthenticated listing of every version the org supports, returned
 * oldest-first). Avoids the suite silently pinning to a version that goes
 * stale as the org gets upgraded.
 */
export async function getLatestApiRoot(
  request: APIRequestContext,
  instanceUrl: string
): Promise<string> {
  const res = await request.get(`${instanceUrl}/services/data/`);
  const versions = (await res.json()) as { url: string }[];
  return `${instanceUrl}${versions[versions.length - 1].url}`;
}
