/**
 * Source of truth for the Living Traceability Matrix in
 * guides/03-requirements-traceability.md. This file is hand-maintained;
 * the Markdown tables are generated from it (plus live test results) by
 * scripts/generate-traceability-matrix.mjs — do not hand-edit the tables
 * directly, they'll be overwritten on the next `npm run gen:matrix`.
 *
 * Status is intentionally NOT stored here — it's derived at generation
 * time from the latest Playwright JSON test run, matched by testIds.
 */

export const guestSuite = [
  {
    reqId: 'REQ-CATALOG-001',
    testIds: ['TC-001'],
    requirement:
      'Product catalog loads; page 1 shows 9 of 16 products, paging to page 2 shows the remaining 7',
    notes:
      'Pagination text and the tile list update via two independent async paths — the page-count text advances on click before the tile list has actually refetched from Apex. `ProductCatalogPage.expectTileCount()` polls (`expect.poll`, 15s) instead of asserting the count once.'
  },
  {
    reqId: 'REQ-CATALOG-002',
    testIds: ['TC-002'],
    requirement: 'Clicking a product shows its correct Name and MSRP',
    notes:
      'There is no separate detail page/URL — Product Explorer is a master-detail split layout; clicking a tile updates a third `<article>` panel in place on the same page. `ProductDetailPage` scopes its heading/MSRP locators to that panel.'
  },
  {
    reqId: 'REQ-CATALOG-003',
    testIds: ['TC-003', 'TC-004'],
    requirement: 'Category filter narrows the catalog to the exact expected count',
    notes:
      'SLDS renders a styled `span.slds-checkbox` on top of the native input that intercepts pointer events. Even `force: true` clicks land on the same covered coordinate and never flip the checked state. Clicking the visible label text instead works (real label-click forwarding).'
  },
  {
    reqId: 'REQ-CATALOG-004',
    testIds: ['TC-005', 'TC-006'],
    requirement: 'Level filter narrows the catalog to the exact expected count',
    notes: 'Same checkbox/label-click fix as REQ-CATALOG-003.'
  },
  {
    reqId: 'REQ-CATALOG-005',
    testIds: ['TC-007'],
    requirement: 'Search box narrows results by product name',
    notes: '—'
  },
  {
    reqId: 'REQ-CASE-002',
    testIds: ['TC-008'],
    requirement: 'Submitting Create Case as a guest with all fields filled succeeds',
    notes:
      'Functionally works, but the UI shows a known cosmetic error despite successful creation. **Root cause:** Salesforce automatically reassigns a guest-created record\'s owner to the org\'s configured default Case owner immediately on creation (mandatory guest-sharing security behavior). This races the client\'s post-save callback, which intermittently reports `"The requested resource does not exist"` (`NOT_FOUND`, HTTP 200 wrapping an Aura action-level error) instead of the success toast. **Verified two ways:** (1) direct SOQL query against the org found every test submission — including ones made before any config changes — successfully created as a Case, `CreatedBy = "E-Bikes Site Guest User"`, `Owner` reassigned to the org\'s default owner; (2) the exact failing `createRecord` request/response pair was captured and inspected (see conversation history for the full decoded payload). Test now asserts the outgoing `createRecord` request contains the exact submitted field values, not the unreliable toast.'
  },
  {
    reqId: 'REQ-CASE-003',
    testIds: ['TC-009'],
    requirement:
      'Submitting Create Case with required fields empty shows validation and does not create a case',
    notes:
      'Subject/Description are not enforced as required fields on this org\'s Create Case form. Distinct finding from REQ-CASE-002: this isn\'t a UI-feedback race, there\'s no validation to race with. Confirmed via SOQL: multiple blank-`Subject` Cases exist from guest submissions, and network capture shows the `createRecord` request fires identically whether or not Subject/Description are filled. Test is wrapped in `test.fail()`, so a passing run here means the gap is still present — if the org\'s validation is ever fixed, this row will flip to 🔴 Regression, which is the live signal to revisit this requirement.'
  },
  {
    reqId: 'REQ-GUEST-001',
    testIds: ['TC-010'],
    requirement: 'Guest sees a Login option and no authenticated-only content',
    notes:
      'The control is a `button "Log in"` (lowercase "in"), not a `link "Log In"` as originally assumed.'
  }
];

