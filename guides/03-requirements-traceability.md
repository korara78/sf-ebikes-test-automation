# Guide 3: Requirements Traceability

**Project:** Salesforce LWC Test Automation Portfolio (E-Bikes)
**Status:** Guest Suite fully verified against the live org (12/12 tests passing, one documented known gap)

---

## Overview

Each requirement below maps to a Guest Suite or Internal Suite test case from [Guide 2](02-test-plan.md) and tracks its verification status against the actual live, deployed org — not just what the source code implies should happen. Several requirements only reached their final status after live-org investigation surfaced real platform behavior that source-reading alone couldn't have predicted (see the notes column).

**Status legend:**
- ✅ **Confirmed** — verified passing against the live org, current test suite reflects real behavior
- ❌ **Known Gap** — verified against the live org; the requirement does not actually hold, and the test documents this rather than papering over it
- 🚧 **Deferred** — blocked on `auth.setup.ts` (Internal Suite, needs an authenticated session)

**Test ID column:** each `TC-###` is a Playwright tag (`{ tag: '@TC-###' }`) on the corresponding `test()` in the spec file — assigned sequentially by order of appearance, not by requirement grouping, so a requirement can map to more than one Test ID (e.g. REQ-CATALOG-003 covers both the Mountain and Commuter category-filter tests). Tags are filterable directly (`npx playwright test --grep @TC-005`) and show up as a pill next to each test in the HTML report, so this column is a live pointer into the code rather than a separate ID scheme to keep in sync by hand. Requirement IDs (`REQ-####`) are intentionally *not* tagged in test code — they live only in this document, keeping the test file itself free of business-requirement references.

---

## Guest Suite — Guest Storefront

| ID | Test&nbsp;ID | Requirement | Status | Notes |
|---|---|---|---|---|
| REQ-CATALOG-001 | TC-001 | Product catalog loads; page 1 shows 9 of 16 products, paging to page 2 shows the remaining 7 | ✅ Confirmed | Pagination text and the tile list update via two independent async paths — the page-count text advances on click before the tile list has actually refetched from Apex. `ProductCatalogPage.expectTileCount()` polls (`expect.poll`, 15s) instead of asserting the count once. |
| REQ-CATALOG-002 | TC-002 | Clicking a product shows its correct Name and MSRP | ✅ Confirmed | There is no separate detail page/URL — Product Explorer is a master-detail split layout; clicking a tile updates a third `<article>` panel in place on the same page. `ProductDetailPage` scopes its heading/MSRP locators to that panel. |
| REQ-CATALOG-003 | TC-003, TC-004 | Category filter narrows the catalog to the exact expected count | ✅ Confirmed | SLDS renders a styled `span.slds-checkbox` on top of the native input that intercepts pointer events. Even `force: true` clicks land on the same covered coordinate and never flip the checked state. Clicking the visible label text instead works (real label-click forwarding). |
| REQ-CATALOG-004 | TC-005, TC-006 | Level filter narrows the catalog to the exact expected count | ✅ Confirmed | Same checkbox/label-click fix as REQ-CATALOG-003. |
| REQ-CATALOG-005 | TC-007 | Search box narrows results by product name | ✅ Confirmed | — |
| REQ-CASE-002 | TC-008 | Submitting Create Case as a guest with all fields filled succeeds | ✅ Confirmed | Functionally works, but the UI shows a known cosmetic error despite successful creation. **Root cause:** Salesforce automatically reassigns a guest-created record's owner to the org's configured default Case owner immediately on creation (mandatory guest-sharing security behavior). This races the client's post-save callback, which intermittently reports `"The requested resource does not exist"` (`NOT_FOUND`, HTTP 200 wrapping an Aura action-level error) instead of the success toast. **Verified two ways:** (1) direct SOQL query against the org found every test submission — including ones made before any config changes — successfully created as a Case, `CreatedBy = "E-Bikes Site Guest User"`, `Owner` reassigned to the org's default owner; (2) the exact failing `createRecord` request/response pair was captured and inspected (see conversation history for the full decoded payload). Test now asserts the outgoing `createRecord` request contains the exact submitted field values, not the unreliable toast. |
| REQ-CASE-003 | TC-009 | Submitting Create Case with required fields empty shows validation and does not create a case | ❌ Known Gap | Subject/Description are not enforced as required fields on this org's Create Case form. Distinct finding from REQ-CASE-002: this isn't a UI-feedback race, there's no validation to race with. Confirmed via SOQL: multiple blank-`Subject` Cases exist from guest submissions, and network capture shows the `createRecord` request fires identically whether or not Subject/Description are filled. Test is wrapped in `test.fail()` so it stays green while documenting the gap — if the org's page layout/validation is ever fixed to actually require these fields, this test will start "unexpectedly passing," which is the signal to revisit this requirement. |
| REQ-GUEST-001 | TC-010 | Guest sees a Login option and no authenticated-only content | ✅ Confirmed | The control is a `button "Log in"` (lowercase "in"), not a `link "Log In"` as originally assumed. |

---

## Internal Suite — Internal Lightning App (deferred)

| ID | Test&nbsp;ID | Requirement | Status | Notes |
|---|---|---|---|---|
| REQ-CASE-001 | — | A case submitted as a guest actually appears in the internal Case list | 🚧 Deferred | Blocked on `auth.setup.ts`. Already indirectly evidenced: SOQL queries used to verify REQ-CASE-002 confirm guest-submitted Cases are visible internally with ownership reassigned, but no Playwright test exercises the internal Lightning UI yet. |
| REQ-PRODUCT-001 | — | Product Explorer loads real product data for an internal user | 🚧 Deferred | — |
| REQ-ORDER-001 | — | An internal user can build an order via the `orderBuilder` component | 🚧 Deferred | — |
| REQ-PRODUCT-002 | — | An internal user can view/edit a Product record | 🚧 Deferred | — |

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
