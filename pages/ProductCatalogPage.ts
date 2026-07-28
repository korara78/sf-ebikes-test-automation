import { Page, Locator, expect } from '@playwright/test';

/**
 * Page object for the guest-facing Product Explorer / catalog page
 * (productFilter + productTileList + paginator LWCs).
 *
 * Confirmed against the live org: the community is served under
 * `/ebikes/s/`, and the catalog lives at `/ebikes/s/product-explorer`
 * (the site root `/ebikes/s/` is the Home page's hero banners, not the
 * catalog). `baseURL` is set to `.../ebikes/s/`, so `goto()` must use a
 * path with no leading slash — a leading `/` resolves against the origin
 * and skips the `/ebikes/s/` prefix entirely.
 */
export class ProductCatalogPage {
  readonly page: Page;

  /** Search input inside productFilter (label="Search Key"). */
  readonly searchInput: Locator;

  /**
   * "Previous" / "Next" buttons rendered by the paginator component.
   * Confirmed against the live org: these are icon-only buttons with no
   * accessible name (getByRole with a name never matches), so they're
   * targeted by position — they're the only buttons rendered as siblings
   * of `.nav-info` inside the paginator container. On page 1 only the
   * Next button renders, so previousButton/nextButton both resolve to it
   * there; that's fine since goToPreviousPage() is never called from
   * page 1 in current tests.
   */
  readonly previousButton: Locator;
  readonly nextButton: Locator;

  /**
   * The paginator's item-count/page text, e.g. "16 items • page 1 of 2".
   * Confirmed against the live org — the "•" bullet separator matches.
   */
  readonly paginatorInfo: Locator;

  constructor(page: Page) {
    this.page = page;
    this.searchInput = page.getByLabel('Search Key');
    this.paginatorInfo = page.locator('.nav-info');
    const paginationControls = this.paginatorInfo.locator('..');
    this.previousButton = paginationControls.getByRole('button').first();
    this.nextButton = paginationControls.getByRole('button').last();
  }

  async goto(path = 'product-explorer') {
    await this.page.goto(path);
  }

  /**
   * Confirmed against the live org: tiles are matched by their
   * `c-product-tile` wrapper element and clicked directly (the wrapper's
   * inner `<a>` has no `href`, so it isn't reachable via a link role).
   */
  productTileByName(name: string): Locator {
    return this.page.locator('c-product-tile', { hasText: name });
  }

  async productTileCount(): Promise<number> {
    return this.page.locator('c-product-tile').count();
  }

  /**
   * Polls rather than asserting once: confirmed against the live org that
   * pagination/filtering updates the count text and the tile list via two
   * independent async paths, so the tile list can still be mid-refetch
   * for a few seconds after the paginator text or filter checkbox has
   * already settled.
   */
  async expectTileCount(count: number) {
    await expect
      .poll(() => this.productTileCount(), { timeout: 15000 })
      .toBe(count);
  }

  async openProduct(name: string) {
    await this.productTileByName(name).click();
  }

  /**
   * Confirmed against the live org: filtering/pagination round-trips
   * through Apex for a guest user can take longer than the default 5s
   * assertion timeout, so this uses a longer one.
   */
  async expectTotalItemCount(total: number) {
    await expect(this.paginatorInfo).toContainText(`${total} items`, {
      timeout: 15000
    });
  }

  async expectPage(current: number, totalPages: number) {
    await expect(this.paginatorInfo).toContainText(
      `page ${current} of ${totalPages}`,
      { timeout: 15000 }
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
   *
   * Confirmed against the live org: the native checkbox resolves correctly
   * via getByLabel, but SLDS renders a styled `span.slds-checkbox` on top
   * that intercepts pointer events. `force: true` still delivers the click
   * to that same covered coordinate rather than routing it through the
   * label, so the input's checked state never actually flips. Clicking
   * the visible label text instead triggers real browser label-click
   * forwarding, which both toggles the input and fires its change event.
   */
  async toggleCategoryFilter(label: 'Commuter' | 'Mountain') {
    await this.page.getByText(label, { exact: true }).click();
  }

  /**
   * Toggles a Level checkbox by its picklist label
   * ("Beginner" | "Enthusiast" | "Racer").
   */
  async toggleLevelFilter(label: 'Beginner' | 'Enthusiast' | 'Racer') {
    await this.page.getByText(label, { exact: true }).click();
  }

  /** Toggles a Material checkbox by its picklist label ("Aluminum" | "Carbon"). */
  async toggleMaterialFilter(label: 'Aluminum' | 'Carbon') {
    await this.page.getByText(label, { exact: true }).click();
  }
}
