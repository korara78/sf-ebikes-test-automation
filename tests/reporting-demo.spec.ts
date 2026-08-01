import { test, expect } from '@playwright/test';
import { ProductCatalogPage } from '../pages/ProductCatalogPage';

/**
 * Not part of the Guest/Internal/API/Penetration Suites, not tagged with
 * a @TC-### id, and not mapped in guides/traceability-map.mjs — this test
 * asserts something deliberately, deterministically wrong purely to
 * exercise the failure-reporting pipeline (screenshot + video + trace)
 * against a real, unexpected failure. Run it with `npm run demo:failure`,
 * not `npx playwright test`.
 */
test('demo: catalog assertion deliberately fails to exercise the reporting pipeline', async ({
  page
}) => {
  const catalog = new ProductCatalogPage(page);
  await catalog.goto();

  const count = await catalog.productTileCount();
  expect(count, 'intentionally wrong assertion for reporting-pipeline demo purposes').toBe(999);
});
