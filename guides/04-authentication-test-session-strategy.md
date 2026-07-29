# Guide 4: Authentication & Test Session Strategy

**Project:** Salesforce LWC Test Automation Portfolio (E-Bikes)
**Status:** ✅ Built and verified against the live org — `auth.setup.ts` produces a working authenticated session; the Internal Suite test files that will consume it don't exist yet (see [Guide 2](02-test-plan.md))

---

## Overview

The Internal Suite needs a logged-in Lightning session, but driving the login UI directly — typing a username/password and handling whatever MFA challenge the org presents — is slow and brittle to repeat on every test run. This guide covers the approach actually built: reusing the `sf` CLI's existing authenticated session to mint a one-time login URL, rather than automating any login form.

### Why this approach, and not the alternatives

| Option | Verdict |
|---|---|
| **Drive the login UI + MFA** | Rejected — brittle, and MFA specifically is what this needs to avoid repeating per run. |
| **SAML SSO** | Solves a different problem (external identity provider federation for Experience Cloud sites); not relevant to an internally-authenticated dev-org user. |
| **JWT bearer flow / dedicated connected app** | The production-grade approach for service accounts, but adds a certificate/connected-app setup step with no real benefit for a single personal dev org. |
| **CLI-piggybacked frontdoor bridge (chosen)** | The `sf` CLI already holds a valid, MFA-cleared session for this org (from `sf org login web` in Guide 1). Exchange it for a one-time login URL and reuse it — no new secrets, no UI automation. |

This works because the CLI's OAuth access token can be exchanged for a **Single Access UI Bridge** URL — Salesforce's supported mechanism for bridging an existing authenticated session into a browser UI session without re-entering credentials. It's the same family of mechanism as the classic `frontdoor.jsp?sid=...` trick, but using a single-use, time-boxed token instead of a long-lived session ID embedded in a URL.

---

## The Mechanism

```bash
sf org open --url-only --json -o mydevorg -p lightning
```

This returns JSON like:

```json
{
  "status": 0,
  "result": {
    "orgId": "00Dbm00000rLeqNEAS",
    "url": "https://<my-domain>.my.salesforce.com/secur/frontdoor.jsp?otp=...&startURL=lightning&cshc=...",
    "username": "..."
  }
}
```

- `otp` is a one-time token, not a raw session ID — it's valid for about 60 seconds and can be used exactly once.
- `-p lightning` sets `startURL=lightning` so the bridge lands in Lightning Experience rather than this org's default (which turned out to be the Classic `/home/home.jsp` page — see below).
- No credentials, connected app, or secrets file are involved. The whole thing rides on the CLI's already-established auth for `mydevorg`.

`tests/auth.setup.ts` runs this command, navigates to the returned URL, confirms landing in `/lightning/`, and persists the resulting session via Playwright's `storageState`:

```ts
setup('authenticate via sf CLI frontdoor bridge', async ({ page }) => {
  const raw = execFileSync(
    'sf',
    ['org', 'open', '--url-only', '--json', '-o', targetOrg, '-p', 'lightning'],
    { encoding: 'utf-8', env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' } }
  );
  const { result } = JSON.parse(raw) as { result: { url: string } };

  await page.goto(result.url);
  await expect(page).toHaveURL(/\/lightning\//, { timeout: 15_000 });

  mkdirSync(path.dirname(authFile), { recursive: true });
  await page.context().storageState({ path: authFile });
});
```

---

## Two Issues Found Only By Running It Against the Live Org

Neither of these was predictable from reading the CLI docs alone:

1. **`--json` output arrives wrapped in ANSI color codes.** Inside the Playwright test runner's environment, `sf`'s JSON formatter still colorizes its output despite `--json`, which broke `JSON.parse` with `SyntaxError: Unexpected token '', "{"... is not valid JSON`. Fixed by forcing `FORCE_COLOR=0` and `NO_COLOR=1` on the subprocess environment.
2. **The frontdoor URL didn't land in Lightning by default.** Without an explicit target path, this org redirected to the Classic `/home/home.jsp` page instead. Fixed with `sf org open`'s `-p lightning` flag, which embeds `startURL=lightning` in the generated URL.

Confirmed working: the resulting `storageState` file contains 27 real session cookies spanning the `salesforce.com`, `force.com`, and `lightning.force.com` domains for this org.

---

## Config Wiring

`playwright.config.ts` adds a `setup` project that runs only `auth.setup.ts`, and splits the browser projects by suite via `testMatch`:

```
setup                              → tests/auth.setup.ts (no storageState)
chromium / firefox / webkit        → guest-storefront.spec.ts (Guest Suite, no storageState)
chromium-internal / firefox-internal / webkit-internal
                                    → internal-app.spec.ts (Internal Suite)
                                      dependencies: ['setup']
                                      use: { storageState: 'playwright/.auth/user.json' }
```

The `-internal` projects currently match zero tests, since `internal-app.spec.ts` doesn't exist yet — they're wired in ahead of that file being written, per the compartmentalization described in Guide 2: each suite that needs a distinct identity gets its own setup + `storageState` + scoped test-file match, so a future security-focused suite (a different user, or no auth at all) can be added the same way without touching this one.

---

## Security Notes

- **`storageState` is itself a bearer credential.** Anyone with `playwright/.auth/user.json` can replay this session until it expires. It's already covered by `.gitignore` (`/playwright/.auth/`) from the default Playwright scaffold — that must stay in place.
- **The `sf` CLI's stored refresh token is a standing local credential.** This whole approach works because the CLI already holds long-lived auth for `mydevorg`. Fine for a personal dev org on a single machine; not a pattern to carry into a shared or CI environment without reconsidering.
- **The OAuth token backing the bridge URL has whatever scope the CLI's connected app grants** (typically broader than "open the UI"), not scoped down to just this operation. Not exploitable on its own, but worth naming: the credential in play is more powerful than the operation it's being used for.
- **Single Access UI Bridge explicitly rejects "API Only User" permission.** Irrelevant today since the CLI-authenticated user is a normal admin, but would silently break this if `auth.setup.ts` were ever pointed at a locked-down integration user instead.

---

## What This Unblocks

Per [Guide 3](03-requirements-traceability.md), this clears the way for the Internal Suite's requirements (REQ-CASE-001, REQ-PRODUCT-001, REQ-PRODUCT-002, REQ-ORDER-001) — but they stay 🚧 **Deferred** until `internal-app.spec.ts` is actually written against this session, not just because the auth mechanism now exists.

---

## Next Guide

Writing `internal-app.spec.ts` against the Internal Suite requirements from Guide 2, using the `chromium-internal`/`firefox-internal`/`webkit-internal` projects now wired up here.
