import type { APIRequestContext } from '@playwright/test';
import { getApiSession, getLatestApiRoot } from './apiSession';

/**
 * Per-test Product__c creation, for tests that need to mutate a record
 * rather than just read one. Mirrors the exact REST pattern
 * tests/api.spec.ts's TC-016/TC-018 already use (getApiSession() +
 * getLatestApiRoot() + a bearer-token request), reusing Playwright's own
 * test-scoped `request` fixture rather than creating a separate context.
 *
 * Every name is prefixed `ZZZ-TEST-` unconditionally, even when a caller
 * doesn't need collision-proofing for its own logic. This isn't
 * decorative: it's the fallback for when deleteTestProduct() itself never
 * runs — confirmed against the live org (see Guide 2, the FUSE X1
 * concurrency incident) that a process killed from outside Playwright's
 * own control (a CI job timeout, a cancelled run) does not reliably run
 * cleanup. A `ZZZ-TEST-<timestamp>-<random>` orphan is trivially
 * identifiable and sweepable later by name alone; a randomly-timed
 * mutation of an existing catalog product is not.
 */

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 7);
}

export interface TestProduct {
  id: string;
  name: string;
}

export async function createTestProduct(
  request: APIRequestContext,
  fields: Record<string, unknown> = {}
): Promise<TestProduct> {
  const name = `ZZZ-TEST-${Date.now()}-${randomSuffix()}`;
  const session = getApiSession();
  const apiRoot = await getLatestApiRoot(request, session.instanceUrl);

  const res = await request.post(`${apiRoot}/sobjects/Product__c`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    data: { Name: name, ...fields }
  });
  if (!res.ok()) {
    throw new Error(
      `Failed to create test Product__c "${name}": ${res.status()} ${await res.text()}`
    );
  }
  const body = (await res.json()) as { id: string };
  return { id: body.id, name };
}

export async function deleteTestProduct(request: APIRequestContext, id: string): Promise<void> {
  const session = getApiSession();
  const apiRoot = await getLatestApiRoot(request, session.instanceUrl);
  await request.delete(`${apiRoot}/sobjects/Product__c/${id}`, {
    headers: { Authorization: `Bearer ${session.accessToken}` }
  });
}
