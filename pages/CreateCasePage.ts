import { Page, Locator, expect } from '@playwright/test';

/**
 * Page object for the guest-facing Create Case form (createCase LWC,
 * built on lightning-record-edit-form).
 *
 * Field labels below are the standard/custom Case field labels as defined
 * in createCase.js (Product__c, Priority, Case_Category__c, Reason,
 * Subject, Description). TODO: confirm exact rendered label text against
 * the live org — custom field labels (Case_Category__c in particular) can
 * be edited per-org and may not match the API name's obvious guess.
 */
export class CreateCasePage {
  readonly page: Page;

  readonly subjectInput: Locator;
  readonly descriptionInput: Locator;
  readonly priorityCombobox: Locator;
  readonly reasonCombobox: Locator;
  /** TODO: confirm rendered label — best guess is "Case Category". */
  readonly categoryCombobox: Locator;
  /**
   * Product is a lookup field (relationship to Product__c). TODO: confirm
   * whether lightning-input-field renders this as a record-picker
   * combobox with typeahead — if so, fillProduct() below will need to
   * type a search term and select a suggestion rather than a plain fill.
   */
  readonly productLookup: Locator;

  readonly submitButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.subjectInput = page.getByLabel('Subject');
    this.descriptionInput = page.getByLabel('Description');
    this.priorityCombobox = page.getByLabel('Priority');
    this.reasonCombobox = page.getByLabel('Reason');
    this.categoryCombobox = page.getByLabel('Case Category');
    this.productLookup = page.getByLabel('Product');
    this.submitButton = page.getByRole('button', { name: 'Submit' });
  }

  async fillSubject(value: string) {
    await this.subjectInput.fill(value);
  }

  async fillDescription(value: string) {
    await this.descriptionInput.fill(value);
  }

  async submit() {
    await this.submitButton.click();
  }

  /** Success toast text is hardcoded in createCase.js — assert on it exactly. */
  async expectSuccessToast() {
    await expect(this.page.getByText('Case Created!')).toBeVisible();
    await expect(
      this.page.getByText('You have successfully created a Case')
    ).toBeVisible();
  }

  /**
   * lightning-record-edit-form renders its own inline error UI on failed
   * validation. TODO: once the live org's required fields are confirmed,
   * consider tightening this to assert on a specific field's error rather
   * than "any error is visible."
   */
  async expectValidationError() {
    await expect(
      this.page.locator('.slds-has-error, [data-error]').first()
    ).toBeVisible();
  }

  async expectNoSuccessToast() {
    await expect(this.page.getByText('Case Created!')).not.toBeVisible();
  }
}
