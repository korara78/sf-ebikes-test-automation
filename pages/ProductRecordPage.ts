import { Page, Locator } from '@playwright/test';
import { readInternalOrigin } from './internalSession';

/**
 * Page object for a Product__c full record page
 * (`/lightning/r/Product__c/{id}/view`), reached from the "Products" nav
 * tab's list view. Confirmed against the live org: both the top-right
 * "Edit" button and every per-field pencil icon open the same full-record
 * modal titled "Edit {ProductName}" — there's no separate lightweight
 * per-field popover despite the pencil icons suggesting one.
 */
export class ProductRecordPage {
  readonly page: Page;
  readonly editButton: Locator;
  readonly saveButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.editButton = page.getByRole('button', { name: 'Edit', exact: true });
    this.saveButton = page.getByRole('button', { name: 'Save', exact: true });
  }

  async gotoRecentList() {
    const origin = readInternalOrigin();
    await this.page.goto(`${origin}/lightning/o/Product__c/list?filterName=__Recent`);
  }

  productRowByName(name: string): Locator {
    return this.page.getByRole('link', { name, exact: true });
  }

  async openProduct(name: string) {
    await this.productRowByName(name).click();
  }

  async edit() {
    await this.editButton.click();
  }

  fieldInput(label: string): Locator {
    return this.page.getByLabel(label, { exact: true });
  }

  async save() {
    await this.saveButton.click();
  }
}
