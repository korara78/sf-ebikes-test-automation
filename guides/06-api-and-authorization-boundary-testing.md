# Guide 6: API & Authorization Boundary Testing

**Project:** Salesforce LWC Test Automation Portfolio (E-Bikes)
**Status:** ✅ Built and verified against the live org — all 10 tests (API Suite + Penetration Suite) confirmed passing, including one real fix and one genuine security finding surfaced by the first live run (see below), plus two positive confirmations (security response headers, stored-XSS escaping) added afterward.

---

## Overview

The Guest Suite and Internal Suite (Guides 2–5) both drive the app through a browser. This guide covers two suites that don't: an **API Suite** (`tests/api.spec.ts`) that calls Salesforce's REST API directly, and a **Penetration Suite** (`tests/penetration.spec.ts`) that probes specific authorization boundaries the guest profile is supposed to enforce.

The goal going in was explicitly *not* generic endpoint smoke tests ("hit an endpoint, assert 200"). Two things shape what actually got built instead:

1. **What server-side API surface E-Bikes actually has** — determined by reading the Apex source in the sibling `ebikes-lwc` checkout, not assumed.
2. **What the guest profile's metadata claims to enforce** — also read directly, then tested empirically rather than trusted on paper. A failing assertion in the Penetration Suite is a real, reportable finding (in OWASP API Security Top 10 terms), not a test bug — the same investigative posture Guide 3 already established for REQ-CASE-002/003.

Two tests added after the initial build (`TC-029`/`TC-030`) broaden that framing slightly: missing security response headers and stored-input escaping are general **OWASP Top 10 (web)** concerns, not API-specific ones. Same investigative posture either way — verify the boundary actually holds by running the probe against the live org, don't assume it from documentation. Both came back as **positive confirmations** rather than gaps: this org's platform defaults (Experience Cloud's automatic security headers, Salesforce's default field-rendering escaping) already hold. That's still a legitimate, worthwhile finding to lock in with a test — it's the thing that would catch a regression if either default ever got silently disabled.

---

## What Server-Side API Surface E-Bikes Actually Has

Read directly from `ebikes-lwc`'s Apex classes (`force-app/main/default/classes/`):

- **No custom `@RestResource` endpoint exists anywhere in this app.** `grep -rn "@RestResource"` across the whole checkout returns nothing.
- The only custom server-side surface is three **read-only, cacheable** `@AuraEnabled` methods, all `scope='global'` (guest-reachable) and all `with sharing` + `WITH USER_MODE` SOQL:
  - `ProductController.getProducts(Filters, Integer)` — the product catalog query.
  - `ProductController.getSimilarProducts(Id productId, Id familyId)` — takes bare record Ids from the client.
  - `ProductRecordInfoController.getRecordInfo(String name)` — takes an arbitrary name string.
  - (`OrderController.getOrderItems(Id orderId)` also exists, but its Apex class access is explicitly **disabled** for the guest profile — see below.)
- **Every mutation in this app — Case creation, Order__c/Order_Item__c create/update/delete — goes through Salesforce's standard Lightning Data Service**, not custom Apex: `createCase.js` uses `<lightning-record-edit-form>`, and `orderBuilder.js` calls `lightning/uiRecordApi`'s `createRecord`/`updateRecord`/`deleteRecord` directly.

**What this means for the API Suite:** there's no bespoke endpoint to write CRUD tests against. The realistic, honest target is Salesforce's own standard REST API (`/services/data/vXX.X/sobjects/...`), authenticated as the same internal identity every other suite here already uses — exercising the exact endpoints LDS itself calls, just from `request` instead of a browser.

---

## What the Guest Profile's Metadata Claims to Enforce

