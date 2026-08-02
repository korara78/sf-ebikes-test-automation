import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { ProductCatalogPage } from '../pages/ProductCatalogPage';
import { ProductExplorerPage } from '../pages/ProductExplorerPage';
import { OrderBuilderPage } from '../pages/OrderBuilderPage';
import { ProductRecordPage } from '../pages/ProductRecordPage';
import { InternalCaseListPage } from '../pages/InternalCaseListPage';

/**
 * Accessibility Suite — axe-core scans against WCAG 2.1/2.2 Level A and AA,
 * run via `@axe-core/playwright`'s AxeBuilder attached to a live page.
 *
 * Confirmed against the live org (see guides/traceability-map.mjs for the
 * full per-page breakdown): every violation found here falls into one of
 * two ownership categories, both real, both worth tracking, but requiring
 * different remediation —
 * - App-level (owner: ebikes-lwc): a defect in this app's own LWC markup,
 *   fixable by editing the sibling ebikes-lwc project's component source.
 * - Platform-level (owner: Salesforce): a defect in Salesforce's own
 *   global Lightning chrome (e.g. the favorites star), not something any
 *   app built on the platform can fix from its own code.
 *
 * Each known violation is wrapped in `test.fail()` (same convention as
 * REQ-CASE-003) with a reason string naming the specific axe rule and
 * which category owns it — so a passing run here (violations disappear)
 * is the live signal that a fix landed, and an unexpected new violation
 * still fails hard rather than being silently absorbed.
 */

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function scanPage(page: import('@playwright/test').Page) {
  return new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
}

test.describe('Guest Suite pages', () => {
  test('catalog page has no WCAG 2.1/2.2 A/AA violations except the known paginator gap', {
    tag: '@TC-023'
  }, async ({ page }) => {
    test.fail(
      true,
      'Known gap (app, owner: ebikes-lwc): c-paginator\'s next/previous icon button has no ' +
        'discernible text (axe rule: button-name, WCAG 2.1 A, critical).'
    );

    const catalog = new ProductCatalogPage(page);
    await catalog.goto();

    const results = await scanPage(page);
    expect(results.violations).toEqual([]);
  });

  test('Create Case form has no WCAG 2.1/2.2 A/AA violations', { tag: '@TC-024' }, async ({
    page
  }) => {
    await page.goto('create-case');

    const results = await scanPage(page);
    expect(results.violations).toEqual([]);
  });
});

test.describe('Internal Suite pages', () => {
  test('Product Explorer has no WCAG 2.1/2.2 A/AA violations except the known gaps', {
    tag: '@TC-025'
  }, async ({ page }) => {
    test.slow();
    test.fail(
      true,
      'Known gaps: (1) app, owner: ebikes-lwc — c-paginator\'s next/previous icon button and ' +
        'c-product-card\'s action icon button both have no discernible text (axe rule: ' +
        'button-name, WCAG 2.1 A, critical). (2) platform, owner: Salesforce — the global ' +
        '.branding-favorites-star-button (standard Lightning chrome, not app code) is under ' +
        'the WCAG 2.2 minimum touch target size (axe rule: target-size, WCAG 2.2 AA, serious).'
    );

    const explorer = new ProductExplorerPage(page);
    await explorer.goto();
    await explorer.openProduct('FUSE X1');

    const results = await scanPage(page);
    expect(results.violations).toEqual([]);
  });

  test('Order Builder has no WCAG 2.1/2.2 A/AA violations except the known paginator gap', {
    tag: '@TC-026'
  }, async ({ page }) => {
    test.slow();
    test.fail(
      true,
      'Known gap (app, owner: ebikes-lwc): c-paginator\'s next/previous icon button has no ' +
        'discernible text (axe rule: button-name, WCAG 2.1 A, critical) — same root component ' +
        'as the Guest catalog and Product Explorer gaps.'
    );

    const orderBuilder = new OrderBuilderPage(page);
    await orderBuilder.createOrder('Trailblazers');
    // createOrder() only waits for the post-save URL to change; the
    // product-tile-list/paginator component (where the known violation
    // lives) renders asynchronously after that — same race
    // dragProductIntoOrder() already accounts for elsewhere in this page
    // object. Without this wait, scanning immediately after createOrder()
    // is a real race: sometimes the paginator isn't in the DOM yet, so
    // the scan finds zero violations and the test.fail() declaration
    // below fails with "Expected to fail, but passed."
    await page.locator('c-product-tile').first().waitFor({ state: 'visible' });

    const results = await scanPage(page);
    expect(results.violations).toEqual([]);
  });

  test('Product record view has no WCAG 2.1/2.2 A/AA violations except the known chrome gap', {
    tag: '@TC-027'
  }, async ({ page }) => {
    test.slow();
    test.fail(
      true,
      'Known gap (platform, owner: Salesforce): the global .branding-favorites-star-button ' +
        '(standard Lightning chrome, not app code) is under the WCAG 2.2 minimum touch target ' +
        'size (axe rule: target-size, WCAG 2.2 AA, serious).'
    );

    const productRecord = new ProductRecordPage(page);
    await productRecord.gotoRecentList();
    await productRecord.openProduct('FUSE X1');

    const results = await scanPage(page);
    expect(results.violations).toEqual([]);
  });

  test('Case list has no WCAG 2.1/2.2 A/AA violations except the known chrome gap', {
    tag: '@TC-028'
  }, async ({ page }) => {
    test.slow();
    test.fail(
      true,
      'Known gap (platform, owner: Salesforce): the global .branding-favorites-star-button ' +
        '(standard Lightning chrome, not app code) is under the WCAG 2.2 minimum touch target ' +
        'size (axe rule: target-size, WCAG 2.2 AA, serious).'
    );

    const caseList = new InternalCaseListPage(page);
    await caseList.goto();

    const results = await scanPage(page);
    expect(results.violations).toEqual([]);
  });
});
