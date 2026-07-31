import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { CreateCasePage } from '../pages/CreateCasePage';
import { InternalCaseListPage } from '../pages/InternalCaseListPage';
import { ProductExplorerPage } from '../pages/ProductExplorerPage';
import { ProductRecordPage } from '../pages/ProductRecordPage';
import { OrderBuilderPage } from '../pages/OrderBuilderPage';

/**
 * Internal Suite — authenticated Lightning app tests. Runs against the
 * `chromium-internal`/`firefox-internal`/`webkit-internal` projects, which
 * depend on `auth.setup.ts` and reuse its saved `storageState` — no login
 * step here.
 *
 * All navigation in this file uses absolute URLs built from
 * `readInternalOrigin()` (see `tests/auth.setup.ts`): the internal
 * Lightning app lives on a different origin than `playwright.config.ts`'s
 * `baseURL`, which points at the guest Experience Cloud community.
 *
 * These tests create real records in the live org (a Case, an Order__c +
 * Order_Item__c, and a Product__c field edit) and do not clean them up
 * afterward — consistent with the Guest Suite's Create Case tests, which
 * already leave real Case records behind on every run.
 *
 * Every test calls `test.slow()`: the internal Lightning app (App
 * Launcher chrome, full Lightning framework, heavier LWCs like Product
 * Explorer's tile grid) loads noticeably slower than the guest storefront,
 * especially in headless Firefox/WebKit — confirmed against the live org
 * that the default 30s timeout isn't enough there even though Chromium
 * clears it comfortably.
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

test.describe('Guest-to-internal handoff', () => {
  test('a guest-submitted Case appears in the internal Case list', { tag: '@TC-011' }, async ({
    page,
    browser
  }) => {
    test.slow();
    const subject = `Internal Suite check ${Date.now()}`;
    const description = 'Created by the Internal Suite to verify guest-to-internal visibility.';

    // Submit as a true guest: a fresh context with no storageState, on the
    // guest community's own origin, not the internal-authenticated `page`.
    const guestBaseURL = (process.env.E_BIKES_BASE_URL ?? '').replace(/\/+$/, '') + '/';
    const guestContext = await browser.newContext({ baseURL: guestBaseURL });
    const guestPage = await guestContext.newPage();
    const createCase = new CreateCasePage(guestPage);
    await guestPage.goto('create-case');
    await createCase.fillSubject(subject);
    await createCase.fillDescription(description);
    await createCase.submit();
    await createCase.expectSubmissionSucceeded({ subject, description });
    await guestContext.close();

    const [caseRecord] = sfQuery<{ CaseNumber: string }>(
      `SELECT CaseNumber FROM Case WHERE Subject = '${subject}' ORDER BY CreatedDate DESC LIMIT 1`
    );

    const caseList = new InternalCaseListPage(page);
    await caseList.goto();
    await caseList.expectCaseVisible(caseRecord.CaseNumber);
  });
});

test.describe('Product Explorer (internal)', () => {
  test('Product Explorer loads real product data for an internal user', { tag: '@TC-012' }, async ({
    page
  }) => {
    test.slow();
    const explorer = new ProductExplorerPage(page);
    await explorer.goto();

    await explorer.openProduct('FUSE X1');

    await explorer.expectDetailVisible('FUSE X1');
  });
});

test.describe('Reseller Orders / Order Builder', () => {
  test('an internal user can build an order via the Order Builder', { tag: '@TC-013' }, async ({
    page
  }) => {
    test.slow();
    const orderBuilder = new OrderBuilderPage(page);
    await orderBuilder.createOrder('Trailblazers');

    await orderBuilder.dragProductIntoOrder('FUSE X1');
    // Default quantities on drop are 1 Small + 1 Medium + 1 Large = 3.
    await orderBuilder.expectTotalItems(3);

    await orderBuilder.setQuantity('FUSE X1', 'Small', '2');

    // Confirm the quantity actually persisted server-side via updateRecord,
    // not just reflected in unsaved local component state. Deliberately
    // not a page.reload(): confirmed against the live org that reloading
    // this specific record page intermittently throws a real app-level
    // LWC @wire error (see OrderBuilderPage.currentOrderId doc comment).
    const [orderItem] = sfQuery<{ Qty_S__c: number }>(
      `SELECT Qty_S__c FROM Order_Item__c WHERE Order__c = '${orderBuilder.currentOrderId()}' AND Product__r.Name = 'FUSE X1'`
    );
    expect(orderItem.Qty_S__c).toBe(2);
  });
});

test.describe('Product records (internal)', () => {
  test('an internal user can view and edit a Product record', { tag: '@TC-014' }, async ({
    page
  }) => {
    test.slow();
    const productRecord = new ProductRecordPage(page);
    await productRecord.gotoRecentList();
    await productRecord.openProduct('FUSE X1');
    await expect(page.getByRole('heading', { name: 'FUSE X1' })).toBeVisible({
      timeout: 15000
    });

    await productRecord.edit();
    const updatedDescription = `Internal Suite edit check ${Date.now()}`;
    await productRecord.fieldInput('Description').fill(updatedDescription);
    await productRecord.save();

    await expect(page.getByText(updatedDescription)).toBeVisible({ timeout: 15000 });
  });
});
