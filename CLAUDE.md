# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Playwright test automation targeting the [E-Bikes LWC](https://github.com/trailheadapps/ebikes-lwc) sample app (Salesforce Lightning Web Components + Experience Cloud), deployed to a personal Salesforce Developer Edition org. This is a portfolio/demonstration project with two halves documented in `/guides`: (1) standing up the Salesforce environment from source, and (2) building Playwright coverage against it.

The Guest Suite (`tests/guest-storefront.spec.ts`) and Internal Suite (`tests/internal-app.spec.ts`) are built and passing on chromium/firefox/webkit. A standalone API Suite (`tests/api.spec.ts`) and Penetration Suite (`tests/penetration.spec.ts`) — see [Guide 6](guides/06-api-and-authorization-boundary-testing.md) — call Salesforce's REST API directly with no browser involved, and are confirmed passing against the live org. Requirement-level status is tracked in the generated `guides/03-requirements-traceability.md`, not here.

## Commands

```bash
npx playwright test                          # run all tests (all 9 projects)
npx playwright test tests/foo.spec.ts        # run a single file
npx playwright test -g "test name"           # run tests matching a title
npx playwright test --project=chromium       # run a single browser project
npx playwright test --project=chromium-internal  # Internal Suite needs a `-internal` project (see Architecture)
npx playwright test --project=api --project=penetration  # API/Penetration Suites, each a single project
npx playwright test --ui                     # interactive UI mode
npx playwright show-report                   # view the last HTML report
npm run gen:matrix                           # regenerate guides/03-requirements-traceability.md from the latest test-results/results.json
```

All four suites need `E_BIKES_BASE_URL` set to the deployed Experience Cloud site (e.g. `https://<domain>.my.site.com/ebikes/s/`); the Internal Suite and API Suite additionally need the `sf` CLI already authenticated locally against the target org (alias `mydevorg` by default, overridable via `SF_TARGET_ORG`) — the Internal Suite for `storageState`, the API Suite for a bearer token (`pages/apiSession.ts`). The Penetration Suite needs both `E_BIKES_BASE_URL` and `sf` CLI auth too (it queries the org via SOQL to find a "foreign" record), but deliberately never authenticates as anything but a guest in-browser.

Install/setup (from `guides/01-environment-setup.md`):

```bash
npm install
npx playwright install --with-deps   # browser binaries; CI does this on every run
```

## Architecture

- `playwright.config.ts` — `testDir: './tests'`, `fullyParallel: true`, `baseURL` read from `E_BIKES_BASE_URL` (the guest community domain), HTML + JSON reporters (the JSON output feeds `gen:matrix`), full-page screenshot on every run, video retained on failure, trace on first retry.
- Nine projects: `setup` (runs `auth.setup.ts`), `chromium`/`firefox`/`webkit` scoped to `guest-storefront.spec.ts` (Guest Suite, no auth), `chromium-internal`/`firefox-internal`/`webkit-internal` scoped to `internal-app.spec.ts` (Internal Suite — depends on `setup`, reuses its `storageState`), and single-browser `api`/`penetration` projects scoped to `api.spec.ts`/`penetration.spec.ts` respectively (neither depends on `setup` — API Suite auth is a bearer token, Penetration Suite is deliberately unauthenticated throughout). No mobile or branded-browser projects are enabled.
- CI (`.github/workflows/playwright.yml`) runs on push/PR to `main`/`master`, unscoped (`npx playwright test`, all 9 projects — all four suites). It installs the `sf` CLI and authenticates via JWT Bearer Flow (a dedicated Connected App, `SF_CONSUMER_KEY`/`SF_JWT_KEY`/`SF_USERNAME`/`SF_LOGIN_URL` repo secrets), aliased as `mydevorg` so `auth.setup.ts` (and `pages/apiSession.ts`'s bearer-token lookup) pick it up with no further config — see the "JWT Bearer Flow for CI" section of Guide 4.
- **Auth strategy (see `guides/04-authentication-test-session-strategy.md`):** two separate mechanisms depending on environment. Locally, `tests/auth.setup.ts` sidesteps Salesforce login/MFA entirely by piggybacking on the `sf` CLI's existing authenticated session — `sf org open --url-only --json -p lightning` exchanges the CLI's OAuth token for a single-use frontdoor bridge URL, which Playwright visits once to capture `storageState`. It also persists the internal Lightning app's origin (a different domain than `E_BIKES_BASE_URL`) to `playwright/.auth/lightning-origin.json` via `pages/internalSession.ts`'s `readInternalOrigin()`, since Internal Suite page objects need absolute URLs. In CI, a JWT Bearer Flow Connected App (`CI_JWT_Auth`, deployed as metadata in the separate `ebikes-lwc` project) establishes the equivalent `sf`-CLI-authenticated session non-interactively, which `auth.setup.ts` then uses identically — it has no CI-specific branching.
- The target application's data model (for context when writing assertions/selectors): `Product__c`, `Product_Family__c`, `Order__c`, `Order_Item__c`, plus a public guest storefront (product browsing, case submission via a "Create Case" LWC component) and an internal Lightning app (Case list, Product Explorer, Reseller Orders/Order Builder, Product records).
- All four suites create real records in the live org; only the API Suite cleans up after itself (its own dedicated delete test) — every other created record (Cases, Orders/Order Items, a Product field edit) is left behind, accepted as normal accumulation for this portfolio org, not treated as a bug.
- **API/Penetration suites (see [Guide 6](guides/06-api-and-authorization-boundary-testing.md)):** E-Bikes has no custom `@RestResource` Apex endpoint — its only server-side surface is three read-only `@AuraEnabled` methods, and every mutation goes through Salesforce's standard Lightning Data Service REST/UI API. The API Suite exercises that standard REST API directly (bearer token via `pages/apiSession.ts`); the Penetration Suite tests specific guest-profile authorization boundaries read from the org's guest profile metadata (in the sibling `ebikes-lwc` checkout) rather than generic endpoint checks.

## Notes from the environment guide worth knowing when working here

- The Salesforce org and E-Bikes deployment live outside this repo (a personal Developer Edition org) — this repo only contains the test automation, not the application source or org config.
- Local dev is done inside WSL2/Ubuntu (not native Windows) to match CI's Linux environment; keep this in mind if suggesting OS-specific tooling.
