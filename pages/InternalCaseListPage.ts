import { Page, Locator, expect } from '@playwright/test';
import { readInternalOrigin } from './internalSession';

/**
 * Page object for the internal Case list view — the standard Case object's
 * list view, reached via App Launcher's "Cases" item, not the E-Bikes app's
 * own custom nav bar (which has no Cases tab at all).
 *
 * Confirmed against the live org:
 * - `AllOpenCases` is the only list-view filter that reliably includes a
 *   freshly-submitted guest Case by ownership/status — Salesforce
 *   immediately reassigns a guest-created Case's owner to an internal
 *   user, so it isn't excluded as unowned. `AllCases` doesn't exist on
 *   this org; `Recent`/view-history filters are non-deterministic for a
 *   fresh test run since they depend on someone having viewed the record.
 * - Case Number is the only reliably-unique locator. Matching by Subject
 *   text fails: many near-duplicate Cases exist from prior guest-suite
 *   runs sharing the same subject prefix.
 * - The list has 50+ items with lazy-loaded rows, so a freshly-created
 *   Case isn't necessarily in the initially-rendered rows. The list's own
 *   "Search this list..." box does NOT work here — confirmed against the
 *   live org that a just-created Case returns 0 results for several
 *   seconds (server-side search-index lag). Sorting by Case Number
 *   descending is deterministic instead, since Case Numbers are
 *   sequential: the newest Case is always row 1, no scrolling or search
 *   needed. The sort direction persists per-user across sessions (it's a
 *   saved list-view preference, not session-local), so this checks
 *   `aria-sort` and only clicks if it isn't already descending.
 */
export class InternalCaseListPage {
  readonly page: Page;
  readonly caseNumberHeader: Locator;

  constructor(page: Page) {
    this.page = page;
    this.caseNumberHeader = page
      .locator('th')
      .filter({ has: page.getByTitle('Case Number', { exact: true }) });
  }

  async goto() {
    const origin = readInternalOrigin();
    await this.page.goto(`${origin}/lightning/o/Case/list?filterName=AllOpenCases`);
  }

  caseRowByNumber(caseNumber: string): Locator {
    return this.page.getByRole('link', { name: caseNumber, exact: true });
  }

  async sortByCaseNumberDescending() {
    const current = await this.caseNumberHeader.getAttribute('aria-sort');
    if (current !== 'descending') {
      await this.page.getByTitle('Case Number', { exact: true }).click();
      await expect(this.caseNumberHeader).toHaveAttribute('aria-sort', 'descending', {
        timeout: 10000
      });
    }
  }

  async expectCaseVisible(caseNumber: string) {
    await this.sortByCaseNumberDescending();
    await expect(this.caseRowByNumber(caseNumber)).toBeVisible({ timeout: 15000 });
  }
}
