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
    testIds: [],
    requirement: 'A case submitted as a guest actually appears in the internal Case list',
    notes:
      'Blocked on `auth.setup.ts`. Already indirectly evidenced: SOQL queries used to verify REQ-CASE-002 confirm guest-submitted Cases are visible internally with ownership reassigned, but no Playwright test exercises the internal Lightning UI yet.'
  },
  {
    reqId: 'REQ-PRODUCT-001',
    testIds: [],
    requirement: 'Product Explorer loads real product data for an internal user',
    notes: '—'
  },
  {
    reqId: 'REQ-ORDER-001',
    testIds: [],
    requirement: 'An internal user can build an order via the `orderBuilder` component',
    notes: '—'
  },
  {
    reqId: 'REQ-PRODUCT-002',
    testIds: [],
    requirement: 'An internal user can view/edit a Product record',
    notes: '—'
  }
];