export const internalSuite = [
  {
    reqId: 'REQ-CASE-001',
    testIds: ['TC-011'],
    requirement: 'A case submitted as a guest actually appears in the internal Case list',
    notes:
      'Submits a real guest Case with a unique Subject (fresh browser context, no storageState — a true guest, not the internal-authenticated `page`), looks up its Case Number via `sf data query`, then confirms it in `AllOpenCases`. The list has 50+ lazy-loaded rows sorted by Case Number; a fresh Case isn\'t in the initially-rendered rows and the list\'s own "Search this list..." box returns 0 results for several seconds (server-side search-index lag). Sorting by Case Number descending is deterministic instead, since Case Numbers are sequential — the newest Case is always row 1.'
  },
  {
    reqId: 'REQ-PRODUCT-001',
    testIds: ['TC-012'],
    requirement: 'Product Explorer loads real product data for an internal user',
    notes:
      'The internal "Product Explorer" nav tab (`/lightning/n/Product_Explorer`) is a different origin/URL than the guest catalog, though built on the same `c-product-tile`/`c-product-tile-list` LWCs. Selecting a tile populates a `c-product-card` detail panel headed by the product name — distinct from the guest catalog\'s plain `<article>` master-detail panel.'
  },
  {
    reqId: 'REQ-ORDER-001',
    testIds: ['TC-013'],
    requirement: 'An internal user can build an order via the `orderBuilder` component',
    notes:
      'The most involved test in the suite. Order Builder is real (native) HTML5 drag-and-drop, and `c-product-tile`/`c-order-item-tile` use genuine (non-synthetic) shadow DOM. Playwright\'s `locator.dragTo()` reliably drags the *wrong* product regardless of which tile is targeted — reproduced repeatedly against this specific component; manually dispatching dragstart/dragenter/dragover/drop/dragend with one shared `DataTransfer` on the tile\'s actual draggable node (inside its shadow root, not the custom element host) works correctly every time. Dropping a tile creates an `Order_Item__c` immediately with `Price__c` defaulted to `round(MSRP * 0.6)`; "Total Items" in the header sums Small+Medium+Large quantities, not a line-item count. Persistence of a quantity edit is verified via SOQL rather than `page.reload()`: reloading this specific record page intermittently throws a real app-level LWC `@wire` error (`force:ldsBindings` failing on `this.objectInfo.data.defaultRecordTypeId`), reproduced on WebKit — a bug in the deployed component, not something a test should route around by reloading.'
  },
  {
    reqId: 'REQ-PRODUCT-002',
    testIds: ['TC-014'],
    requirement: 'An internal user can view/edit a Product record',
    notes:
      'Both the top-right "Edit" button and every per-field pencil icon open the same full-record modal (`Edit {ProductName}`) — there\'s no separate lightweight per-field popover despite the pencil icons suggesting one.'
  }
];

