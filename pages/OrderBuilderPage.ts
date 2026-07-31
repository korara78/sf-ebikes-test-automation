import { Page, Locator, expect } from '@playwright/test';
import { readInternalOrigin } from './internalSession';

/**
 * Page object for creating a Reseller Order (Order__c) and adding line
 * items via the Order Builder LWC's drag-and-drop product basket.
 *
 * Confirmed against the live org:
 * - The Account lookup on "New Reseller Order" needs `pressSequentially`
 *   with a delay — a single `.fill()` doesn't reliably trigger the
 *   typeahead dropdown in time.
 * - Order Builder is real (not synthetic) HTML5 drag-and-drop, and
 *   `c-product-tile`/`c-order-item-tile` use genuine shadow DOM (open),
 *   not LWC's usual synthetic-shadow polyfill — `Element.textContent`
 *   and `.querySelector` don't see into it; shadow-root-aware traversal
 *   is required.
 * - Playwright's `locator.dragTo()` reliably drags the WRONG product
 *   regardless of which tile is targeted (reproduced repeatedly against
 *   this specific component). Manually dispatching
 *   dragstart/dragenter/dragover/drop/dragend with one shared
 *   `DataTransfer` object on the actual draggable node — a plain `<div>`
 *   inside `c-product-tile`'s shadow root, not the custom element host —
 *   works correctly every time.
 * - Dropping a tile creates an `Order_Item__c` immediately (no confirm
 *   step), with `Price__c` defaulted to `round(MSRP * 0.6)`.
 * - The "Small"/"Medium"/"Large" quantity fields have no `aria-label`
 *   attribute but are still reachable via `getByLabel` (Playwright
 *   resolves the LWC's internal label association). Changing one does
 *   NOT auto-save — a checkmark icon-button must be clicked to persist
 *   via `updateRecord`. That button also has no accessible name; it's
 *   targeted by its stable `save-button` CSS class instead.
 */
export class OrderBuilderPage {
  readonly page: Page;
  readonly dropZone: Locator;

  constructor(page: Page) {
    this.page = page;
    this.dropZone = page.locator('.drop-zone').first();
  }

  async gotoNew() {
    const origin = readInternalOrigin();
    await this.page.goto(`${origin}/lightning/o/Order__c/list?filterName=__Recent`);
    await this.page.getByRole('button', { name: 'New' }).click();
    // Confirmed against the live org: interacting with the modal before its
    // layout has fully settled can cause the account typeahead's dropdown
    // option to intercept-then-vanish (reproduced on Firefox) — give the
    // modal a beat to finish rendering first.
    await this.page.getByRole('combobox', { name: /Account/i }).waitFor({ state: 'visible' });
    await this.page.waitForTimeout(500);
  }

  async fillAccount(name: string) {
    const accountInput = this.page.getByRole('combobox', { name: /Account/i });
    await accountInput.click();
    await accountInput.pressSequentially(name, { delay: 80 });
    const option = this.page.getByRole('option', { name, exact: true });
    await option.waitFor({ state: 'visible' });
    await option.click();
  }

  /**
   * Confirmed against the live org: the post-save redirect isn't always
   * the typed record URL (`/lightning/r/Order__c/{id}/view`) — WebKit
   * lands on the short form (`/lightning/r/{id}/view`, no object name
   * segment). Both are valid Salesforce record URLs.
   */
  async save() {
    await this.page.getByRole('button', { name: 'Save', exact: true }).click();
    // Confirmed against the live org: `waitForURL` (with either the
    // default 'load' or 'commit') times out on WebKit even after its own
    // log shows the frame already navigated to a matching URL — this is
    // client-side routing (Lightning is an SPA), and WebKit's navigation
    // events for it don't line up with what `waitForURL` expects. Polling
    // `page.url()` directly sidesteps navigation-lifecycle tracking
    // entirely.
    await expect
      .poll(() => this.page.url(), { timeout: 15000 })
      .toMatch(/\/lightning\/r\/(Order__c\/)?[^/]+\/view/);
  }

  async createOrder(accountName: string) {
    await this.gotoNew();
    await this.fillAccount(accountName);
    await this.save();
  }

