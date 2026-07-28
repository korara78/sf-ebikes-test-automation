# Guide 2 (Draft): Playwright Test Plan

**Project:** Salesforce LWC Test Automation Portfolio (E-Bikes)
**Status:** ✅ Tier 1 verified against the live org (see [Guide 3](03-requirements-traceability.md) for per-requirement status) — Tier 2 deferred until auth setup (storageState / `auth.setup.ts`)

---

## Overview

This plan targets the E-Bikes LWC sample app (Salesforce, Lightning Web Components + Experience Cloud) deployed per Guide 1. It's split into two tiers by whether a test needs a logged-in session:

- **Tier 1 — Guest storefront.** Public Experience Cloud site. No auth needed. Build first.
- **Tier 2 — Internal Lightning app.** Requires a logged-in session via `storageState`. Deferred until that's built (see Guide 1, Step 5 preview).

Every test case below was checked against the actual E-Bikes source (`ProductController.cls`, the LWC components, and the sample data file) rather than assumed from the UI alone, since a few things about page size and component placement aren't obvious just from clicking around.

---

## Tier 1 — Guest Storefront

No login/session handling needed.

| # | Test | Why it matters | Notes from source |
|---|---|---|---|
| 1 | Product catalog loads; page 1 shows 9 products and a correct total-item count of 16; paging to page 2 shows the remaining 7 | Core smoke test — proves site, data, and LWC components work together | `ProductController.cls` hardcodes `PAGE_SIZE = 9`. **Do not** assert 16 tiles rendered at once — that will fail. Assert 9 tiles + `"16 items • page 1 of 2"` text from the `paginator` component, then click Next and assert 7 tiles + `"page 2 of 2"`. |
| 2 | Clicking a product opens its detail page with correct Name and MSRP | Verifies navigation + data binding, not just that a page loaded | The guest site's product detail view uses generic `forceCommunity:recordHeadline` + `recordHomeTabs` (standard Details/Related tabs) — **not** the custom `heroDetails`/`similarProducts`/`orderBuilder` components, which live only on the internal `Product_Record_Page`. Assert on the standard field values, not custom widgets. |
| 3 | Category filter narrows the catalog to the exact expected count | Tests real interactive logic, not static rendering | All filter checkboxes start checked (all products shown). Sample data gives exact expected counts: unchecking "Commuter" (leaving only "Mountain" checked) → **8** products (Dynamo×4 + Electra×4). Unchecking "Mountain" (leaving "Commuter") → **8** (Fuse×4 + Volt×4). |
| 4 | Level filter narrows the catalog to the exact expected count | Same as above, different filter dimension | Level "Beginner" → **8** (Fuse×4 + Volt×4), "Enthusiast" → **4** (Electra×4), "Racer" → **4** (Dynamo×4). |
| 5 | Search box narrows results by product name | Distinct interactive path from checkbox filters (free-text vs. facet) | `productFilter` has a `lightning-input type="search"` labeled "Search Key". Searching "FUSE" → 4 results. |
| 6 | Submitting "Create Case" as a guest succeeds and shows a confirmation toast | The most business-critical guest flow — this is how real customers report problems | Success toast text is hardcoded in `createCase.js`: title `"Case Created!"`, message `"You have successfully created a Case"`. Assert on that exact text. |
| 7 | Submitting "Create Case" with required fields empty shows inline validation and does not create a case | Cheap to add, catches a real regression class (broken required-field validation) | Uses `lightning-record-edit-form` — Salesforce renders its own inline field errors on failed submit; assert an error is shown and no success toast appears. Which fields are actually required depends on this org's field/page-layout config — confirm on first run rather than hardcoding a specific field name. |
| 8 | Guest sees a Login option and no authenticated-only content | Confirms guest sharing rules are enforced, not just that a button exists | The site does have `login`/`register`/`forgotPassword` routes deployed, so a Login entry point existing is likely — but whether it's visible in your header nav depends on Experience Builder config. **Confirm visually against the live deployed org before finalizing this locator.** |

---

## Tier 2 — Internal Lightning App (deferred)

Needs a logged-in session — this is exactly what `auth.setup.ts` (Guide 1, Step 5 preview) exists to solve, so these wait until that's built.

| # | Test | Why it matters |
|---|---|---|
| A | A case submitted as a guest actually appears in the internal Case list | End-to-end proof the guest-facing flow reaches internal staff |
| B | Product Explorer loads real product data for an internal user | Confirms the internal Lightning app surface separately from the guest site |
| C | **Order Builder**: an internal user can build an order (select sizes/quantities via the `orderBuilder` component, backed by `Qty_S__c`/`Qty_M__c`/`Qty_L__c`) and it's reflected in `Order_Item__c` records | This is the actual mechanism behind "managing reseller orders" — the app's stated purpose — and is more central than a generic Product record edit. `orderBuilder` and `Order__c`/`Order_Item__c` have no guest sharing rules, so this is internal-only. |
| D | An internal user can view/edit a Product record | Baseline CRUD coverage on the internal side |

---

## Suggested Structure

```
tests/
  guest-storefront.spec.ts     ← Tier 1 tests
  internal-app.spec.ts         ← Tier 2 tests (after auth.setup.ts exists)
pages/
  ProductCatalogPage.ts        ← page object: catalog locators/actions (filters, search, pagination)
  ProductDetailPage.ts         ← page object: product detail assertions
  CreateCasePage.ts            ← page object: Create Case form + validation
```

Locator strategy: prefer `page.getByRole()`, `getByText()`, `getByLabel()` over raw CSS selectors wherever the LWC markup allows it — more resistant to the superficial DOM changes a Salesforce release is likely to introduce. A couple of spots below are flagged as needing live-org confirmation because the underlying LWC markup doesn't fully determine the rendered accessible name/role (e.g., whether the product tile's `<a>` gets an `href`, or the exact wording of a required-field error).

---

## Next Guide

**Guide 3: Requirements Traceability** — maps each test case above to a tracked requirement ID and its live-org-verified status.

**Guide 4: Authentication & Test Session Strategy** — `auth.setup.ts`, handling Salesforce login/MFA in Playwright, `storageState` reuse — unblocks Tier 2.

