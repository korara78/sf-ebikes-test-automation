import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { CreateCasePage } from '../pages/CreateCasePage';
import { getApiSession, getLatestApiRoot } from '../pages/apiSession';
import { readInternalOrigin } from '../pages/internalSession';

/**
 * Penetration Suite — authorization-boundary tests for the guest identity.
 *
 * Not generic endpoint smoke tests: each test targets a specific
 * authorization boundary the E-Bikes guest profile is *supposed* to
 * enforce (confirmed by reading the org's guest profile metadata directly
 * in `ebikes-lwc`), and asserts that boundary actually holds when probed
 * from the outside rather than trusting the metadata on paper. A failing
 * assertion here is a real, reportable finding (OWASP API Security Top
 * 10's Broken Object/Property Level Authorization), not a bug in the test —
 * same investigative posture as REQ-CASE-002/003 in Guide 3.
 *
 * TC-020–022 and TC-029 run against a fresh, storageState-less browser
 * context (a true guest, never the Internal Suite's authenticated `page`),
 * same pattern as REQ-CASE-001 in internal-app.spec.ts. TC-030 is the one
 * exception: submission is still done as a true guest, but confirming the
 * payload doesn't execute requires actually viewing it through an internal
 * agent's eyes — the realistic target of a stored-XSS attack — so that
 * test manually opens a second `browser.newContext({ storageState: ... })`
 * for the internal-view half, reusing the Internal Suite's saved session
 * without changing this suite's project-level default (no test here uses
 * the implicit `page`/`context` fixtures at all; every context is created
 * explicitly, guest or internal).
 *
 * TC-029/030 broaden this suite's original OWASP API Security Top 10
 * framing slightly: missing security headers and stored-input escaping are
 * general OWASP Top 10 (web) concerns, not API-specific, but they're the
 * same investigative posture — probe a boundary the platform is supposed
 * to enforce, empirically, rather than assume it holds.
 */

const SF_TARGET_ORG = process.env.SF_TARGET_ORG ?? 'mydevorg';

