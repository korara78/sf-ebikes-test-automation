import { Locator, expect } from '@playwright/test';

/**
 * Waits for a locator's own bounding box to stop changing, as a real
 * layout-settle signal instead of a guessed fixed delay. For the class of
 * flake where Playwright's built-in actionability checks already pass on
 * the target element itself, but a surrounding container (e.g. a Lightning
 * modal still animating into place) hasn't finished moving yet. See Guide
 * 2's "Actionability: No Bare Waits" section for the failure mode this
 * replaces (`OrderBuilderPage.ts`'s former `page.waitForTimeout(500)`).
 */
export async function waitForStableLayout(locator: Locator, timeout = 5000) {
  await expect
    .poll(
      async () => {
        const first = await locator.boundingBox();
        await new Promise((resolve) => setTimeout(resolve, 100));
        const second = await locator.boundingBox();
        return JSON.stringify(first) === JSON.stringify(second);
      },
      { timeout }
    )
    .toBe(true);
}
