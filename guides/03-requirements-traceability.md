# Guide 3: Requirements Traceability

**Project:** Salesforce LWC Test Automation Portfolio (E-Bikes)
<!-- LTM:SUMMARY:START -->
**Status:** 7/8 Guest Suite + 4/4 Internal Suite + 5/5 API Suite + 3/3 Penetration Suite requirements confirmed — matrix auto-generated 7/31/2026, 3:21 PM from the latest test run
<!-- LTM:SUMMARY:END -->

---

## Overview

This is a **Living Traceability Matrix** — the tables below are generated, not hand-edited. Each requirement maps to one or more test cases from the Guest, Internal, API, or Penetration Suite (the latter two from [Guide 6](06-api-and-authorization-boundary-testing.md); the first two from [Guide 2](02-test-plan.md)), and Status is derived automatically from the latest Playwright test run rather than typed in by hand.

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
- 🚧 **Deferred** — no test written yet for this requirement

<!-- LTM:DRIFT:START -->

<!-- LTM:DRIFT:END -->

---

## Guest Suite — Guest Storefront

<!-- LTM:GUEST:START -->
| ID | Test&nbsp;ID | Requirement | Status | Notes |
|---|---|---|---|---|
| REQ-CATALOG-001 | TC-001 | Product catalog loads; page 1 shows 9 of 16 products, paging to page 2 shows the remaining 7 | ✅ Confirmed | _Last run: 7/31/2026, 3:18 PM — 3 browsers._<br>Pagination text and the tile list update via two independent async paths — the page-count text advances on click before the tile list has actually refetched from Apex. `ProductCatalogPage.expectTileCount()` polls (`expect.poll`, 15s) instead of asserting the count once. |
| REQ-CATALOG-002 | TC-002 | Clicking a product shows its correct Name and MSRP | ✅ Confirmed | _Last run: 7/31/2026, 3:18 PM — 3 browsers._<br>There is no separate detail page/URL — Product Explorer is a master-detail split layout; clicking a tile updates a third `<article>` panel in place on the same page. `ProductDetailPage` scopes its heading/MSRP locators to that panel. |
| REQ-CATALOG-003 | TC-003, TC-004 | Category filter narrows the catalog to the exact expected count | ✅ Confirmed | _Last run: 7/31/2026, 3:18 PM — 3 browsers._<br>SLDS renders a styled `span.slds-checkbox` on top of the native input that intercepts pointer events. Even `force: true` clicks land on the same covered coordinate and never flip the checked state. Clicking the visible label text instead works (real label-click forwarding). |
| REQ-CATALOG-004 | TC-005, TC-006 | Level filter narrows the catalog to the exact expected count | ✅ Confirmed | _Last run: 7/31/2026, 3:18 PM — 3 browsers._<br>Same checkbox/label-click fix as REQ-CATALOG-003. |
| REQ-CATALOG-005 | TC-007 | Search box narrows results by product name | ✅ Confirmed | _Last run: 7/31/2026, 3:18 PM — 3 browsers._<br>— |
| REQ-CASE-002 | TC-008 | Submitting Create Case as a guest with all fields filled succeeds | ✅ Confirmed | _Last run: 7/31/2026, 3:18 PM — 3 browsers._<br>Functionally works, but the UI shows a known cosmetic error despite successful creation. **Root cause:** Salesforce automatically reassigns a guest-created record's owner to the org's configured default Case owner immediately on creation (mandatory guest-sharing security behavior). This races the client's post-save callback, which intermittently reports `"The requested resource does not exist"` (`NOT_FOUND`, HTTP 200 wrapping an Aura action-level error) instead of the success toast. **Verified two ways:** (1) direct SOQL query against the org found every test submission — including ones made before any config changes — successfully created as a Case, `CreatedBy = "E-Bikes Site Guest User"`, `Owner` reassigned to the org's default owner; (2) the exact failing `createRecord` request/response pair was captured and inspected (see conversation history for the full decoded payload). Test now asserts the outgoing `createRecord` request contains the exact submitted field values, not the unreliable toast. |
| REQ-CASE-003 | TC-009 | Submitting Create Case with required fields empty shows validation and does not create a case | ❌ Known Gap | _Last run: 7/31/2026, 3:18 PM — 3 browsers._<br>Subject/Description are not enforced as required fields on this org's Create Case form. Distinct finding from REQ-CASE-002: this isn't a UI-feedback race, there's no validation to race with. Confirmed via SOQL: multiple blank-`Subject` Cases exist from guest submissions, and network capture shows the `createRecord` request fires identically whether or not Subject/Description are filled. Test is wrapped in `test.fail()`, so a passing run here means the gap is still present — if the org's validation is ever fixed, this row will flip to 🔴 Regression, which is the live signal to revisit this requirement. |
| REQ-GUEST-001 | TC-010 | Guest sees a Login option and no authenticated-only content | ✅ Confirmed | _Last run: 7/31/2026, 3:18 PM — 3 browsers._<br>The control is a `button "Log in"` (lowercase "in"), not a `link "Log In"` as originally assumed. |
<!-- LTM:GUEST:END -->

