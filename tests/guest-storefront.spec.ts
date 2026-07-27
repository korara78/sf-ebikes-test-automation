import { test, expect } from '@playwright/test';
import { ProductCatalogPage } from '../pages/ProductCatalogPage';
import { ProductDetailPage } from '../pages/ProductDetailPage';
import { CreateCasePage } from '../pages/CreateCasePage';

/**
 * Tier 1 — Guest storefront tests. No login/session handling needed.
 *
 * Before running: set `baseURL` in playwright.config.ts (or pass full URLs
 * to goto()) to your deployed Experience Cloud site, e.g.
 * https://<your-domain>.my.site.com/E_Bikes/s/
 *
 * A few locators below are marked TODO — they're best guesses from the
 * E-Bikes LWC source, not confirmed against the actual rendered DOM of
 * your deployed org. Run headed (`npx playwright test --headed --debug`)
 * on the first pass and adjust anything that doesn't match.
 */

test.describe('Product catalog', () => {
  test('loads page 1 with 9 of 16 products, then pages to the remaining 7', async ({
    page
  }) => {
    const catalog = new ProductCatalogPage(page);
    await catalog.goto('/');

    await catalog.expectTotalItemCount(16);
    await catalog.expectPage(1, 2);
    expect(await catalog.productTileCount()).toBe(9);

    await catalog.goToNextPage();

    await catalog.expectPage(2, 2);
    expect(await catalog.productTileCount()).toBe(7);
  });

  test('clicking a product opens its detail page with correct name and price', async ({
    page
  }) => {
    const catalog = new ProductCatalogPage(page);
    const detail = new ProductDetailPage(page);
    await catalog.goto('/');

    await catalog.openProduct('FUSE X1');

    await detail.expectName('FUSE X1');
    // MSRP__c for FUSE X1 is 2500 in the sample data; currency formatting
    // has maximum-fraction-digits="0". TODO: confirm exact rendered string.
    await detail.expectMsrp('$2,500');
  });

  test('Category filter narrows results to Mountain bikes only (8 products)', async ({
    page
  }) => {
    const catalog = new ProductCatalogPage(page);
    await catalog.goto('/');

    // All categories start checked; uncheck Commuter to leave only Mountain.
    await catalog.toggleCategoryFilter('Commuter');

    await catalog.expectTotalItemCount(8);
  });

  test('Category filter narrows results to Commuter bikes only (8 products)', async ({
    page
  }) => {
    const catalog = new ProductCatalogPage(page);
    await catalog.goto('/');

    await catalog.toggleCategoryFilter('Mountain');

    await catalog.expectTotalItemCount(8);
  });

  test('Level filter narrows results to Beginner bikes only (8 products)', async ({
    page
  }) => {
    const catalog = new ProductCatalogPage(page);
    await catalog.goto('/');

    await catalog.toggleLevelFilter('Enthusiast');
    await catalog.toggleLevelFilter('Racer');

    await catalog.expectTotalItemCount(8);
  });

  test('Level filter narrows results to Enthusiast bikes only (4 products)', async ({
    page
  }) => {
    const catalog = new ProductCatalogPage(page);
    await catalog.goto('/');

    await catalog.toggleLevelFilter('Beginner');
    await catalog.toggleLevelFilter('Racer');

    await catalog.expectTotalItemCount(4);
  });

  test('Search narrows results by product name', async ({ page }) => {
    const catalog = new ProductCatalogPage(page);
    await catalog.goto('/');

    await catalog.searchByKeyword('FUSE');

    await catalog.expectTotalItemCount(4);
  });
});

test.describe('Create Case (guest)', () => {
  test('submitting with all fields filled succeeds and shows confirmation', async ({
    page
  }) => {
    // TODO: navigate to wherever the createCase component is actually
    // routed on the deployed site (the source config uses a `createCase`
    // route — confirm the URL path once the site is live).
    const createCase = new CreateCasePage(page);
    await page.goto('/create-case');

    await createCase.fillSubject('Brakes squeaking on FUSE X1');
    await createCase.fillDescription(
      'Front brakes squeak audibly after the first week of commuting.'
    );
    // TODO: Priority/Reason/Category/Product are comboboxes/lookups —
    // fill in the actual interaction once the live markup is confirmed.
    await createCase.submit();

    await createCase.expectSuccessToast();
  });

  test('submitting with required fields empty shows validation and does not succeed', async ({
    page
  }) => {
    const createCase = new CreateCasePage(page);
    await page.goto('/create-case');

    await createCase.submit();

    await createCase.expectValidationError();
    await createCase.expectNoSuccessToast();
  });
});

test.describe('Guest access boundaries', () => {
  test('guest sees a Login option and no authenticated-only content', async ({
    page
  }) => {
    // TODO: this locator is a placeholder pending visual confirmation
    // against the live deployed site's header/nav — see plan doc note.
    const catalog = new ProductCatalogPage(page);
    await catalog.goto('/');

    await expect(page.getByRole('link', { name: 'Log In' })).toBeVisible();
  });
});
