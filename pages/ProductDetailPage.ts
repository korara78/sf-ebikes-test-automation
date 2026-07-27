import { Page, Locator, expect } from '@playwright/test';

/**
 * Page object for the guest-facing Product Detail page.
 *
 * Note: this view uses the generic `forceCommunity:recordHeadline` +
 * `recordHomeTabs` components (standard Details/Related tabs) — NOT the
 * custom heroDetails/similarProducts/orderBuilder components, which only
 * appear on the internal Product_Record_Page. Don't assert on those here.
 */
export class ProductDetailPage {
  readonly page: Page;

  /** Record headline heading, rendered by forceCommunity:recordHeadline. */
  readonly heading: Locator;

  constructor(page: Page) {
    this.page = page;
    // TODO: confirm the exact heading role/level against the live org —
    // forceCommunity:recordHeadline typically renders the record name as
    // a heading, but the level (h1/h2) isn't visible from source alone.
    this.heading = page.getByRole('heading').first();
  }

  async expectName(name: string) {
    await expect(this.heading).toContainText(name);
  }

  /**
   * MSRP is rendered via lightning-formatted-number with
   * format-style="currency" and maximum-fraction-digits="0" on the
   * catalog tile. TODO: confirm the exact rendered format on the detail
   * page's standard Details tab (likely "$2,500" style, no decimals).
   */
  async expectMsrp(formattedPrice: string) {
    await expect(this.page.getByText(formattedPrice)).toBeVisible();
  }

  async goBackToCatalog() {
    await this.page.goBack();
  }
}