  /**
   * Confirmed against the live org: reloading this record page
   * (`page.reload()`) intermittently throws a real app-level LWC
   * `@wire` error (`force:ldsBindings` failing to evaluate
   * `this.objectInfo.data.defaultRecordTypeId`), leaving stale DOM
   * behind — reproduced repeatedly on WebKit. That's a bug in the
   * deployed component, not something a test should route around by
   * reloading; verifying persistence via SOQL instead sidesteps it.
   */
  currentOrderId(): string {
    const match = this.page.url().match(/\/lightning\/r\/(?:Order__c\/)?([^/]+)\/view/);
    if (!match) {
      throw new Error(`Not on an Order__c record page: ${this.page.url()}`);
    }
    return match[1];
  }

  orderItemTileByProduct(productName: string): Locator {
    return this.page.locator('c-order-item-tile', { hasText: productName });
  }

  /** See class doc for why this doesn't use Playwright's `dragTo()`. */
  async dragProductIntoOrder(productName: string) {
    await this.page.locator('c-product-tile').first().waitFor({ state: 'visible' });
    await this.dropZone.waitFor({ state: 'visible' });

    const result = await this.page.evaluate((name) => {
      function deepQueryAll(root: ParentNode, selector: string): Element[] {
        let results = Array.from(root.querySelectorAll(selector));
        for (const el of Array.from(root.querySelectorAll('*'))) {
          const shadow = (el as HTMLElement).shadowRoot;
          if (shadow) results = results.concat(deepQueryAll(shadow, selector));
        }
        return results;
      }
      const getText = (el: Element) => {
        const shadow = (el as HTMLElement).shadowRoot;
        return (shadow ? shadow.textContent : el.textContent) || '';
      };

      const tiles = deepQueryAll(document, 'c-product-tile');
      const dropZones = deepQueryAll(document, '.drop-zone');
      const source = tiles.find((t) => getText(t).toUpperCase().includes(name.toUpperCase()));
      if (!source || dropZones.length === 0) {
        return { ok: false as const, tileCount: tiles.length, dropZoneCount: dropZones.length };
      }
      const dropZone = dropZones[0];
      const shadow = (source as HTMLElement).shadowRoot;
      const draggableSource = shadow
        ? shadow.querySelector('[draggable="true"]') || shadow.firstElementChild || source
        : source;

      const dt = new DataTransfer();
      const dispatch = (target: Element, type: string) =>
        target.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt }));
      dispatch(draggableSource, 'dragstart');
      dispatch(dropZone, 'dragenter');
      dispatch(dropZone, 'dragover');
      dispatch(dropZone, 'drop');
      dispatch(draggableSource, 'dragend');

      return { ok: true as const };
    }, productName);

    if (!result.ok) {
      throw new Error(
        `Could not drag "${productName}" into the order builder drop zone: ${JSON.stringify(result)}`
      );
    }
  }

  /**
   * Confirmed against the live org: the checkmark only renders while the
   * tile is in a "modified" state and disappears once `updateRecord`
   * resolves — waiting for it to detach confirms the save actually
   * persisted server-side rather than just having been clicked. Without
   * this, an immediate `page.reload()` can race ahead of the save on
   * slower browsers (reproduced on WebKit).
   */
  async setQuantity(productName: string, size: 'Small' | 'Medium' | 'Large', value: string) {
    const tile = this.orderItemTileByProduct(productName);
    await tile.getByLabel(size).fill(value);
    const saveButton = tile.locator('lightning-button-icon.save-button');
    // Confirmed against the live org: clicking immediately after `fill()`
    // can save the PRE-change value on WebKit — the LWC's reactivity to
    // the input's change event isn't necessarily done processing yet.
    // Waiting for the checkmark to become visible (it only renders once
    // the tile registers as "modified") is a real signal that the change
    // has propagated, not just a fixed delay.
    await saveButton.waitFor({ state: 'visible' });
    await saveButton.click();
    await saveButton.waitFor({ state: 'hidden', timeout: 15000 });
  }

  /**
   * "Total Items" is the sum of Small+Medium+Large quantities across all
   * line items, not a count of distinct products — confirmed against the
   * live org: dropping one product (default qty 1/1/1) shows "Total
   * Items: 3", not 1.
   */
  async expectTotalItems(count: number) {
    await expect(this.page.getByText(`Total Items: ${count}`)).toBeVisible({ timeout: 15000 });
  }
}
