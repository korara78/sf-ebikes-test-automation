# Guide 7: Accessibility Testing

**Project:** Salesforce LWC Test Automation Portfolio (E-Bikes)
**Status:** ✅ Built and verified against the live org — all 6 tests (Accessibility Suite) confirmed passing. Three real WCAG violations were surfaced by the first live scans; the two app-level ones are now fixed in `ebikes-lwc` and confirmed clean, one platform-level one remains a documented, un-fixable-from-this-app Known Gap (see below).

---

## Overview

The Guest, Internal, API, and Penetration Suites (Guides 2–6) all assert *functional* correctness or *authorization* boundaries. None of them ask whether the rendered app is actually usable by someone relying on a screen reader, keyboard-only navigation, or other assistive technology. This guide covers the fifth suite, which does: an **Accessibility Suite** (`tests/accessibility.spec.ts`) that scans representative pages with `@axe-core/playwright` against WCAG 2.1 and 2.2, Level A and AA.

The goal going in was the same posture already established for the Penetration Suite in Guide 6: **run the scan first, unassertive, and see what's actually there** before writing any assertion — not assume a clean result and be surprised, and not write an assertion so loose it can't fail. That exploratory pass (against the live org, not simulated) found three distinct, real violations, none of which were previously known.

---

## Scope and Methodology

```ts
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
expect(results.violations).toEqual([]);
```

Six pages scanned — one `REQ-A11Y-###`/`TC-###` per page, matching this repo's existing one-requirement-per-page/feature granularity rather than one per individual violation:

| Page | Suite | Auth |
|---|---|---|
| Guest catalog (`product-explorer`) | Guest | none |
| Guest Create Case form | Guest | none |
| Internal Product Explorer (product detail open) | Internal | `storageState` |
| Internal Order Builder (new order) | Internal | `storageState` |
| Internal Product record view | Internal | `storageState` |
| Internal Case list | Internal | `storageState` |

A single `chromium` project is enough — like the API and Penetration Suites, axe-core evaluates the rendered DOM/ARIA tree, not rendering-engine-specific behavior, so a 3-browser matrix wouldn't add coverage here.

---

## Findings: App-Owned vs. Platform-Owned

Every violation found carries a **Scope/Owner**, surfaced as its own column in Guide 3's traceability table rather than left buried in a code comment — the point isn't just finding violations, it's being able to tell a reviewer at a glance who's actually responsible for fixing each one.

