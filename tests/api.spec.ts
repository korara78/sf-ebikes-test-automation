import { test, expect } from '@playwright/test';
import { getApiSession, getLatestApiRoot } from '../pages/apiSession';

/**
 * API Suite — direct Salesforce REST API calls, no browser involved.
 *
 * E-Bikes has no custom `@RestResource` endpoints of its own (confirmed by
 * reading the `ebikes-lwc` Apex source: its only server-side surface is
 * three read-only, cacheable `@AuraEnabled` query methods). Its actual
 * write path — Case creation, Order__c/Order_Item__c create/update/delete —
 * goes through Salesforce's own standard Lightning Data Service, which is
 * exposed as the standard REST `sobjects` and `ui-api` endpoints. This
 * suite exercises that standard REST API directly, authenticated as the
 * same `mydevorg` admin identity the rest of this repo already uses,
 * bypassing the LWC UI entirely (unlike every other suite here, which
 * drives it through a browser).
 *
 * Authentication: `getApiSession()` (pages/apiSession.ts) reads a bearer
 * token off the already-authenticated `sf` CLI session via
 * `sf org display --json --verbose` — a new pattern in this repo, but the
 * same `execFileSync` + `FORCE_COLOR`/`NO_COLOR` shape used everywhere else
 * for shelling out to `sf`. Guide 4 already flagged this as the intended
 * seam for a future non-browser suite ("a future security-focused suite...
 * can be added the same way without touching this one").
 *
 * Like every other suite here, this creates real records in the live org.
 * The Case lifecycle test explicitly exercises Delete too (unlike the
 * other suites' "never clean up" convention) since deleting a record it
 * just created is itself the thing under test, not tidying up afterward.
 */

test.describe('Product query (read)', () => {
  test('querying Product__c via REST returns the correct MSRP for FUSE X1', {
    tag: '@TC-015'
  }, async ({ playwright }) => {
    const session = getApiSession();
    const request = await playwright.request.newContext();
    const apiRoot = await getLatestApiRoot(request, session.instanceUrl);

    const soql = "SELECT Id, Name, MSRP__c FROM Product__c WHERE Name = 'FUSE X1'";
    const res = await request.get(`${apiRoot}/query?q=${encodeURIComponent(soql)}`, {
      headers: { Authorization: `Bearer ${session.accessToken}` }
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    // Same $2,500 MSRP the Guest Suite's TC-002 confirms through the UI —
    // asserted here directly against the API response instead.
    expect(body.records[0].MSRP__c).toBe(2500);

    await request.dispose();
  });
});

test.describe.serial('Case lifecycle via REST (create/update/delete)', () => {
  let apiRoot: string;
  let headers: Record<string, string>;
  let caseId: string;
  const subject = `API Suite lifecycle check ${Date.now()}`;

  test.beforeAll(async ({ playwright }) => {
    const session = getApiSession();
    const request = await playwright.request.newContext();
    apiRoot = await getLatestApiRoot(request, session.instanceUrl);
    headers = { Authorization: `Bearer ${session.accessToken}` };
    await request.dispose();
  });

  test('a Case can be created directly via REST', { tag: '@TC-016' }, async ({ playwright }) => {
    const request = await playwright.request.newContext();

    const res = await request.post(`${apiRoot}/sobjects/Case`, {
      headers,
      data: {
        Subject: subject,
        Description: 'Created directly via REST by the API Suite (not through the LWC UI).',
        Priority: 'Medium'
      }
    });

    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    caseId = body.id;

    const getRes = await request.get(`${apiRoot}/sobjects/Case/${caseId}`, { headers });
    expect(getRes.status()).toBe(200);
    const created = await getRes.json();
    expect(created.Subject).toBe(subject);

    await request.dispose();
  });

  test('a Case created via REST can be updated via REST', { tag: '@TC-017' }, async ({ playwright }) => {
    const request = await playwright.request.newContext();

    const patchRes = await request.patch(`${apiRoot}/sobjects/Case/${caseId}`, {
      headers,
      data: { Priority: 'High' }
    });
    expect(patchRes.status()).toBe(204);

    const getRes = await request.get(`${apiRoot}/sobjects/Case/${caseId}`, { headers });
    const updated = await getRes.json();
    expect(updated.Priority).toBe('High');

    await request.dispose();
  });

  test('a Case created via REST can be deleted via REST', { tag: '@TC-018' }, async ({ playwright }) => {
    const request = await playwright.request.newContext();

    const deleteRes = await request.delete(`${apiRoot}/sobjects/Case/${caseId}`, { headers });
    expect(deleteRes.status()).toBe(204);

    const getRes = await request.get(`${apiRoot}/sobjects/Case/${caseId}`, { headers });
    expect(getRes.status()).toBe(404);

    await request.dispose();
  });
});

test.describe('Error handling (negative path)', () => {
  test('requesting a nonexistent Case Id returns 404 with the expected error shape', {
    tag: '@TC-019'
  }, async ({ playwright }) => {
    const session = getApiSession();
    const request = await playwright.request.newContext();
    const apiRoot = await getLatestApiRoot(request, session.instanceUrl);

    // Syntactically valid (18-char, correct "500" Case key prefix) but
    // guaranteed not to exist — same NOT_FOUND shape already documented in
    // REQ-CASE-002 (an Aura action wrapping this exact REST-level error).
    const fakeCaseId = '500' + '0'.repeat(12) + 'AAA';
    const res = await request.get(`${apiRoot}/sobjects/Case/${fakeCaseId}`, {
      headers: { Authorization: `Bearer ${session.accessToken}` }
    });

    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body[0].errorCode).toBe('NOT_FOUND');

    await request.dispose();
  });
});
