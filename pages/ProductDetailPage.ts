import { Page, Locator, expect } from '@playwright/test';

/**
 * Page object for the guest-facing product detail view.
 *
 * Confirmed against the live org: there is no separate detail page/URL.
 * Product Explorer is a master-detail split layout — clicking a tile
 * updates a third <article> panel in place on the same page (it starts
 * showing a "Select a product to see details" placeholder). Scope all
 * locators to that panel rather than the whole page, since the Filters
 * panel's own heading would otherwise be matched first.
 */
export class ProductDetailPage {
  readonly page: Page;

  /** The detail panel — third <article> on the Product Explorer page. */
  readonly panel: Locator;

  /** Product name heading, rendered as an <h2> inside the detail panel. */
  readonly heading: Locator;

  constructor(page: Page) {
    this.page = page;
    this.panel = page.locator('article').nth(2);
    this.heading = this.panel.getByRole('heading');
  }

  async expectName(name: string) {
    await expect(this.heading).toContainText(name);
  }

  /**
   * MSRP is rendered via lightning-formatted-number with
   * format-style="currency" and maximum-fraction-digits="0"
   * (confirmed as "$2,500" style, no decimals).
   */
  async expectMsrp(formattedPrice: string) {
    await expect(this.panel.getByText(formattedPrice)).toBeVisible();
  }
}