Read directly from `ebikes-lwc/guest-profile-metadata/profiles/E-Bikes Profile.profile` (a separate metadata folder retrieved from the org's guest profile, not part of the main deployable package):

| Object | Guest access |
|---|---|
| `Case` | `allowCreate=true`, `allowRead=true`, `allowEdit=false`, `allowDelete=false`, **no `viewAllRecords`** |
| `Product__c` / `Product_Family__c` | read-only, but **`viewAllRecords=true`** via an explicit guest sharing rule (this is what makes the public catalog work) |
| `Order__c` / `Order_Item__c` | **no object permission entry at all** for the guest profile |
| Apex class access | `ProductController`, `ProductRecordInfoController` enabled; **`OrderController` explicitly disabled** |
| `ApiEnabled` | not granted anywhere in this profile |

Two things stand out as genuine boundaries worth testing empirically rather than assuming they hold:
- Product data being fully public (`viewAllRecords=true`) means the two Id-taking Apex methods (`getSimilarProducts`, `getRecordInfo`) aren't meaningful IDOR targets — a guest can already read all of that data through the normal catalog anyway. **Deliberately excluded** from the Penetration Suite for this reason, rather than padding it with a test that can't fail.
- Case access (`allowRead=true`, no `viewAllRecords`) and the total absence of `ApiEnabled` *are* meaningful boundaries — a guest should be able to create a Case but never read someone else's, and should never reach the standard REST API at all. These became REQ-AUTHZ-001/002.

---

## The API Suite (`tests/api.spec.ts`)

Five tests (TC-015–TC-019), authenticated as the `mydevorg` admin identity via a bearer token — a new auth pattern in this repo, but built to match the existing shape exactly:

```ts
// pages/apiSession.ts
const displayRaw = execFileSync(
  'sf', ['org', 'display', '--json', '-o', SF_TARGET_ORG],
  { encoding: 'utf-8', env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' } }
); // -> instanceUrl

const tokenRaw = execFileSync(
  'sf', ['org', 'auth', 'show-access-token', '-o', SF_TARGET_ORG, '--json'],
  { encoding: 'utf-8', env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' } }
); // -> accessToken
```

Same `execFileSync` + `FORCE_COLOR`/`NO_COLOR` shape used everywhere else in this repo for shelling out to `sf` (see `tests/auth.setup.ts`, `tests/internal-app.spec.ts`) — but split across two commands, which is itself the first real finding this suite produced.

**Confirmed only by running it against the live org:** the original single-call design (`sf org display --json --verbose`) failed every authenticated test with a uniform 401. Current `sf` CLI versions redact `accessToken` from `org display` output entirely, even with `--verbose` — the JSON literally contains `"accessToken": "[REDACTED] Use 'sf org auth show-access-token' to view"`, per the CLI's own warning ("Secrets are now hidden from 'sf org display' command output"). That placeholder string was being sent as the bearer token verbatim, guaranteeing rejection. Confirmed by comparing `sf org display --json --verbose` output directly against `sf org auth show-access-token -o mydevorg --json`, the latter of which requires `--json` (or `--no-prompt`) specifically to skip its own separate confirmation prompt. `instanceUrl` isn't considered sensitive and was unaffected — only the access token needed the dedicated command.

Guide 4 anticipated exactly this seam when the Internal Suite's projects were first wired up: *"a future security-focused suite (a different user, or no auth at all) can be added the same way without touching this one."* This suite is the "different [access] mechanism" half of that; the Penetration Suite below is the "no auth at all" half.

The API version is resolved dynamically (`GET /services/data/` — Salesforce's own unauthenticated version listing) rather than hardcoded, so the suite doesn't quietly go stale as the org gets upgraded.

**Coverage:** query (Product MSRP, cross-checked against the Guest Suite's own $2,500 UI assertion), create, update, delete — a full CRUD lifecycle against a Case — plus a dedicated negative-path test (a syntactically valid but nonexistent Case Id, asserting the `NOT_FOUND` error shape that REQ-CASE-002 already found buried inside an Aura response). The create/update/delete lifecycle runs in a `test.describe.serial` block since the three steps share one record — the only place in this repo relying on Playwright's `fullyParallel: true` *not* applying within a group of tests.

Unlike every other suite here, the delete test's record doesn't get left behind — deleting a record it just created is the thing under test, not cleanup.

---

## The Penetration Suite (`tests/penetration.spec.ts`)

Five tests (TC-020–TC-022, TC-029–TC-030). TC-020–022 and TC-029 each use a fresh, `storageState`-less guest browser context (same "true guest" pattern as REQ-CASE-001 in `internal-app.spec.ts`), never the bearer token above:

1. **TC-020 — REST API reachability.** A real guest page visit establishes actual session cookies; `browserContext.request` shares those cookies automatically (it's the same context), so `guestContext.request.get(...)` against the community site's own origin is exactly what a guest's browser could reach unassisted. Expects the standard REST API to be unreachable.
2. **TC-021 — cross-record read (IDOR).** Same cookie-sharing mechanism, aimed at the UI API (`/ui-api/records/<id>`) for the most recently created Case in the org (there's always one — every suite here leaves Cases behind). Expects a guest to be refused a Case it didn't create.
3. **TC-022 — mass assignment / BOPLA on Case creation.** Reuses the exact `aura://RecordUiController/ACTION$createRecord` payload shape `CreateCasePage` already parses for REQ-CASE-002, but via `page.route()` instead of the passive `waitForRequest` used there — intercepts the real request, injects `Case.IsEscalated: true` (a real field, absent from the rendered form, not editable per the guest profile's field-level security), and lets it continue.

   **Confirmed against the live org:** Lightning Data Service doesn't silently drop the inaccessible field and create the Case anyway — it rejects the **entire request outright**, and the UI surfaces exactly that: *"An error occurred while trying to update the record. Please try again. Unable to create/update fields: IsEscalated. Please check the security settings of this field and verify that it is read/write for your profile or permission set."* No Case is created at all. The test asserts this directly (SOQL confirms zero matching Cases; the captured Aura response body contains the string `IsEscalated`) rather than the two hypothetical outcomes originally considered when this test was written — a stronger, more specific secure result than either.
4. **TC-029 — security response headers.** A real guest page visit's main document response is inspected directly for `Content-Security-Policy`, `X-Frame-Options`, and `Strict-Transport-Security`. **Confirmed against the live org, verified before writing any assertion:** all three (plus `X-Content-Type-Options: nosniff`, not even originally in scope) are already present — Salesforce Experience Cloud sets them automatically. Not a gap; a positive confirmation, kept as a test specifically so a future regression (a security setting disabled in Setup) gets caught rather than passing silently.
5. **TC-030 — stored XSS via Case Subject.** The one test in this suite that also needs the Internal Suite's session: submits `<script>window.__xssFired=true</script>...` as a guest Case Subject, then opens a second `browser.newContext({ storageState: ... })` to view the same Case as an internal agent — the realistic target of a stored-XSS attack, not the guest who submitted it. Checks `window.__xssFired` directly (real JS execution), not just whether an unescaped `<script>` tag appears in the HTML. **Confirmed against the live org:** the payload does render into the page, inside Salesforce's own `lightning-formatted-text` component — but HTML-entity-escaped, so the script never executes. Also a positive confirmation, not a gap.

A version-discovery subtlety worth calling out: TC-020/021 resolve the API version path once via the *admin* session (always reachable), then apply that same path string to the guest's own origin — resolving it via the guest origin directly would be circular, since whether that origin proxies `/services/data` at all is exactly what TC-020 tests.

**Deliberately excluded, documented rather than attempted:** invoking `OrderController.getOrderItems` as guest to confirm its guest-profile-disabled class access actually holds. This would require reverse-engineering a raw Aura `ApexAction` envelope with no working template in this repo to base it on (`CreateCasePage` only demonstrates the *record-UI* action shape, not the generic Apex-method-invocation shape) — a real, differently-scoped effort, deferred rather than rushed.

---

## Config Wiring

Two new `playwright.config.ts` projects, both intentionally single-browser (unlike the Guest/Internal Suites' 3-browser matrix) since neither suite's behavior is rendering-dependent:

```
api          → tests/api.spec.ts          (no browser/page — pure `request` calls)
penetration  → tests/penetration.spec.ts  (chromium only — probes server-side authz, not rendering)
```

The API Suite has no `setup` dependency — it authenticates via bearer token, not `storageState`. The `penetration` project does depend on `setup`, added when TC-030 was added: every test in this suite still creates its own context explicitly (guest or internal), never relying on the project-level default, but TC-030 needs the Internal Suite's saved session to exist by the time it runs. CI needs no changes — `.github/workflows/playwright.yml` already runs `npx playwright test` unscoped, so both projects (and this later addition) run automatically once pushed, using the same JWT-authenticated `mydevorg` alias Guide 4 already set up.

---

## Security Notes

- **The bearer token from `sf org auth show-access-token` is a live, full-scoped OAuth credential**, same caveat Guide 4 already raised about the frontdoor-bridge session: broader than the operation it's used for. It's never written to disk here (unlike `storageState`) — held in memory for the duration of the test run only.
- **This suite creates and reads real data in the personal Developer Edition org it targets.** All authorization probes here are against infrastructure the author owns and controls; none of this targets Salesforce's shared platform layer itself (which would require going through Salesforce's own security-testing authorization process, not something a personal Developer Edition login grants).
- **A failing Penetration Suite assertion is signal, not noise.** Per the `test.fail()` convention already established in Guide 3 for REQ-CASE-003: if any of TC-020/021/022 fail once actually run, the right next step is the same investigation loop already documented there (capture the exact request/response, confirm via SOQL, decide whether it's a real gap worth wrapping in `test.fail()` or a bug in the test itself) — not to loosen the assertion until it's green. TC-022 is exactly this in practice: the first real run failed, and the right response was to understand *why* (a genuine, stronger secure outcome) and correct the assertion to match reality, not to weaken it until green.
- **TC-029/030 are plain assertions, not `test.fail()`-wrapped** — unlike TC-020–022, they confirmed the boundary already holds rather than finding a gap. That means a failure in either one going forward is an unambiguous, immediate regression (a security header silently disabled, or escaping behavior changing), not something to investigate-then-wrap — the same posture as the Accessibility Suite's one clean result (`REQ-A11Y-002`) versus its Known Gaps.

---

## Verification Notes From the First Live Run

Two things surfaced only by actually running this against the org, neither predictable from reading CLI docs or Apex source alone:

1. **The `sf org display --verbose` token redaction** described above — the actual root cause of every API Suite test initially failing with 401.
2. **Running the full 51-test suite (all 9 projects) at the default worker count produced 5 flaky chromium-only failures** in the pre-existing Guest Suite catalog tests (TC-001–005) — timeouts waiting for elements that firefox/webkit handled fine in the same run. Re-running `--project=chromium` alone (no contention from 8 other concurrently-launching projects) passed all 10 tests cleanly, confirming this was worker-count resource contention in this environment, not a real regression. The full suite then passed 51/51 with `--workers=3`. Worth knowing if a future full local run shows isolated single-browser timeouts under heavy parallelism: rule out contention with a scoped re-run before treating it as a regression.

---

## What This Unblocked

[Guide 7: Accessibility Testing](07-accessibility-testing.md) — a fifth suite, following the same "run it against the live org first, see what's actually there" posture established here for the Penetration Suite.
