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
      'The page-count text updates before the tile list actually refetches, so the test polls for the tile count instead of asserting it once.'
  },
  {
    reqId: 'REQ-CATALOG-002',
    testIds: ['TC-002'],
    requirement: 'Clicking a product shows its correct Name and MSRP',
    notes:
      "Clicking a tile doesn't navigate — it updates a detail panel in place on the same page. The test scopes its locators to that panel."
  },
  {
    reqId: 'REQ-CATALOG-003',
    testIds: ['TC-003', 'TC-004'],
    requirement: 'Category filter narrows the catalog to the exact expected count',
    notes:
      "The checkbox's native input is visually covered by a styled element, so clicking it directly never registers. Clicking the visible label text instead works."
  },
  {
    reqId: 'REQ-CATALOG-004',
    testIds: ['TC-005', 'TC-006'],
    requirement: 'Level filter narrows the catalog to the exact expected count',
    notes: 'Same checkbox/label-click behavior as REQ-CATALOG-003.'
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
      "Case creation succeeds, but Salesforce reassigns the new Case's owner to the org's default owner right after creation — required guest-sharing behavior, not a bug. That reassignment races the UI's success toast, which sometimes shows a cosmetic \"resource does not exist\" error even though the Case was created correctly. Confirmed via SOQL and by inspecting the failing request/response directly. The test checks the outgoing request payload instead of relying on the toast."
  },
  {
    reqId: 'REQ-CASE-003',
    testIds: ['TC-009'],
    requirement:
      'Submitting Create Case with required fields empty shows validation and does not create a case',
    notes:
      "Subject and Description aren't actually required on this form — a blank submission creates a Case anyway. Confirmed via SOQL: blank-Subject Cases exist from real guest submissions. The test is wrapped in `test.fail()`, so a pass means the gap is still there; if it ever starts failing instead, that's the signal the form's validation was fixed."
  },
  {
    reqId: 'REQ-GUEST-001',
    testIds: ['TC-010'],
    requirement: 'Guest sees a Login option and no authenticated-only content',
    notes:
      'The login control is a button labeled "Log in" (lowercase "in"), not a link labeled "Log In" as first assumed.'
  }
];

export const internalSuite = [
  {
    reqId: 'REQ-CASE-001',
    testIds: ['TC-011'],
    requirement: 'A case submitted as a guest actually appears in the internal Case list',
    notes:
      "Submits a real guest Case, then confirms it shows up in the internal Case list by Case Number. The list's own search box lags for several seconds after a new Case is created, so the test sorts by Case Number descending instead — the newest Case is always row 1."
  },
  {
    reqId: 'REQ-PRODUCT-001',
    testIds: ['TC-012'],
    requirement: 'Product Explorer loads real product data for an internal user',
    notes:
      "Product Explorer is a separate internal page from the guest catalog, though built on the same components. Selecting a tile shows a detail card headed by the product name, distinct from the guest catalog's plain detail panel."
  },
  {
    reqId: 'REQ-ORDER-001',
    testIds: ['TC-013'],
    requirement: 'An internal user can build an order via the `orderBuilder` component',
    notes:
      "Order Builder uses real HTML5 drag-and-drop with genuine shadow DOM, and Playwright's built-in `dragTo()` drags the wrong product every time — manually dispatching the drag events on the tile's real draggable node works instead. Dropping a tile creates an order item priced at 60% of MSRP; the header's \"Total Items\" count sums quantities, not line items. Reloading this page can trigger a real app bug on WebKit, so a quantity edit is confirmed via SOQL instead of a page reload."
  },
  {
    reqId: 'REQ-PRODUCT-002',
    testIds: ['TC-014'],
    requirement: 'An internal user can view/edit a Product record',
    notes:
      "Both the top-right \"Edit\" button and every field's pencil icon open the same full-record edit modal — there's no separate lightweight per-field editor despite what the icons suggest."
  }
];

