import { Page, Locator, expect } from '@playwright/test';
import { readInternalOrigin } from './internalSession';

/**
 * Page object for the internal "Product Explorer" custom tab
 * (`/lightning/n/Product_Explorer`) — distinct from the guest catalog
 * (`pages/ProductCatalogPage.ts`): different origin/URL entirely, even
 * though both are built on the same `c-product-tile`/`c-product-tile-list`
 * LWCs. Confirmed against the live org: selecting a tile here populates a
 * `c-product-card` detail panel (not `c-product-card`'s guest counterpart,
 * which is a plain master-detail `<article>` panel) headed by the product
 * name with grouped field sections (e.g. "ELECTRIC COMPONENTS", "FRAME").
 */
export class ProductExplorerPage {
  readonly page: Page;
  readonly detailPanel: Locator;

  constructor(page: Page) {
    this.page = page;
    this.detailPanel = page.locator('c-product-card');
  }

  async goto() {
    const origin = readInternalOrigin();
    await this.page.goto(`${origin}/lightning/n/Product_Explorer`);
  }

  productTileByName(name: string): Locator {
    return this.page.locator('c-product-tile', { hasText: name });
  }

  async openProduct(name: string) {
    await this.productTileByName(name).click();
  }

  async expectDetailVisible(name: string) {
    await expect(this.detailPanel).toContainText(name, { timeout: 15000 });
  }
}
