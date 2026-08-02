# Guide 2 (Draft): Playwright Test Plan

**Project:** Salesforce LWC Test Automation Portfolio (E-Bikes)
**Status:** ✅ Guest Suite and Internal Suite both verified against the live org (see [Guide 3](03-requirements-traceability.md) for per-requirement status)

---

## Overview

This plan targets the E-Bikes LWC sample app (Salesforce, Lightning Web Components + Experience Cloud) deployed per Guide 1. It's split into two suites by whether a test needs a logged-in session:

- **Guest Suite — Guest storefront.** Public Experience Cloud site. No auth needed.
- **Internal Suite — Internal Lightning app.** Requires a logged-in session via `storageState` (`auth.setup.ts`, see Guide 4).

Every test case below was checked against the actual E-Bikes source (`ProductController.cls`, the LWC components, and the sample data file) rather than assumed from the UI alone, since a few things about page size and component placement aren't obvious just from clicking around.

---

## Guest Suite — Guest Storefront

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

## Internal Suite — Internal Lightning App

Needs a logged-in session — `auth.setup.ts` (Guide 4) solves that via the `sf` CLI frontdoor bridge, wired in as the `setup` project dependency for `chromium-internal`/`firefox-internal`/`webkit-internal`.

| # | TC | Test | Why it matters |
|---|---|---|---|
| A | TC-011 | A case submitted as a guest actually appears in the internal Case list | End-to-end proof the guest-facing flow reaches internal staff |
| B | TC-012 | Product Explorer loads real product data for an internal user | Confirms the internal Lightning app surface separately from the guest site |
| C | TC-013 | **Order Builder**: an internal user can build an order (select sizes/quantities via the `orderBuilder` component, backed by `Qty_S__c`/`Qty_M__c`/`Qty_L__c`) and it's reflected in `Order_Item__c` records | This is the actual mechanism behind "managing reseller orders" — the app's stated purpose — and is more central than a generic Product record edit. `orderBuilder` and `Order__c`/`Order_Item__c` have no guest sharing rules, so this is internal-only. Confirmed against the live org to be native HTML5 drag-and-drop (no "Add to Order" button); see `pages/OrderBuilderPage.ts` for the locator/interaction details. |
| D | TC-014 | An internal user can view/edit a Product record | Baseline CRUD coverage on the internal side |

---

## Suggested Structure

```
tests/
  auth.setup.ts                 ← Internal Suite login (sf CLI frontdoor bridge)
  guest-storefront.spec.ts      ← Guest Suite tests
  internal-app.spec.ts          ← Internal Suite tests
pages/
  ProductCatalogPage.ts         ← Guest Suite: catalog locators/actions (filters, search, pagination)
  ProductDetailPage.ts          ← Guest Suite: product detail assertions
  CreateCasePage.ts             ← Guest Suite: Create Case form + validation
  internalSession.ts            ← shared helper: reads the internal Lightning origin auth.setup.ts persists
  InternalCaseListPage.ts       ← Internal Suite: Case list view (TC-011)
  ProductExplorerPage.ts        ← Internal Suite: internal Product Explorer (TC-012)
  OrderBuilderPage.ts           ← Internal Suite: Reseller Order creation + drag-and-drop Order Builder (TC-013)
  ProductRecordPage.ts          ← Internal Suite: Product record view/edit (TC-014)
```

---

## Salesforce Changes Mitigation Strategy

Salesforce releases, LWC's rendering model, and the platform's own DOM quirks change things out from under a test suite that wasn't written defensively — a raw CSS selector, a hardcoded record Id, or a naive drag-and-drop call all break for different Salesforce-specific reasons. Each subsection below names the specific failure mode first, then the countermeasure actually used against it in this repo.

### Locator Strategy

**Failure mode:** raw CSS selectors and generated identifiers are the least stable things to anchor on in a Salesforce org. Salesforce record Ids (`Case.Id`, `Product__c.Id`, etc.) regenerate per org and per record, so any locator built on one breaks the moment a test creates fresh data. SLDS/Aura markup and CSS classes are also free to shift between Salesforce releases without any change to the LWC's actual behavior.

**Countermeasure:** prefer `page.getByRole()`, `getByText()`, `getByLabel()` over raw CSS selectors wherever the LWC markup allows it — locators anchored to accessible role/name/label are resistant to the superficial DOM changes a Salesforce release is likely to introduce, and never touch record Ids at all. A couple of spots below are flagged as needing live-org confirmation because the underlying LWC markup doesn't fully determine the rendered accessible name/role (e.g., whether the product tile's `<a>` gets an `href`, or the exact wording of a required-field error).

### Shadow DOM Workaround: Accessing the Real Draggable Node

**The concept, in three doors:**

- **Door 1 — Light DOM. No barrier at all.** You speak your question directly at the door, and the person behind it answers verbally, right away. This is a normal `document.querySelector()` — it just asks, and gets a direct answer.
- **Door 2 — Open shadow root.** The door itself is shut, but it has a hatch — a specific, defined channel anyone can use to pass a note through and get one back. You can't just knock and talk normally anymore (`document.querySelector()` alone won't work), but anyone who knows to use the hatch (`element.shadowRoot`) can reach through it, no special permission required.
  - Playwright can pierce this automatically. Its own locators (`page.locator()`, `getByRole()`, plain CSS selectors) already know how to use the hatch on their own — no special code needed.
  - Playwright can also be manually driven through it, when you need something its high-level API doesn't offer — dropping into `page.evaluate()` and calling `element.shadowRoot.querySelector(...)` yourself, exactly what your Order Builder fix's `deepQueryAll` does.
