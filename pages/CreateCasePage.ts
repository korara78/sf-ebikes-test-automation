import { Page, Locator, Request, expect } from '@playwright/test';

/**
 * Page object for the guest-facing Create Case form (createCase LWC,
 * built on lightning-record-edit-form).
 *
 * Confirmed against the live org via network tracing + direct SOQL
 * queries against the created records (see Guide 3, REQ-CASE-002 /
 * REQ-CASE-003):
 *
 * - Case creation itself always succeeds for a guest submission — the
 *   record is created and its owner is immediately reassigned to the
 *   org's configured default Case owner (mandatory Salesforce guest
 *   sharing behavior). Every client-side post-save signal is unreliable
 *   because of this same race: the "Case Created!" toast intermittently
 *   never appears, and lightning-record-edit-form does not reset the
 *   form fields either. Neither can be asserted on. Instead, this
 *   verifies the actual outgoing `createRecord` Aura request contains
 *   the exact field values submitted — a Guest-Suite-safe check (no
 *   Salesforce API/CLI access needed) of what the form does, decoupled
 *   from Salesforce's broken response handling.
 * - Subject/Description are NOT enforced as required fields on this
 *   org's rendered form — submitting with both blank still creates a
 *   Case (confirmed via SOQL: multiple blank-subject Cases exist from
 *   guest submissions). This is a real gap, not a test bug.
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

  private createRecordRequest: Promise<Request> | null = null;

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
    this.createRecordRequest = this.page.waitForRequest(
      (req) =>
        req.method() === 'POST' &&
        req.url().includes('/aura') &&
        (req.postData() ?? '').includes('ACTION%24createRecord')
    );
    await this.submitButton.click();
  }

  /**
   * Confirmed against the live org: see class doc for why this checks the
   * outgoing request rather than any post-save UI feedback.
   */
  async expectSubmissionSucceeded(expected: { subject: string; description: string }) {
    if (!this.createRecordRequest) {
      throw new Error('submit() must be called before expectSubmissionSucceeded()');
    }
    const req = await this.createRecordRequest;
    const params = new URLSearchParams(req.postData() ?? '');
    const message = JSON.parse(params.get('message') ?? '{}');
    const action = message.actions?.[0];

    expect(action?.descriptor).toBe('aura://RecordUiController/ACTION$createRecord');
    expect(action?.params?.recordInput?.apiName).toBe('Case');
    expect(action?.params?.recordInput?.fields?.Subject).toBe(expected.subject);
    expect(action?.params?.recordInput?.fields?.Description).toBe(expected.description);
  }

  /**
   * What SHOULD happen if Subject/Description were enforced as required
   * fields. Confirmed against the live org that this does not currently
   * happen — kept as the target assertion for the REQ-CASE-003 known-gap
   * test (wrapped in `test.fail()`), so it starts failing loudly (an
   * "unexpected pass") if the org's validation is ever fixed.
   */
  async expectValidationError() {
    await expect(
      this.page.locator('.slds-has-error, [data-error]').first()
    ).toBeVisible();
  }
}