function sfQuery<T>(soql: string): T[] {
  const raw = execFileSync(
    'sf',
    ['data', 'query', '--query', soql, '--json', '-o', SF_TARGET_ORG],
    { encoding: 'utf-8', env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' } }
  );
  return (JSON.parse(raw) as { result: { records: T[] } }).result.records;
}

function guestBaseURL(): string {
  return (process.env.E_BIKES_BASE_URL ?? '').replace(/\/+$/, '') + '/';
}

// The current API version *path* (e.g. "/services/data/v61.0"), resolved
// once via the admin-authenticated org domain (always reachable) rather
// than the guest's own community domain — resolving it via the guest
// origin would be circular, since whether that origin proxies
// /services/data at all is exactly what TC-020 is testing.
let apiVersionPath: string;

test.beforeAll(async ({ playwright }) => {
  const session = getApiSession();
  const request = await playwright.request.newContext();
  const fullRoot = await getLatestApiRoot(request, session.instanceUrl);
  apiVersionPath = fullRoot.slice(session.instanceUrl.length);
  await request.dispose();
});

test.describe('Guest REST API reachability', () => {
  test('a guest session cannot call the standard REST API', { tag: '@TC-020' }, async ({
    browser
  }) => {
    const baseURL = guestBaseURL();
    const guestContext = await browser.newContext({ baseURL });
    const guestPage = await guestContext.newPage();
    // Visit the site first so the context actually holds the guest's real
    // session cookies, not an empty/unauthenticated request context.
    await guestPage.goto('create-case');

    const origin = new URL(baseURL).origin;
    const res = await guestContext.request.get(`${origin}${apiVersionPath}/sobjects/Case/describe`);

    // The guest profile grants no `ApiEnabled` permission (confirmed in
    // the org's guest profile metadata) — a 200 here would mean the
    // standard REST API is unexpectedly reachable with just a guest
    // session's cookies.
    expect(res.ok()).toBeFalsy();

    await guestContext.close();
  });
});

test.describe('Guest cross-record read (IDOR)', () => {
  test('a guest session cannot read a Case it does not own via the UI API', {
    tag: '@TC-021'
  }, async ({ browser }) => {
    const [foreignCase] = sfQuery<{ Id: string }>(
      'SELECT Id FROM Case ORDER BY CreatedDate DESC LIMIT 1'
    );

    const baseURL = guestBaseURL();
    const guestContext = await browser.newContext({ baseURL });
    const guestPage = await guestContext.newPage();
    await guestPage.goto('create-case');

    const origin = new URL(baseURL).origin;
    const res = await guestContext.request.get(
      `${origin}${apiVersionPath}/ui-api/records/${foreignCase.Id}?fields=Case.Subject`
    );

    // The guest profile has Case allowRead=true but no viewAllRecords and
    // no guest sharing rule on Case (confirmed in guest profile metadata)
    // — a guest should only ever see records it's explicitly been granted
    // access to, never an arbitrary existing Case by Id.
    expect(res.ok()).toBeFalsy();

    await guestContext.close();
  });
});

test.describe('Guest mass-assignment / BOPLA on Case creation', () => {
  test('a guest cannot set IsEscalated via a tampered createRecord payload', {
    tag: '@TC-022'
  }, async ({ browser }) => {
    const baseURL = guestBaseURL();
    const guestContext = await browser.newContext({ baseURL });
    const guestPage = await guestContext.newPage();
    const subject = `Penetration Suite mass-assignment check ${Date.now()}`;

    // Intercept the real createRecord Aura action (same request
    // CreateCasePage.submit() observes passively) and inject a field that
    // is not present anywhere on the rendered form — Case.IsEscalated,
    // confirmed not editable for the guest profile in its metadata. If
    // Lightning Data Service enforces field-level security server-side,
    // this field should be dropped/rejected regardless of what the client
    // sends.
    await guestPage.route(
      (url) => url.toString().includes('/aura'),
      async (route) => {
        const req = route.request();
        if (req.method() !== 'POST' || !(req.postData() ?? '').includes('ACTION%24createRecord')) {
          await route.continue();
          return;
        }
        const params = new URLSearchParams(req.postData() ?? '');
        const message = JSON.parse(params.get('message') ?? '{}');
        const action = message.actions?.[0];
        if (action?.params?.recordInput?.apiName === 'Case') {
          action.params.recordInput.fields.IsEscalated = true;
        }
        params.set('message', JSON.stringify(message));
        await route.continue({ postData: params.toString() });
      }
    );

    const createCase = new CreateCasePage(guestPage);
    await guestPage.goto('create-case');
    await createCase.fillSubject(subject);
    await createCase.fillDescription(
      'Testing whether a field absent from the form can be injected into the create payload.'
    );

    // Wait for the createRecord round-trip to actually complete server-side
    // before closing the context — closing right after the click risks
    // aborting the in-flight request, which would silently look like a
    // "secure" result (no Case found) without the boundary ever being
    // exercised.
    const responseReceived = guestPage.waitForResponse(
      (res) =>
        res.request().method() === 'POST' &&
        res.url().includes('/aura') &&
        (res.request().postData() ?? '').includes('ACTION%24createRecord')
    );
    await createCase.submitButton.click();
    const response = await responseReceived;
    const responseBody = await response.text();
    await guestContext.close();

    const results = sfQuery<{ IsEscalated: boolean }>(
      `SELECT IsEscalated FROM Case WHERE Subject = '${subject}' ORDER BY CreatedDate DESC LIMIT 1`
    );

    // Confirmed against the live org: Lightning Data Service enforces
    // field-level security server-side even against a raw tampered
    // payload — it doesn't silently drop the inaccessible field and create
    // the Case anyway, it rejects the ENTIRE request outright with an
    // explicit error naming the offending field ("Unable to create/update
    // fields: IsEscalated. Please check the security settings of this
    // field..."), and no Case is created at all. This is a stronger secure
    // outcome than either alternative originally considered here.
    expect(results.length, 'expected the tampered create to be rejected outright, creating no Case').toBe(0);
    expect(responseBody).toContain('IsEscalated');
  });
});

test.describe('Security response headers', () => {
  test('the guest site sets CSP, X-Frame-Options, and HSTS on its main document response', {
    tag: '@TC-029'
  }, async ({ browser }) => {
    const baseURL = guestBaseURL();
    const guestContext = await browser.newContext({ baseURL });
    const guestPage = await guestContext.newPage();

    const response = await guestPage.goto('create-case');
    const headers = response?.headers() ?? {};
    await guestContext.close();

    // Confirmed against the live org: Salesforce Experience Cloud sets all
    // three automatically as platform defaults — this isn't a gap being
    // probed, it's a positive confirmation, so a future regression here
    // (e.g. a security setting disabled in Setup) is exactly what should
    // flip this to a Regression rather than pass silently.
    expect(headers['content-security-policy'], 'CSP prevents an injected script from executing even if input escaping has a gap elsewhere').toBeTruthy();
    expect(headers['x-frame-options'], 'X-Frame-Options prevents this site being clickjacked inside a malicious iframe').toBeTruthy();
    expect(headers['strict-transport-security'], 'HSTS prevents an SSL-stripping downgrade on the first connection').toBeTruthy();
  });
});

test.describe('Stored input escaping (XSS)', () => {
  test('a guest-submitted script payload in Case Subject does not execute in an internal agent\'s view', {
    tag: '@TC-030'
  }, async ({ browser }) => {
    test.slow();
    // Unlike the other tests in this suite, this one also needs the
    // internal session — created explicitly below via browser.newContext()
    // rather than test.use(), since this test never touches the implicit
    // page/context fixtures at all (everything runs through manually
    // created contexts, matching the rest of this file's pattern).

    const payload = `<script>window.__xssFired=true</script>XSS-check-${Date.now()}`;

    const baseURL = guestBaseURL();
    const guestContext = await browser.newContext({ baseURL });
    const guestPage = await guestContext.newPage();
    const createCase = new CreateCasePage(guestPage);
    await guestPage.goto('create-case');
    await createCase.fillSubject(payload);
    await createCase.fillDescription('Stored XSS check.');
    await createCase.submit();
    await createCase.expectSubmissionSucceeded({ subject: payload, description: 'Stored XSS check.' });
    await guestContext.close();

    const [caseRecord] = sfQuery<{ Id: string }>(
      `SELECT Id FROM Case WHERE Subject = '${payload.replace(/'/g, "\\'")}' ORDER BY CreatedDate DESC LIMIT 1`
    );

    const internalContext = await browser.newContext({ storageState: 'playwright/.auth/user.json' });
    const internalPage = await internalContext.newPage();
    const origin = readInternalOrigin();
    await internalPage.goto(`${origin}/lightning/r/Case/${caseRecord.Id}/view`);
    // Confirmed against the live org: the Case record page renders Subject
    // in multiple places at once (highlight panel, a tab's output text,
    // the Details field) — .first() avoids a strict-mode violation, since
    // this just needs to know the payload has landed somewhere, not which
    // specific occurrence.
    await expect(internalPage.getByText('XSS-check-', { exact: false }).first()).toBeVisible({
      timeout: 15000
    });

    // Confirmed against the live org: the payload does render into the
    // page (as escaped text inside Salesforce's own lightning-formatted-text
    // component), but the browser never executes it as a real <script>
    // element — this checks that directly, at the JS-execution level,
    // rather than just inspecting HTML for an unescaped tag.
    const scriptExecuted = await internalPage.evaluate(() => (window as any).__xssFired === true);
    await internalContext.close();

    expect(scriptExecuted, 'a guest-submitted <script> tag should never execute in an internal agent\'s authenticated session').toBeFalsy();
  });
});