---

## Internal Suite — Internal Lightning App

<!-- LTM:INTERNAL:START -->
| ID | Test&nbsp;ID | Requirement | Status | Notes |
|---|---|---|---|---|
| REQ-CASE-001 | TC-011 | A case submitted as a guest actually appears in the internal Case list | ✅ Confirmed | _Last run: 7/31/2026, 3:20 PM — 3 browsers._<br>Submits a real guest Case with a unique Subject (fresh browser context, no storageState — a true guest, not the internal-authenticated `page`), looks up its Case Number via `sf data query`, then confirms it in `AllOpenCases`. The list has 50+ lazy-loaded rows sorted by Case Number; a fresh Case isn't in the initially-rendered rows and the list's own "Search this list..." box returns 0 results for several seconds (server-side search-index lag). Sorting by Case Number descending is deterministic instead, since Case Numbers are sequential — the newest Case is always row 1. |
| REQ-PRODUCT-001 | TC-012 | Product Explorer loads real product data for an internal user | ✅ Confirmed | _Last run: 7/31/2026, 3:20 PM — 3 browsers._<br>The internal "Product Explorer" nav tab (`/lightning/n/Product_Explorer`) is a different origin/URL than the guest catalog, though built on the same `c-product-tile`/`c-product-tile-list` LWCs. Selecting a tile populates a `c-product-card` detail panel headed by the product name — distinct from the guest catalog's plain `<article>` master-detail panel. |
| REQ-ORDER-001 | TC-013 | An internal user can build an order via the `orderBuilder` component | ✅ Confirmed | _Last run: 7/31/2026, 3:20 PM — 3 browsers._<br>The most involved test in the suite. Order Builder is real (native) HTML5 drag-and-drop, and `c-product-tile`/`c-order-item-tile` use genuine (non-synthetic) shadow DOM. Playwright's `locator.dragTo()` reliably drags the *wrong* product regardless of which tile is targeted — reproduced repeatedly against this specific component; manually dispatching dragstart/dragenter/dragover/drop/dragend with one shared `DataTransfer` on the tile's actual draggable node (inside its shadow root, not the custom element host) works correctly every time. Dropping a tile creates an `Order_Item__c` immediately with `Price__c` defaulted to `round(MSRP * 0.6)`; "Total Items" in the header sums Small+Medium+Large quantities, not a line-item count. Persistence of a quantity edit is verified via SOQL rather than `page.reload()`: reloading this specific record page intermittently throws a real app-level LWC `@wire` error (`force:ldsBindings` failing on `this.objectInfo.data.defaultRecordTypeId`), reproduced on WebKit — a bug in the deployed component, not something a test should route around by reloading. |
| REQ-PRODUCT-002 | TC-014 | An internal user can view/edit a Product record | ✅ Confirmed | _Last run: 7/31/2026, 3:20 PM — 3 browsers._<br>Both the top-right "Edit" button and every per-field pencil icon open the same full-record modal (`Edit {ProductName}`) — there's no separate lightweight per-field popover despite the pencil icons suggesting one. |
<!-- LTM:INTERNAL:END -->

---

## API Suite — Salesforce REST API

Direct REST API calls, no browser involved. E-Bikes has no custom `@RestResource` endpoint of its own — the mutating write paths (Case creation, Order__c/Order_Item__c create/update/delete) go through Salesforce's own Lightning Data Service, exposed as the standard `sobjects`/`ui-api` REST endpoints. Authenticated as the same `mydevorg` admin identity every other suite in this repo uses, via a bearer token (`pages/apiSession.ts`), not a browser session.

