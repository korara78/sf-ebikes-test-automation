# Guide 4: Authentication & Test Session Strategy

**Project:** Salesforce LWC Test Automation Portfolio (E-Bikes)
**Status:** ✅ Built and verified against the live org — `auth.setup.ts` produces a working authenticated session for local runs, and a separate JWT Bearer Flow Connected App now authenticates CI the same way (see [JWT Bearer Flow for CI](#jwt-bearer-flow-for-ci) below)

---

## Overview

The Internal Suite needs a logged-in Lightning session, but driving the login UI directly — typing a username/password and handling whatever MFA challenge the org presents — is slow and brittle to repeat on every test run. This guide covers the approach actually built: reusing the `sf` CLI's existing authenticated session to mint a one-time login URL, rather than automating any login form.

### Why this approach, and not the alternatives

| Option | Verdict |
|---|---|
| **Drive the login UI + MFA** | Rejected — brittle, and MFA specifically is what this needs to avoid repeating per run. |
| **SAML SSO** | Solves a different problem (external identity provider federation for Experience Cloud sites); not relevant to an internally-authenticated dev-org user. |
| **JWT bearer flow / dedicated connected app** | No real benefit for *local* runs on a single personal dev org — but it's exactly the right tool for CI, which has no interactive `sf` session to piggyback on. Built as a second, CI-only auth path; see below. |
| **CLI-piggybacked frontdoor bridge (chosen for local runs)** | The `sf` CLI already holds a valid, MFA-cleared session for this org (from `sf org login web` in Guide 1). Exchange it for a one-time login URL and reuse it — no new secrets, no UI automation. |

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

## JWT Bearer Flow for CI

The local approach above depends on the `sf` CLI already holding an interactively-established, MFA-cleared session — there's no equivalent to piggyback on in a GitHub Actions runner. Rather than embed that same standing local credential as a CI secret (the "not a pattern to carry into CI" caveat flagged in the original Security Notes below), CI gets its own, narrower-scoped, independently-revocable credential: a **Connected App using the JWT Bearer Flow**, Salesforce's standard headless-auth mechanism for service accounts.

**What was built, entirely as deployable metadata rather than clicked through Setup UI** (matching how Guide 1 built the rest of the org):

1. A 2048-bit RSA key pair + self-signed certificate (`openssl genrsa` / `openssl req -x509`), generated locally and never committed to either repo.
2. A `ConnectedApp` metadata component (`force-app/main/default/connectedApps/CI_JWT_Auth.connectedApp-meta.xml`) in the `ebikes-lwc` source project, embedding the certificate's public half, `Api`/`RefreshToken`/`Web` OAuth scopes, `isAdminApproved: true`, and `<profileName>System Administrator</profileName>` to pre-authorize the CLI-authenticated user's profile — deployed via `sf project deploy start -m "ConnectedApp:CI_JWT_Auth"`.
3. One step that genuinely can't be automated: retrieving the Consumer Key requires clicking **Manage Consumer Details** in Setup and passing an email/authenticator verification challenge — a deliberate Salesforce security control specifically to prevent this from being scripted.
4. Four GitHub Actions repo secrets: `SF_CONSUMER_KEY`, `SF_JWT_KEY` (the private key), `SF_USERNAME`, `SF_LOGIN_URL`.
5. A new CI step (`.github/workflows/playwright.yml`) that writes the key to a runner-local file, runs `sf org login jwt --alias mydevorg`, and deletes the key file — aliased as `mydevorg` specifically so `auth.setup.ts`'s default `SF_TARGET_ORG` picks it up with no code changes.

Confirmed locally before touching CI at all: both `sf org login jwt` and the frontdoor-bridge command `auth.setup.ts` actually calls (`sf org open --url-only -p lightning`) succeed against the resulting JWT-authenticated session, with no consent prompt (thanks to the pre-authorized profile).

With this in place, `npx playwright test` in CI now runs unscoped — all 7 projects, Guest and Internal Suite alike — rather than the Guest-Suite-only `--project` flags from before.

---

## Security Notes

- **`storageState` is itself a bearer credential.** Anyone with `playwright/.auth/user.json` can replay this session until it expires. It's already covered by `.gitignore` (`/playwright/.auth/`) from the default Playwright scaffold — that must stay in place.
- **The `sf` CLI's stored refresh token is a standing local credential.** This whole local-run approach works because the CLI already holds long-lived auth for `mydevorg`. Fine for a personal dev org on a single machine; deliberately *not* the mechanism carried into CI — see [JWT Bearer Flow for CI](#jwt-bearer-flow-for-ci) above for the credential actually used there.
- **The OAuth token backing the bridge URL has whatever scope the CLI's connected app grants** (typically broader than "open the UI"), not scoped down to just this operation. Not exploitable on its own, but worth naming: the credential in play is more powerful than the operation it's being used for.
- **Single Access UI Bridge explicitly rejects "API Only User" permission.** Irrelevant today since the CLI-authenticated user is a normal admin, but would silently break this if `auth.setup.ts` were ever pointed at a locked-down integration user instead.
- **The JWT private key is scoped to one Connected App and independently revocable** by deleting/deactivating `CI_JWT_Auth` in Setup, without touching the personal `sf org login web` session the local workflow depends on.

---

## What This Unblocked

Per [Guide 3](03-requirements-traceability.md), this session strategy is what made `tests/internal-app.spec.ts` possible — all four Internal Suite requirements (REQ-CASE-001, REQ-PRODUCT-001, REQ-PRODUCT-002, REQ-ORDER-001) are now ✅ Confirmed against the live org. The JWT Bearer Flow addition above extends that same coverage into CI, which previously ran the Guest Suite only.

---

## Next Guide

[Guide 5: Visual Reporting & Trace Debugging](05-visual-reporting-and-debugging.md) — screenshot/video/trace capture config and the troubleshooting workflow, applying to both suites.