export const apiSuite = [
  {
    reqId: 'REQ-API-001',
    testIds: ['TC-015'],
    requirement: 'Querying Product__c via the standard REST API returns the correct MSRP for a known product',
    notes:
      "Queries the REST API directly with a bearer token, no browser involved, and confirms the same $2,500 MSRP the Guest Suite sees in the rendered UI. Getting a real token took an extra step: current `sf` CLI versions redact the access token from `org display`, so the test fetches it via the dedicated `show-access-token` command instead."
  },
  {
    reqId: 'REQ-API-002',
    testIds: ['TC-016'],
    requirement: 'A Case can be created directly via the REST API, bypassing the LWC UI entirely',
    notes:
      "E-Bikes has no custom REST endpoint of its own — this hits Salesforce's standard Case-creation endpoint directly, the same one the UI's Lightning Data Service calls under the hood, and confirms the record round-trips via a follow-up GET."
  },
  {
    reqId: 'REQ-API-003',
    testIds: ['TC-017'],
    requirement: 'A Case created via REST can be updated via REST and the change persists',
    notes: 'A REST update returns a 204 with an empty body, which is normal — the test confirms the change actually persisted with a separate GET rather than trusting the PATCH response.'
  },
  {
    reqId: 'REQ-API-004',
    testIds: ['TC-018'],
    requirement: 'A Case created via REST can be deleted via REST',
    notes:
      "The only test in this repo that cleans up after itself on purpose — deleting the record it just created is exactly what's being tested, not tidying up. Confirms with a follow-up GET that it now returns 404."
  },
  {
    reqId: 'REQ-API-005',
    testIds: ['TC-019'],
    requirement: 'Requesting a nonexistent record Id returns a 404 with the expected Salesforce error shape',
    notes:
      'Requests a Case Id that\'s syntactically valid but nonexistent, and confirms the REST API returns a proper 404 with a `NOT_FOUND` error code — the same underlying error that causes REQ-CASE-002\'s cosmetic UI failure, asserted directly here instead of inferred from a race.'
  }
];

export const authzSuite = [
  {
    reqId: 'REQ-AUTHZ-001',
    testIds: ['TC-020'],
    requirement: 'A guest session cannot reach the standard REST API',
    notes:
      "A real guest session's cookies get a non-OK response hitting the standard REST API directly — the guest profile isn't granted API access."
  },
  {
    reqId: 'REQ-AUTHZ-002',
    testIds: ['TC-021'],
    requirement: 'A guest session cannot read a Case it does not own via the UI API (cross-record IDOR)',
    notes:
      "A guest session gets refused when it tries to read an arbitrary existing Case by Id — the guest profile has no broad read access or sharing rule on Case, only access to specific records it's explicitly granted."
  },
  {
    reqId: 'REQ-AUTHZ-003',
    testIds: ['TC-022'],
    requirement:
      'A guest cannot set a field absent from the Create Case form via a tampered createRecord payload (mass assignment / Broken Object Property Level Authorization)',
    notes:
      "A guest tries to sneak an unauthorized field (`IsEscalated`) into a Case-creation request. Salesforce rejects the entire request outright instead of silently dropping the field — no Case gets created at all."
  },
  {
    reqId: 'REQ-AUTHZ-004',
    testIds: ['TC-029'],
    requirement: 'The guest site sets Content-Security-Policy, X-Frame-Options, and Strict-Transport-Security headers on its main document response',
    notes:
      "All three headers are already present, confirmed by inspecting the live response directly — Salesforce Experience Cloud sets them automatically as platform defaults, not something this app configured. A positive confirmation, not a gap: CSP is the safety net that blocks an injected script from executing even if input escaping has a gap elsewhere, X-Frame-Options blocks this site being clickjacked inside a malicious iframe, and HSTS blocks an SSL-stripping downgrade on the very first connection."
  },
  {
    reqId: 'REQ-AUTHZ-005',
    testIds: ['TC-030'],
    requirement: "A guest-submitted `<script>` payload in Case Subject does not execute in an internal agent's view (stored XSS)",
    notes:
      "Submits `<script>window.__xssFired=true</script>...` as a guest, then views the same Case as an internal user and checks directly whether the script actually executed (not just whether the raw tag appears in the HTML). It does render into the page — inside Salesforce's own `lightning-formatted-text` component, which HTML-entity-escapes it — but never executes. A positive confirmation of the platform's default escaping, not a gap."
  }
];

