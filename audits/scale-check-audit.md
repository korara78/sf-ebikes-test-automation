# Scale Check Audit

**Date:** August 4, 2026
**Suite size at time of audit:** 31 tests across 6 spec files, running across up to 6 browser projects (10 Playwright projects total)

## Purpose

A periodic check against a standard list of scaling levers for browser-based test suites — session reuse, data isolation, locator strategy, parallelization, CI performance, and test tiering. Not every lever applies at every suite size; the point of this audit is to confirm which ones are already in place, which are worth adopting now versus later, and which would be premature for a suite this size. Each row below was verified against the actual repository rather than taken at face value.

## Findings

| Lever | Status (verified) | When it matters | Outcome |
|---|---|---|---|
| Session reuse (`storageState`) | Confirmed built | Now — every Internal/API test benefits | No action needed. `storageState: 'playwright/.auth/user.json'` is wired into every project that needs an authenticated session. |
| Per-test data isolation | Confirmed built | Now — prevents collision at any scale | No action needed. `pages/productFixture.ts` creates/deletes per-test `Product__c` records; see the FUSE X1 incident writeup in [Guide 2](../guides/02-test-plan.md) for the history behind this. |
| Data seeding (stable, read-only reference data) | Confirmed built | Now — every test relying on Products/Accounts/etc. | No action needed. |
| Fast state creation (API-first setup) | Confirmed partially built | Now — worth expanding deliberately as the suite grows | No action needed yet. `productFixture.ts` and the API Suite's Case creation are the current examples; expand this pattern as new mutation-heavy tests are added, rather than defaulting to UI-driven setup. |
| Flake-resistant locators (semantic, not positional) | Was partial, not a standing rule | Now — cost compounds silently as tests accumulate | Codified as a standing rule. See [Standing rules implemented](#standing-rules-implemented) below. |
| Component-based Page Object Model | Confirmed built | Now — determines how cheaply the suite absorbs UI changes | No action needed. `pages/` already maps closely to the app's LWCs. |
| Actionable layouts (respecting Playwright's actionability checks) | Was implicit, not a standing rule | Now — root cause of a flake class distinct from locator fragility | Codified as a standing rule, and the one concrete violation found (`OrderBuilderPage.ts`'s bare `waitForTimeout(500)`) was fixed. See [Standing rules implemented](#standing-rules-implemented) below. |
| Multiple local workers | Available, `workers: 1` in CI | Once suite grows past ~50-100 tests | No action. Suite is 31 tests, well under threshold. |
| Browser/dependency caching | Confirmed missing | As soon as you want faster CI, independent of test count | Implemented. See [CI caching](#ci-caching) below. |
| Sharding across CI jobs | Not yet needed | Hundreds of tests, not dozens | No action. Suite is an order of magnitude below this threshold. |
| Smoke vs. full regression tiering | Not yet needed | Once full-suite runtime becomes genuinely painful on every push | No action. Current CI runtime (~7 minutes) doesn't warrant this yet. |

## Standing rules implemented

Two conventions the code already mostly followed but never stated explicitly, now written down in [Guide 2](../guides/02-test-plan.md#locator-strategy) and pointed to from `CLAUDE.md` so they apply to future work automatically:

- **Semantic locators first, CSS class only as a documented last resort.** A CSS class selector is acceptable only when a Salesforce/LWC element genuinely has no accessible role or name, and the comment introducing it has to say so explicitly.
- **No bare `page.waitForTimeout()`.** When there's a genuine settling condition Playwright's built-in actionability checks don't cover, wait on that condition explicitly — `expect.poll()`, or the new `pages/actionability.ts` helper `waitForStableLayout()`.

The concrete fix that motivated the second rule — `OrderBuilderPage.ts`'s `page.waitForTimeout(500)` for a Firefox-specific modal-settling race — was replaced with `waitForStableLayout()` and confirmed against the live org: `TC-013` passed 5/5 on `--project=firefox-internal --repeat-each=5`, no flake.

Shipped in [PR #9](https://github.com/korara78/sf-ebikes-test-automation/pull/9).

## CI caching

`npx playwright install --with-deps` was re-downloading several hundred MB of browser binaries from scratch on every single PR run, independent of test count — the one lever on this list that pays off regardless of suite size. `actions/setup-node` now caches `npm ci`, and a new `actions/cache` step caches `~/.cache/ms-playwright`, both keyed on `package-lock.json`'s hash.

Shipped in [PR #10](https://github.com/korara78/sf-ebikes-test-automation/pull/10).

## Deferred, not neglected

Multiple local workers, CI sharding, and smoke/regression tiering are all real levers this project will eventually need — they're deferred because the suite (31 tests, ~7-minute CI runtime) hasn't reached the size where they pay for their own complexity, not because they were overlooked. Worth revisiting this audit as the suite grows past the thresholds listed above.