export const apiSuite = [
  {
    reqId: 'REQ-API-001',
    testIds: ['TC-015'],
    requirement: 'Querying Product__c via the standard REST API returns the correct MSRP for a known product',
    notes:
      'Calls `GET /services/data/vXX.X/query` directly with a bearer token (`pages/apiSession.ts`), no browser involved. Asserts the same $2,500 MSRP for FUSE X1 that the Guest Suite\'s TC-002 confirms through the rendered UI — same fact, verified at the API layer instead. **Confirmed against the live org:** the first real run of this suite failed with a uniform 401 on every authenticated call — `sf org display`, even with `--verbose`, no longer includes the real access token on current CLI versions; it\'s replaced with a literal `"[REDACTED] Use \'sf org auth show-access-token\' to view"` placeholder string, which was being sent as the bearer token verbatim. Fixed by combining `sf org display --json` (for `instanceUrl`, still unredacted) with the dedicated `sf org auth show-access-token -o <org> --json` command for the actual token.'
  },
  {
    reqId: 'REQ-API-002',
    testIds: ['TC-016'],
    requirement: 'A Case can be created directly via the REST API, bypassing the LWC UI entirely',
    notes:
      'E-Bikes has no custom `@RestResource` endpoint of its own (confirmed by reading the `ebikes-lwc` Apex source) — Case creation normally goes through `lightning-record-edit-form`/Lightning Data Service. This hits the standard `POST /sobjects/Case` endpoint that LDS itself calls under the hood, and confirms the created record round-trips correctly via a follow-up GET.'
  },
  {
    reqId: 'REQ-API-003',
    testIds: ['TC-017'],
    requirement: 'A Case created via REST can be updated via REST and the change persists',
    notes: 'PATCH returns 204 with an empty body (standard Salesforce REST behavior for updates); persistence is confirmed via a follow-up GET rather than trusting the PATCH response itself.'
  },
  {
    reqId: 'REQ-API-004',
    testIds: ['TC-018'],
    requirement: 'A Case created via REST can be deleted via REST',
    notes:
      'The one place in this repo that deliberately cleans up after itself — unlike every other suite\'s "leave real records behind" convention, deleting a record it just created is the thing under test here, not tidying up. Confirms the follow-up GET returns 404 once deleted.'
  },
  {
    reqId: 'REQ-API-005',
    testIds: ['TC-019'],
    requirement: 'Requesting a nonexistent record Id returns a 404 with the expected Salesforce error shape',
    notes:
      'Negative-path/error-handling coverage, deliberately distinct from the four happy-path CRUD tests above. Uses a syntactically valid but nonexistent 18-char Case Id (`"500" + 12 zeros + "AAA"`) and asserts `errorCode: "NOT_FOUND"` — the same REST-level error already documented as the root cause of REQ-CASE-002\'s cosmetic UI failure, now asserted directly rather than inferred from a race.'
  }
];

export const authzSuite = [
  {
    reqId: 'REQ-AUTHZ-001',
    testIds: ['TC-020'],
    requirement: 'A guest session cannot reach the standard REST API',
    notes:
      'The guest profile grants no `ApiEnabled` permission (confirmed in the org\'s guest profile metadata, `ebikes-lwc/guest-profile-metadata/profiles/E-Bikes Profile.profile`) — this probes it empirically rather than trusting the metadata alone, using the actual session cookies from a real guest page visit (`browserContext.request` shares cookies with the browser context it\'s attached to) against the community site\'s own origin.'
  },
  {
    reqId: 'REQ-AUTHZ-002',
    testIds: ['TC-021'],
    requirement: 'A guest session cannot read a Case it does not own via the UI API (cross-record IDOR)',
    notes:
      'The guest profile has `Case` `allowRead=true` but no `viewAllRecords` and no guest sharing rule on Case at all (confirmed in guest profile metadata) — so a guest should never be able to fetch an arbitrary existing Case by Id, only ones it has explicit access to. The "foreign" Case is simply the most recently created one in the org (there\'s always at least one, given every suite here leaves real Cases behind).'
  },
  {
    reqId: 'REQ-AUTHZ-003',
    testIds: ['TC-022'],
    requirement:
      'A guest cannot set a field absent from the Create Case form via a tampered createRecord payload (mass assignment / Broken Object Property Level Authorization)',
    notes:
      'Reuses the exact `aura://RecordUiController/ACTION$createRecord` request `CreateCasePage` already knows how to parse (see REQ-CASE-002), but intercepts it via `page.route()` and injects `Case.IsEscalated: true` — a real field, not on the rendered form, not editable for the guest profile per its field-level-security metadata. **Confirmed against the live org:** Lightning Data Service doesn\'t silently drop the inaccessible field — it rejects the entire create request outright, surfacing "Unable to create/update fields: IsEscalated. Please check the security settings of this field and verify that it is read/write for your profile or permission set." No Case is created at all. A stronger secure outcome than either alternative originally considered when this test was written.'
  }
];