/**
 * Accessibility Suite — axe-core scans (WCAG 2.1/2.2 Level A and AA)
 * against representative pages from both the Guest and Internal Suites.
 * Every row carries a `scope` field naming who owns fixing any violation
 * found — this app's own LWC markup (ebikes-lwc), or Salesforce's own
 * global Lightning chrome, which no app built on the platform can fix
 * from its own code. That distinction is deliberately surfaced as its own
 * column in the generated table, not left buried in a code comment.
 */
export const a11ySuite = [
  {
    reqId: 'REQ-A11Y-001',
    testIds: ['TC-023'],
    requirement: 'Guest catalog page has no WCAG 2.1/2.2 Level A/AA violations',
    scope: '—',
    notes:
      "Fixed. The paginator's next/previous icon button had no discernible text (axe-core `button-name`, WCAG 2.1 A, critical) — it was using a slotted `<label>` child, which `lightning-button-icon` doesn't recognize as an accessible name at all. Fixed by adding `alternative-text` in ebikes-lwc's `paginator.html`, redeployed, and confirmed clean against the live org."
  },
  {
    reqId: 'REQ-A11Y-002',
    testIds: ['TC-024'],
    requirement: 'Guest Create Case form has no WCAG 2.1/2.2 Level A/AA violations',
    scope: '—',
    notes: 'Clean — zero violations found.'
  },
  {
    reqId: 'REQ-A11Y-003',
    testIds: ['TC-025'],
    requirement: 'Internal Product Explorer has no WCAG 2.1/2.2 Level A/AA violations',
    scope: 'Platform (Salesforce)',
    notes:
      "Two app-level gaps here originally — the same paginator icon button as the Guest catalog, plus a separate action icon button on the product detail card, both missing `alternative-text` (`button-name`, WCAG 2.1 A, critical) — are now fixed in ebikes-lwc and confirmed clean. One platform-level gap remains: the global favorites-star button in Salesforce's own Lightning chrome is under the WCAG 2.2 minimum touch target size (`target-size`, WCAG 2.2 AA, serious) — not something this app's code can fix, since it isn't this app's markup."
  },
  {
    reqId: 'REQ-A11Y-004',
    testIds: ['TC-026'],
    requirement: 'Internal Order Builder has no WCAG 2.1/2.2 Level A/AA violations',
    scope: '—',
    notes:
      "Fixed. Same paginator icon button gap as the Guest catalog and Product Explorer (`button-name`, WCAG 2.1 A, critical, one root-cause component, three pages affected) — fixed by adding `alternative-text` in ebikes-lwc's `paginator.html`, redeployed, and confirmed clean against the live org."
  },
  {
    reqId: 'REQ-A11Y-005',
    testIds: ['TC-027'],
    requirement: 'Internal Product record view has no WCAG 2.1/2.2 Level A/AA violations',
    scope: 'Platform (Salesforce)',
    notes:
      "Only the global favorites-star touch-target gap (`target-size`, WCAG 2.2 AA, serious) — Salesforce's own Lightning chrome, not this app's markup."
  },
  {
    reqId: 'REQ-A11Y-006',
    testIds: ['TC-028'],
    requirement: 'Internal Case list has no WCAG 2.1/2.2 Level A/AA violations',
    scope: 'Platform (Salesforce)',
    notes:
      "Only the global favorites-star touch-target gap (`target-size`, WCAG 2.2 AA, serious) — Salesforce's own Lightning chrome, not this app's markup."
  }
];
