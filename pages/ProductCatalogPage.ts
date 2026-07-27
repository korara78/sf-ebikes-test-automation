import { Page, Locator, expect } from '@playwright/test';

/**
 * Page object for the guest-facing Product Explorer / catalog page
 * (productFilter + productTileList + paginator LWCs).
 *
 * TODO (verify against live org): confirm the exact path of the catalog
 * page under your Experience Cloud site (e.g. `/E_Bikes/s/` or similar) and
 * set it as `baseURL` in playwright.config.ts, or pass the full URL to goto().
 */
export class ProductCatalogPage {
  readonly page: Page;

  /** Search input inside productFilter (label="Search Key"). */
  readonly searchInput: Locator;

  /** "Previous" / "Next" buttons rendered by the paginator component. */
  readonly previousButton: Locator;
  readonly nextButton: Locator;

  /**
   * The paginator's item-count/page text, e.g. "16 items • page 1 of 2".
   * TODO: confirm the exact rendered separator character against the live
   * org (source uses a bullet "•" — some locales/renders may differ).
   */
  readonly paginatorInfo: Locator;

  constructor(page: Page) {
    this.page = page;
    this.searchInput = page.getByLabel('Search Key');
    this.previousButton = page.getByRole('button', { name: 'Previous' });
    this.nextButton = page.getByRole('button', { name: 'Next' });
    this.paginatorInfo = page.locator('.nav-info');
  }

  async goto(path = '/') {
    await this.page.goto(path);
  }

  /**
   * Product tiles render a name (`.title`) and MSRP inside an `<a>` wrapping
   * a click handler. TODO: confirm whether the rendered `<a>` has an `href`
   * (which would give it an implicit `link` role usable via
   * `page.getByRole('link', { name })`) or whether it's onclick-only, in
   * which case use this text-based locator instead.
   */
  productTileByName(name: string): Locator {
    return this.page.locator('a', { hasText: name });
  }

  async productTileCount(): Promise<number> {
    // TODO: confirm the actual tile wrapper selector against the live DOM.
    // productTile.html wraps each tile in a bare `<div draggable>`, so a
    // more specific data-testid or c-product-tile selector may be needed
    // if this proves too broad once real markup is inspected.
    return this.page.locator('c-product-tile').count();
  }

  async openProduct(name: string) {
    await this.productTileByName(name).click();
  }

  async expectTotalItemCount(total: number) {
    await expect(this.paginatorInfo).toContainText(`${total} items`);
  }

  async expectPage(current: number, totalPages: number) {
    await expect(this.paginatorInfo).toContainText(
      `page ${current} of ${totalPages}`
    );
  }

  async goToNextPage() {
    await this.nextButton.click();
  }

  async goToPreviousPage() {
    await this.previousButton.click();
  }

  async searchByKeyword(keyword: string) {
    await this.searchInput.fill(keyword);
    // productFilter listens on `onchange`, not keystroke-by-keystroke.
    await this.searchInput.blur();
  }

  /**
   * Toggles a Category checkbox by its picklist label ("Commuter" | "Mountain").
   * All filter checkboxes start checked; unchecking one removes that value
   * from the active filter.
   */
  async toggleCategoryFilter(label: 'Commuter' | 'Mountain') {
    await this.page.getByLabel(label).click();
  }

  /**
   * Toggles a Level checkbox by its picklist label
   * ("Beginner" | "Enthusiast" | "Racer").
   */
  async toggleLevelFilter(label: 'Beginner' | 'Enthusiast' | 'Racer') {
    await this.page.getByLabel(label).click();
  }

  /** Toggles a Material checkbox by its picklist label ("Aluminum" | "Carbon"). */
  async toggleMaterialFilter(label: 'Aluminum' | 'Carbon') {
    await this.page.getByLabel(label).click();
  }
}
