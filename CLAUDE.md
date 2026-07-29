# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Playwright test automation targeting the [E-Bikes LWC](https://github.com/trailheadapps/ebikes-lwc) sample app (Salesforce Lightning Web Components + Experience Cloud), deployed to a personal Salesforce Developer Edition org. This is a portfolio/demonstration project with two halves documented in `/guides`: (1) standing up the Salesforce environment from source, and (2) building Playwright coverage against it.

The project is in early scaffold state — `tests/example.spec.ts` is still the default `npm init playwright@latest` starter test (points at playwright.dev, not the E-Bikes app) and `package.json` has no scripts defined yet. Expect to replace/extend both as real E-Bikes tests are added.

## Commands

No npm scripts are defined — use the Playwright CLI directly:

```bash
npx playwright test                    # run all tests (chromium, firefox, webkit)
npx playwright test tests/foo.spec.ts  # run a single file
npx playwright test -g "test name"     # run tests matching a title
npx playwright test --project=chromium # run a single browser project
npx playwright test --ui               # interactive UI mode
npx playwright show-report             # view the last HTML report
```

Install/setup (from `guides/01-environment-setup.md`):

```bash
npm install
npx playwright install --with-deps   # browser binaries; CI does this on every run
```

## Architecture

- `playwright.config.ts` — still the unmodified scaffold defaults: `testDir: './tests'`, `fullyParallel: true`, HTML reporter, retries/single-worker only under `CI`, trace on first retry. No `baseURL` and no `webServer` are configured yet — the target is a live, already-deployed Salesforce Experience Cloud site (not a local dev server), so tests currently need a full URL in each `page.goto()` until a `baseURL` is wired in.
- Seven projects in `playwright.config.ts`: `setup` (runs `auth.setup.ts`), `chromium`/`firefox`/`webkit` scoped to `guest-storefront.spec.ts` (Guest Suite, no auth), and `chromium-internal`/`firefox-internal`/`webkit-internal` scoped to `internal-app.spec.ts` (Internal Suite — depends on `setup`, uses the saved `storageState`; the spec file itself doesn't exist yet, so these currently match zero tests). No mobile or branded-browser projects are enabled.
- CI (`.github/workflows/playwright.yml`) runs on push/PR to `main`/`master`: `npm ci` → install browsers → `npx playwright test` → uploads `playwright-report/` as an artifact. There is no Salesforce org credential wiring in CI yet — the auth strategy below currently only works locally, since it depends on the `sf` CLI already being authenticated on the machine running the tests.
- **Auth strategy (built, see `guides/04-authentication-test-session-strategy.md`):** `tests/auth.setup.ts` sidesteps Salesforce login/MFA entirely by piggybacking on the `sf` CLI's existing authenticated session — `sf org open --url-only --json -p lightning` exchanges the CLI's OAuth token for a single-use frontdoor bridge URL, which Playwright visits once to capture `storageState`. Wired in as a Playwright `setup` project dependency in `playwright.config.ts`, not ad hoc per-test login.
- The target application's data model (for context when writing assertions/selectors): `Product__c`, `Product_Family__c`, `Order__c`, `Order_Item__c`, plus a public guest storefront (product browsing, case submission via a "Create Case" LWC component) and an internal Lightning app.

## Notes from the environment guide worth knowing when working here

- The Salesforce org and E-Bikes deployment live outside this repo (a personal Developer Edition org) — this repo only contains the test automation, not the application source or org config.
- Local dev is done inside WSL2/Ubuntu (not native Windows) to match CI's Linux environment; keep this in mind if suggesting OS-specific tooling.