**App-level (owner: `ebikes-lwc`, fixable in this app's own source) — `button-name`, WCAG 2.1 A, critical — now fixed:**
- The `c-paginator` component's next/previous icon button had no discernible text. One root cause, three pages affected (Guest catalog, Internal Product Explorer, Internal Order Builder all share this component) — the blast radius of a single shared-component defect.
- A second, distinct instance on Product Explorer only: `c-product-card`'s action icon button (`lightning-button-icon[slot="actions"]`), also with no accessible name.

Notably, the paginator gap wasn't a new discovery in the axe-core sense — `pages/ProductCatalogPage.ts`'s own comment on `previousButton`/`nextButton` already documented that these buttons have no accessible name, as a *locator-strategy* workaround (`getByRole` with a name never matches them). Running an actual accessibility scan turned what had been filed as a testing inconvenience into a formally confirmed WCAG violation — and its root cause, once investigated, turned out to be simple: both components rendered `<label>Previous</label>`/`<label>Next</label>`/`<label>Open Record</label>` as slotted child content, but `lightning-button-icon` doesn't recognize a slotted `<label>` as its accessible name at all — the correct API is the `alternative-text` attribute. Fixed in `ebikes-lwc/force-app/main/default/lwc/paginator/paginator.html` and `.../lwc/productCard/productCard.html`, redeployed via `sf project deploy start`, and confirmed clean against the live org (`TC-023`/`TC-026` no longer wrapped in `test.fail()`; `TC-025` narrowed to just its remaining platform-level gap).

`pages/ProductCatalogPage.ts`'s `previousButton`/`nextButton` were updated at the same time, from position-based (`.first()`/`.last()`) to `getByRole('button', { name: 'Previous' | 'Next' })` — now reliable, since a real accessible name exists to match against.

**Platform-level (owner: Salesforce, not fixable from this app's code) — `target-size`, WCAG 2.2 AA, serious:**
- The global `.branding-favorites-star-button` — Salesforce's own "favorite this page" star, part of standard Lightning chrome — is under the WCAG 2.2 minimum touch target size. Appears on every internal page scanned (Product Explorer, Product record, Case list), since it's global UI rendered by the platform itself, not anything this app built or controls. Still an open Known Gap — no `ebikes-lwc` fix is possible for this one.

**Clean:** the Guest Create Case form has zero violations — a real, differentiated result confirming the scan discriminates between pages rather than passing or failing uniformly.

---

## `test.fail()` Semantics, and Why This Suite Doesn't Use `test.fail()`'s Usual Video Trade-off

Every page with a known violation uses the same `test.fail()` convention Guide 3 established for `REQ-CASE-003`: the assertion (`expect(violations).toEqual([])`) genuinely fails today, `test.fail()` declares that as the expected outcome, and if a fix ever lands (in `ebikes-lwc` for an app-level finding, or a Salesforce platform update for a chrome-level one), the row flips to 🔴 Regression in Guide 3's matrix — the live signal to revisit it, not a change that gets silently absorbed.

Each `test.fail()` call carries its own specific reason string naming the exact axe rule, WCAG version/level, severity, and Scope/Owner — not a generic "known gap" — so the reason text itself is enough to understand the finding without cross-referencing this guide or the traceability map.

This is exactly what happened in practice: after fixing the two app-level components and redeploying, re-running `TC-023`/`TC-025`/`TC-026` locally surfaced `Expected to fail, but passed` on the two now-clean pages — caught before committing, not as a silent pass. `test.fail()` was removed from those two, `TC-025`'s reason string was trimmed to only its remaining platform-level gap, and the traceability map's `notes`/`scope` fields were updated to match, all in the same change as the component fix — so the matrix's committed history goes straight from Known Gap to Confirmed, with no intermediate Regression state ever live.

---

## A Real Race Condition Found Building This Suite

The Order Builder scan (`TC-026`) failed intermittently during development — not with a violation-related error, but with `Expected to fail, but passed`, meaning some runs found *zero* violations where others reliably found the known paginator gap.

Root cause: `OrderBuilderPage.createOrder()` only waits for the post-save URL to confirm the new Order__c record page loaded — it doesn't wait for that page's product-tile-list/paginator component (where the violation lives) to actually finish rendering, which happens asynchronously afterward. Scanning immediately after `createOrder()` returns is a real race: sometimes the paginator is already in the DOM, sometimes it isn't yet. This is the same class of async-rendering gap `dragProductIntoOrder()` elsewhere in the same page object already works around, by waiting for `c-product-tile` to be visible first — the accessibility test needed the identical wait, which it didn't originally have.

Fixed by adding `await page.locator('c-product-tile').first().waitFor({ state: 'visible' })` before scanning. Confirmed with `--repeat-each=3` after the fix — consistent across repeats.

---

## Config Wiring

One new `playwright.config.ts` project:

```
accessibility → tests/accessibility.spec.ts (chromium only, depends on `setup`, reuses storageState)
```

It depends on `setup` and reuses the Internal Suite's `storageState` even though its Guest-page tests don't need auth — those tests simply never navigate to an internal-app URL, so the shared session is harmless for them. This avoids splitting the suite across two projects for no real benefit, matching this repo's general bias toward one project per spec file.

CI needs no changes — `.github/workflows/playwright.yml` already runs `npx playwright test` unscoped, so this project runs automatically once pushed.

---

## Verification Notes From the First Live Run

- **Resource contention under heavy local parallelism**, already documented in Guide 6 for the API/Penetration Suites' first full run, recurred here: a full 57-test run at high worker counts produced a handful of unrelated flaky failures (`webkit-internal` timeouts) alongside the real Order Builder race above. `--workers=3` produced a clean, complete run — consistent with Guide 6's existing guidance to rule out contention with a scoped re-run before treating an isolated failure as a regression.
- **The Order Builder race** (above) was only found by actually running the suite repeatedly against the live org — it wouldn't have surfaced from reading the page object's code alone, since `createOrder()`'s existing wait looks sufficient until you know specifically what else on that page renders asynchronously.

---

## What This Unblocked

[Guide 8: Git Workflow (GitHub Flow)](08-git-workflow.md) — all five suites (Guest, Internal, API, Penetration, Accessibility) are now built, wired into CI, and confirmed passing against the live org; Guide 3's traceability tables reflect the current confirmed state. What changed after this guide isn't another suite, but how changes reach `main` at all.