<!-- LTM:API:START -->
| ID | Test&nbsp;ID | Requirement | Status | Notes |
|---|---|---|---|---|
| REQ-API-001 | TC-015 | Querying Product__c via the standard REST API returns the correct MSRP for a known product | ✅ Confirmed | _Last run: 7/31/2026, 3:19 PM — 1 browser._<br>Calls `GET /services/data/vXX.X/query` directly with a bearer token (`pages/apiSession.ts`), no browser involved. Asserts the same $2,500 MSRP for FUSE X1 that the Guest Suite's TC-002 confirms through the rendered UI — same fact, verified at the API layer instead. **Confirmed against the live org:** the first real run of this suite failed with a uniform 401 on every authenticated call — `sf org display`, even with `--verbose`, no longer includes the real access token on current CLI versions; it's replaced with a literal `"[REDACTED] Use 'sf org auth show-access-token' to view"` placeholder string, which was being sent as the bearer token verbatim. Fixed by combining `sf org display --json` (for `instanceUrl`, still unredacted) with the dedicated `sf org auth show-access-token -o <org> --json` command for the actual token. |
| REQ-API-002 | TC-016 | A Case can be created directly via the REST API, bypassing the LWC UI entirely | ✅ Confirmed | _Last run: 7/31/2026, 3:19 PM — 1 browser._<br>E-Bikes has no custom `@RestResource` endpoint of its own (confirmed by reading the `ebikes-lwc` Apex source) — Case creation normally goes through `lightning-record-edit-form`/Lightning Data Service. This hits the standard `POST /sobjects/Case` endpoint that LDS itself calls under the hood, and confirms the created record round-trips correctly via a follow-up GET. |
| REQ-API-003 | TC-017 | A Case created via REST can be updated via REST and the change persists | ✅ Confirmed | _Last run: 7/31/2026, 3:19 PM — 1 browser._<br>PATCH returns 204 with an empty body (standard Salesforce REST behavior for updates); persistence is confirmed via a follow-up GET rather than trusting the PATCH response itself. |
| REQ-API-004 | TC-018 | A Case created via REST can be deleted via REST | ✅ Confirmed | _Last run: 7/31/2026, 3:19 PM — 1 browser._<br>The one place in this repo that deliberately cleans up after itself — unlike every other suite's "leave real records behind" convention, deleting a record it just created is the thing under test here, not tidying up. Confirms the follow-up GET returns 404 once deleted. |
| REQ-API-005 | TC-019 | Requesting a nonexistent record Id returns a 404 with the expected Salesforce error shape | ✅ Confirmed | _Last run: 7/31/2026, 3:19 PM — 1 browser._<br>Negative-path/error-handling coverage, deliberately distinct from the four happy-path CRUD tests above. Uses a syntactically valid but nonexistent 18-char Case Id (`"500" + 12 zeros + "AAA"`) and asserts `errorCode: "NOT_FOUND"` — the same REST-level error already documented as the root cause of REQ-CASE-002's cosmetic UI failure, now asserted directly rather than inferred from a race. |
<!-- LTM:API:END -->

---

## Penetration Suite — Guest Authorization Boundaries

Not generic endpoint smoke tests — each requirement targets a specific authorization boundary the guest profile's own metadata claims to enforce (`ebikes-lwc/guest-profile-metadata`), and empirically confirms it holds. Maps to the OWASP API Security Top 10: Broken Object Level Authorization (cross-record read), Broken Function Level Authorization (REST API reachability), and Broken Object Property Level Authorization / mass assignment (field injection on create). A failing assertion here is a real, reportable finding, not a test bug — same posture as the REQ-CASE-002/003 investigation below.

<!-- LTM:AUTHZ:START -->
| ID | Test&nbsp;ID | Requirement | Status | Notes |
|---|---|---|---|---|
| REQ-AUTHZ-001 | TC-020 | A guest session cannot reach the standard REST API | ✅ Confirmed | _Last run: 7/31/2026, 3:19 PM — 1 browser._<br>The guest profile grants no `ApiEnabled` permission (confirmed in the org's guest profile metadata, `ebikes-lwc/guest-profile-metadata/profiles/E-Bikes Profile.profile`) — this probes it empirically rather than trusting the metadata alone, using the actual session cookies from a real guest page visit (`browserContext.request` shares cookies with the browser context it's attached to) against the community site's own origin. |
| REQ-AUTHZ-002 | TC-021 | A guest session cannot read a Case it does not own via the UI API (cross-record IDOR) | ✅ Confirmed | _Last run: 7/31/2026, 3:19 PM — 1 browser._<br>The guest profile has `Case` `allowRead=true` but no `viewAllRecords` and no guest sharing rule on Case at all (confirmed in guest profile metadata) — so a guest should never be able to fetch an arbitrary existing Case by Id, only ones it has explicit access to. The "foreign" Case is simply the most recently created one in the org (there's always at least one, given every suite here leaves real Cases behind). |
| REQ-AUTHZ-003 | TC-022 | A guest cannot set a field absent from the Create Case form via a tampered createRecord payload (mass assignment / Broken Object Property Level Authorization) | ✅ Confirmed | _Last run: 7/31/2026, 3:19 PM — 1 browser._<br>Reuses the exact `aura://RecordUiController/ACTION$createRecord` request `CreateCasePage` already knows how to parse (see REQ-CASE-002), but intercepts it via `page.route()` and injects `Case.IsEscalated: true` — a real field, not on the rendered form, not editable for the guest profile per its field-level-security metadata. **Confirmed against the live org:** Lightning Data Service doesn't silently drop the inaccessible field — it rejects the entire create request outright, surfacing "Unable to create/update fields: IsEscalated. Please check the security settings of this field and verify that it is read/write for your profile or permission set." No Case is created at all. A stronger secure outcome than either alternative originally considered when this test was written. |
<!-- LTM:AUTHZ:END -->

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
