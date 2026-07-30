# Guide 3: Requirements Traceability

**Project:** Salesforce LWC Test Automation Portfolio (E-Bikes)
<!-- LTM:SUMMARY:START -->
**Status:** 7/8 Guest Suite requirements confirmed — matrix auto-generated 7/29/2026, 7:21 PM from the latest test run
<!-- LTM:SUMMARY:END -->

---

## Overview

This is a **Living Traceability Matrix** — the tables below are generated, not hand-edited. Each requirement maps to one or more Guest Suite or Internal Suite test cases from [Guide 2](02-test-plan.md), and Status is derived automatically from the latest Playwright test run rather than typed in by hand.

**How it works:**
- `guides/traceability-map.mjs` is the hand-maintained source of truth: each requirement's ID, its linked `TC-###` test ID(s), and curated investigation notes.
- Each `TC-###` is a Playwright tag (`{ tag: '@TC-###' }`) on the corresponding `test()` in the spec file, filterable directly (`npx playwright test --grep @TC-005`) and shown as a pill in the HTML report.
- `npm run gen:matrix` reads the map file plus `test-results/results.json` (the JSON reporter's output from the most recent run) and regenerates the tables below, matching each row's `TC-###` against Playwright's own per-test `ok` / `expectedStatus` fields.
- Requirement IDs (`REQ-####`) are intentionally *not* tagged in test code — they live only in `traceability-map.mjs`, keeping the test files themselves free of business-requirement references.
- The generator also cross-checks the map against the spec files and surfaces any drift (a tagged test with no linked requirement, or a mapped requirement whose test no longer exists) directly in this document — see below if a warning is present.

**Status legend (derived, not manual):**
- ✅ **Confirmed** — last run passed, matching its expected outcome
- ❌ **Known Gap** — last run failed, but that failure is the *expected* outcome (the test is wrapped in `test.fail()`, documenting a real platform gap rather than papering over it)
- 🔴 **Regression** — last run's result didn't match what was expected, in either direction — including a Known Gap test that started *unexpectedly passing*, which is exactly the signal to revisit that requirement
- ⚪ **Not Run** — no matching result in the latest `test-results/results.json`
- 🚧 **Deferred** — no test exists yet (Internal Suite, blocked on `auth.setup.ts`)

<!-- LTM:DRIFT:START -->

<!-- LTM:DRIFT:END -->

---

## Guest Suite — Guest Storefront

<!-- LTM:GUEST:START -->
| ID | Test&nbsp;ID | Requirement | Status | Notes |
|---|---|---|---|---|
| REQ-CATALOG-001 | TC-001 | Product catalog loads; page 1 shows 9 of 16 products, paging to page 2 shows the remaining 7 | ✅ Confirmed | _Last run: 7/29/2026, 7:18 PM — 3 browsers._<br>Pagination text and the tile list update via two independent async paths — the page-count text advances on click before the tile list has actually refetched from Apex. `ProductCatalogPage.expectTileCount()` polls (`expect.poll`, 15s) instead of asserting the count once. |
| REQ-CATALOG-002 | TC-002 | Clicking a product shows its correct Name and MSRP | ✅ Confirmed | _Last run: 7/29/2026, 7:18 PM — 3 browsers._<br>There is no separate detail page/URL — Product Explorer is a master-detail split layout; clicking a tile updates a third `<article>` panel in place on the same page. `ProductDetailPage` scopes its heading/MSRP locators to that panel. |
| REQ-CATALOG-003 | TC-003, TC-004 | Category filter narrows the catalog to the exact expected count | ✅ Confirmed | _Last run: 7/29/2026, 7:18 PM — 3 browsers._<br>SLDS renders a styled `span.slds-checkbox` on top of the native input that intercepts pointer events. Even `force: true` clicks land on the same covered coordinate and never flip the checked state. Clicking the visible label text instead works (real label-click forwarding). |
| REQ-CATALOG-004 | TC-005, TC-006 | Level filter narrows the catalog to the exact expected count | ✅ Confirmed | _Last run: 7/29/2026, 7:18 PM — 3 browsers._<br>Same checkbox/label-click fix as REQ-CATALOG-003. |
| REQ-CATALOG-005 | TC-007 | Search box narrows results by product name | ✅ Confirmed | _Last run: 7/29/2026, 7:19 PM — 3 browsers._<br>— |
| REQ-CASE-002 | TC-008 | Submitting Create Case as a guest with all fields filled succeeds | ✅ Confirmed | _Last run: 7/29/2026, 7:19 PM — 3 browsers._<br>Functionally works, but the UI shows a known cosmetic error despite successful creation. **Root cause:** Salesforce automatically reassigns a guest-created record's owner to the org's configured default Case owner immediately on creation (mandatory guest-sharing security behavior). This races the client's post-save callback, which intermittently reports `"The requested resource does not exist"` (`NOT_FOUND`, HTTP 200 wrapping an Aura action-level error) instead of the success toast. **Verified two ways:** (1) direct SOQL query against the org found every test submission — including ones made before any config changes — successfully created as a Case, `CreatedBy = "E-Bikes Site Guest User"`, `Owner` reassigned to the org's default owner; (2) the exact failing `createRecord` request/response pair was captured and inspected (see conversation history for the full decoded payload). Test now asserts the outgoing `createRecord` request contains the exact submitted field values, not the unreliable toast. |
| REQ-CASE-003 | TC-009 | Submitting Create Case with required fields empty shows validation and does not create a case | ❌ Known Gap | _Last run: 7/29/2026, 7:19 PM — 3 browsers._<br>Subject/Description are not enforced as required fields on this org's Create Case form. Distinct finding from REQ-CASE-002: this isn't a UI-feedback race, there's no validation to race with. Confirmed via SOQL: multiple blank-`Subject` Cases exist from guest submissions, and network capture shows the `createRecord` request fires identically whether or not Subject/Description are filled. Test is wrapped in `test.fail()`, so a passing run here means the gap is still present — if the org's validation is ever fixed, this row will flip to 🔴 Regression, which is the live signal to revisit this requirement. |
| REQ-GUEST-001 | TC-010 | Guest sees a Login option and no authenticated-only content | ✅ Confirmed | _Last run: 7/29/2026, 7:19 PM — 3 browsers._<br>The control is a `button "Log in"` (lowercase "in"), not a `link "Log In"` as originally assumed. |
<!-- LTM:GUEST:END -->

---

## Internal Suite — Internal Lightning App (deferred)

<!-- LTM:INTERNAL:START -->
| ID | Test&nbsp;ID | Requirement | Status | Notes |
|---|---|---|---|---|
| REQ-CASE-001 | — | A case submitted as a guest actually appears in the internal Case list | 🚧 Deferred | Blocked on `auth.setup.ts`. Already indirectly evidenced: SOQL queries used to verify REQ-CASE-002 confirm guest-submitted Cases are visible internally with ownership reassigned, but no Playwright test exercises the internal Lightning UI yet. |
| REQ-PRODUCT-001 | — | Product Explorer loads real product data for an internal user | 🚧 Deferred | — |
| REQ-ORDER-001 | — | An internal user can build an order via the `orderBuilder` component | 🚧 Deferred | — |
| REQ-PRODUCT-002 | — | An internal user can view/edit a Product record | 🚧 Deferred | — |
<!-- LTM:INTERNAL:END -->

---

## How REQ-CASE-002 / REQ-CASE-003 Were Investigated

Both findings came from live-org investigation that went beyond what static code-reading or CI logs alone could show:

1. Ran the actual test suite locally against the live org (`E_BIKES_BASE_URL=... npx playwright test`) instead of only iterating through CI, to get fast feedback while debugging.
2. Captured full request/response payloads for the failing `createRecord` Aura action directly (Playwright's `page.on('response')`), rather than guessing from the UI error text alone.
3. Used the already-authenticated `sf` CLI (`sf data query --target-org mydevorg`) to run SOQL directly against the org and confirm actual record state — the only way to distinguish "the record wasn't created" from "the record was created but the UI lied about it."
4. Deliberately tested the "blank fields" scenario the same way, which is what revealed REQ-CASE-003 is a distinct, real gap rather than the same cosmetic issue as REQ-CASE-002.

---

## Next Guide

**Guide 4: Authentication & Test Session Strategy** — `auth.setup.ts` is built and verified; unblocks REQ-CASE-001, REQ-PRODUCT-001/002, and REQ-ORDER-001 once the Internal Suite's test file is written against it.