- **Door 3 — Closed shadow root.** Same door, same hatch — but this hatch is locked, and no key exists on the outside at all. Only the person who lives behind the door (the component's own internal code, which privately holds the only key from the moment it was built) can ever use that hatch.
  - Playwright cannot pierce this — `element.shadowRoot` returns `null` for a closed root, for Playwright's locators and for manual `page.evaluate()` code alike. No sanctioned channel exists from the outside.
  - The only workaround is intercepting the door's construction itself — patching the browser's `attachShadow()` function before the component runs, to secretly force it open or capture a reference — a fragile, unofficial approach, not something Playwright supports natively.

**Failure mode:** Order Builder's `c-product-tile`/`c-order-item-tile` (TC-013) use genuine, native (open) shadow DOM — not LWC's usual synthetic-shadow polyfill. Playwright's built-in `locator.dragTo()` computes its drag coordinates against the custom element host (the visible "outer wrapper"), not the real draggable node hidden inside that element's shadow root — so it reliably grabs the wrong product tile, every time, regardless of which one is targeted.

![dragTo() grabs the wrong box because it targets the outer wrapper; manually dispatching drag events on the real draggable node inside the shadow root grabs the correct item every time](../guides-assets/shadow-dom-drag-workaround.png)

**Countermeasure:** bypass the wrapper entirely rather than fighting it. The fix (`pages/OrderBuilderPage.ts:106-158`) uses a shadow-root-aware deep query (`deepQueryAll`) to walk into the tile's actual shadow root and find the real draggable node, then manually dispatches the native drag event sequence (`dragstart`/`dragenter`/`dragover`/`drop`/`dragend`) with one shared `DataTransfer` object across both the source and drop-zone nodes — mirroring exactly what a real browser drag does natively, just without relying on `dragTo()`'s coordinate-based targeting to find the right element first.

---

## Reporting & Diagnostics

Every test run captures a screenshot (pass or fail) and, on failure, video and a trace — see [Guide 5](05-visual-reporting-and-debugging.md) for the full config and the troubleshooting workflow (screenshot first, then `trace.zip` if that's not enough). This applies uniformly across both suites, not just Guest.

---

## Test Data Isolation: The FUSE X1 Concurrency Incident

A real, live-org-confirmed data-corruption bug, investigated after CI started failing in a way that initially looked unrelated across four different tests at once.

**Symptom:** `TC-013` (Order Builder), `TC-015` (API MSRP query), and `TC-027` (Accessibility Product Explorer scan) all started failing in the same CI runs — three tests in three different suites, with no code in common. `TC-014` (Product record edit) was failing too, but that looked like the odd one out rather than the actual cause.

**Root cause, confirmed via direct SOQL against the live org:** `Product__c` "FUSE X1" — a reference product `TC-013`/`TC-015`/`TC-027` all look up by that exact literal Name, for entirely unrelated reasons — had its Name field corrupted to `"FUSE X1Internal Suite edit check 1785652328240"`. `TC-014` is the only test in the whole suite that writes to `Product__c` at all: it edits the Description field, and something concatenated that edit's generated text onto Name instead.

The first theory (a Playwright locator matching the wrong field in the DOM) turned out to be wrong — scoping `ProductRecordPage.fieldInput()` to the edit modal specifically didn't stop it from recurring. The actual proof came from the corrupted value itself: **the timestamp embedded in the corrupted Name didn't match the timestamp in Description on the same record** — two different `Date.now()`-generated strings, meaning two *separate, overlapping executions* of `TC-014` had written to the same record concurrently. Most likely: a local verification run and the CI run it had just triggered, both hitting the same live personal Dev Edition org's `FUSE X1` record at the same time.

**Two separate fixes, addressing two separate risks:**
1. `.github/workflows/playwright.yml` got a `concurrency` guard so two GitHub Actions runs can never execute against the org simultaneously — confirmed to matter: two runs triggered back-to-back (a manual rerun overlapping an in-progress one) produced measurably broader, slower failures than either alone.
2. That guard does **not** cover a local run overlapping the CI run it just triggered — there's no way to prevent that from code alone, only by not running the local suite again immediately after pushing. Given that risk can't be fully eliminated, `TC-014` was moved to edit `FUSE X2` instead of `FUSE X1` — decoupling it from the three tests that depend on `FUSE X1`'s exact Name. This doesn't prevent the underlying race; it contains the blast radius to `TC-014` itself if it recurs, instead of cascading into three unrelated-looking failures. `TC-014` also now verifies via SOQL that its target record's Name is unchanged immediately after saving, so a recurrence fails loudly in the one test responsible rather than silently corrupting shared data.

**The general lesson, worth keeping in mind for any new test:** a record that gets *read* by many tests via a hardcoded literal name, and *written* by even one test, is a structural risk — not because the write test's logic is wrong, but because "many readers, one writer, shared live mutable state" is exactly the shape of bug that only shows up under conditions (timing, concurrency) that a single clean run won't reproduce. Preferring a dedicated, non-shared record for anything a test needs to mutate — the same instinct already applied elsewhere in this repo (the API Suite creates and deletes its own Case rather than touching a shared one) — avoids the whole class, not just this one instance of it.

---

## Next Guide

**Guide 3: Requirements Traceability** — maps each test case above to a tracked requirement ID and its live-org-verified status.

**Guide 4: Authentication & Test Session Strategy** — `auth.setup.ts` is built and verified, unblocking the Internal Suite's test file above.

**Guide 5: Visual Reporting & Trace Debugging** — screenshot/video/trace capture config and the troubleshooting workflow, applying to both suites.

