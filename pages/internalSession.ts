import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Paths written by `tests/auth.setup.ts` and read by Internal Suite page
 * objects. Kept out of `auth.setup.ts` itself: Playwright forbids one test
 * file (which `auth.setup.ts` is, per `testMatch: /auth\.setup\.ts/`) from
 * being imported by another test file, and `internal-app.spec.ts` needs
 * these transitively through its page objects.
 */
export const authFile = path.join(__dirname, '../playwright/.auth/user.json');

export const originFile = path.join(
  __dirname,
  '../playwright/.auth/lightning-origin.json'
);

export function readInternalOrigin(): string {
  return (JSON.parse(readFileSync(originFile, 'utf-8')) as { origin: string })
    .origin;
}
