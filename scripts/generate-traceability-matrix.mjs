#!/usr/bin/env node
/**
 * Generates the Living Traceability Matrix tables in
 * guides/03-requirements-traceability.md from guides/traceability-map.mjs
 * (the hand-maintained REQ<->TC mapping + curated notes) plus the latest
 * Playwright JSON test run (test-results/results.json), which supplies
 * live status per @TC-### tag.
 *
 * Status is derived from Playwright's own per-spec `ok` / `expectedStatus`
 * fields rather than tracked by hand:
 *   - ok === true,  expectedStatus === 'passed' -> Confirmed
 *   - ok === true,  expectedStatus === 'failed' -> Known Gap (test.fail())
 *   - ok === false                              -> Regression (unexpected
 *     result in either direction, including a known-gap test that starts
 *     unexpectedly passing)
 *   - no matching spec in the report            -> Not Run
 *
 * Usage: npm run gen:matrix
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { guestSuite, internalSuite, apiSuite, authzSuite } from '../guides/traceability-map.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const resultsPath = path.join(rootDir, 'test-results', 'results.json');
const docPath = path.join(rootDir, 'guides', '03-requirements-traceability.md');
const testsDir = path.join(rootDir, 'tests');

// --- Load the latest test run, if any ---------------------------------

function loadResults() {
  try {
    return JSON.parse(readFileSync(resultsPath, 'utf-8'));
  } catch {
    return null;
  }
}

function flattenSpecs(suites, acc = []) {
  for (const suite of suites ?? []) {
    for (const spec of suite.specs ?? []) acc.push(spec);
    flattenSpecs(suite.suites, acc);
  }
  return acc;
}

function buildTagIndex(results) {
  // Playwright's JSON reporter emits one spec object per project, so the
  // same @TC-### tag appears on multiple specs (one per browser) — index
  // as tag -> spec[], not tag -> spec, or all but the last project silently
  // drop out of the aggregate.
  const index = new Map(); // tag -> spec[]
  if (!results) return index;
  for (const fileSuite of results.suites ?? []) {
    for (const spec of flattenSpecs([fileSuite])) {
      for (const tag of spec.tags ?? []) {
        if (!index.has(tag)) index.set(tag, []);
        index.get(tag).push(spec);
      }
    }
  }
  return index;
}

// --- Derive status for one requirement row -----------------------------

function deriveRowStatus(testIds, tagIndex) {
  if (testIds.length === 0) {
    return { badge: '🚧 Deferred', liveInfo: null };
  }

  // One or more specs per testId (one per browser project that ran it).
  const found = testIds.flatMap((id) => tagIndex.get(id) ?? []);
  const idsFound = new Set(testIds.filter((id) => tagIndex.has(id)));

  // A spec that was only *listed* (`--list`), or whose run was interrupted
  // before it started, reports `status: 'skipped'` with an empty
  // `results` array — but `ok`/`expectedStatus` on that same spec look
  // identical to a genuine pass, since neither field reflects whether the
  // test actually executed. Exclude specs with no real result so they
  // can't masquerade as Confirmed.
  const executed = found.filter((spec) =>
    spec.tests?.some((t) => (t.results ?? []).length > 0)
  );

  if (executed.length === 0) {
    return { badge: '⚪ Not Run', liveInfo: null };
  }

  const anyRegression = executed.some((spec) => spec.ok === false);
  const expectedFailure = executed.some(
    (spec) => spec.tests?.[0]?.expectedStatus === 'failed'
  );

  const badge = anyRegression
    ? '🔴 Regression'
    : expectedFailure
    ? '❌ Known Gap'
    : '✅ Confirmed';

  const projects = new Set();
  let latestStart = null;
  for (const spec of executed) {
    for (const t of spec.tests ?? []) {
      projects.add(t.projectName);
      for (const r of t.results ?? []) {
        const started = new Date(r.startTime);
        if (!latestStart || started > latestStart) latestStart = started;
      }
    }
  }

  const partial = idsFound.size < testIds.length ? ` — ${idsFound.size}/${testIds.length} test IDs found in report` : '';
  const dateStr = latestStart
    ? latestStart.toLocaleString('en-US', {
        month: 'numeric',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      })
    : 'unknown';

  return {
    badge,
    liveInfo: `_Last run: ${dateStr} — ${projects.size} browser${projects.size === 1 ? '' : 's'}${partial}._`
  };
}

// --- Render tables -------------------------------------------------------

function escapeCell(text) {
  return text.replace(/\n/g, ' ');
}

function renderTable(rows, tagIndex, { includeNotesColumn = true } = {}) {
  const header = includeNotesColumn
    ? '| ID | Test&nbsp;ID | Requirement | Status | Notes |\n|---|---|---|---|---|'
    : '| ID | Test&nbsp;ID | Requirement | Status |\n|---|---|---|---|';

  const lines = rows.map((row) => {
    const { badge, liveInfo } = deriveRowStatus(row.testIds, tagIndex);
    const testIdCell = row.testIds.length > 0 ? row.testIds.join(', ') : '—';
    const notesCell = liveInfo ? `${liveInfo}<br>${row.notes}` : row.notes;
    return `| ${row.reqId} | ${testIdCell} | ${escapeCell(row.requirement)} | ${badge} | ${escapeCell(notesCell)} |`;
  });

  return [header, ...lines].join('\n');
}

// --- Validate map <-> code consistency -----------------------------------

function findTaggedTestsInCode() {
  const found = new Set();
  for (const file of readdirSync(testsDir)) {
    if (!file.endsWith('.spec.ts')) continue;
    const content = readFileSync(path.join(testsDir, file), 'utf-8');
    for (const match of content.matchAll(/@TC-\d+/g)) found.add(match[0].slice(1));
  }
  return found;
}

function validate(allRows) {
  const inMap = new Set(allRows.flatMap((r) => r.testIds));
  const inCode = findTaggedTestsInCode();

  const orphanInCode = [...inCode].filter((id) => !inMap.has(id));
  const staleInMap = [...inMap].filter((id) => !inCode.has(id));

  return { orphanInCode, staleInMap };
}

// --- Main -----------------------------------------------------------------

function main() {
  const results = loadResults();
  const tagIndex = buildTagIndex(results);
  const allRows = [...guestSuite, ...internalSuite, ...apiSuite, ...authzSuite];

  const { orphanInCode, staleInMap } = validate(allRows);

  if (orphanInCode.length > 0) {
    console.warn(
      `⚠️  Tagged in code but not mapped to a requirement: ${orphanInCode.join(', ')}`
    );
  }
  if (staleInMap.length > 0) {
    console.warn(
      `⚠️  Mapped in guides/traceability-map.mjs but not found in test code: ${staleInMap.join(', ')}`
    );
  }
  if (!results) {
    console.warn(
      `⚠️  No test-results/results.json found — run tests first (npx playwright test) for live status. Rows will show "Not Run".`
    );
  }

  const driftSection =
    orphanInCode.length > 0 || staleInMap.length > 0
      ? [
          '> **⚠️ Drift detected between test code and the traceability map:**',
          ...(orphanInCode.length > 0
            ? [`> - Tagged in code, not mapped to a requirement: ${orphanInCode.map((t) => `\`${t}\``).join(', ')}`]
            : []),
          ...(staleInMap.length > 0
            ? [`> - Mapped in \`guides/traceability-map.mjs\`, not found in test code: ${staleInMap.map((t) => `\`${t}\``).join(', ')}`]
            : []),
          ''
        ].join('\n')
      : '';

  const confirmedCount = (suite) =>
    suite.filter((r) => deriveRowStatus(r.testIds, tagIndex).badge === '✅ Confirmed').length;
  const guestConfirmedCount = confirmedCount(guestSuite);
  const internalConfirmedCount = confirmedCount(internalSuite);
  const apiConfirmedCount = confirmedCount(apiSuite);
  const authzConfirmedCount = confirmedCount(authzSuite);
  const regressionCount = allRows.filter(
    (r) => deriveRowStatus(r.testIds, tagIndex).badge === '🔴 Regression'
  ).length;
  const generatedAt = new Date().toLocaleString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });

  const summary = `**Status:** ${guestConfirmedCount}/${guestSuite.length} Guest Suite + ${internalConfirmedCount}/${internalSuite.length} Internal Suite + ${apiConfirmedCount}/${apiSuite.length} API Suite + ${authzConfirmedCount}/${authzSuite.length} Penetration Suite requirements confirmed${
    regressionCount > 0 ? `, **${regressionCount} regression(s) detected**` : ''
  } — matrix auto-generated ${generatedAt} from the latest test run`;

  let doc = readFileSync(docPath, 'utf-8');
  doc = replaceBetween(doc, 'LTM:SUMMARY', summary);
  doc = replaceBetween(doc, 'LTM:DRIFT', driftSection);
  doc = replaceBetween(doc, 'LTM:GUEST', renderTable(guestSuite, tagIndex));
  doc = replaceBetween(
    doc,
    'LTM:INTERNAL',
    renderTable(internalSuite, tagIndex)
  );
  doc = replaceBetween(doc, 'LTM:API', renderTable(apiSuite, tagIndex));
  doc = replaceBetween(doc, 'LTM:AUTHZ', renderTable(authzSuite, tagIndex));

  writeFileSync(docPath, doc);
  console.log(`✅ Matrix regenerated: ${docPath}`);
}

function replaceBetween(doc, marker, replacement) {
  const start = `<!-- ${marker}:START -->`;
  const end = `<!-- ${marker}:END -->`;
  const pattern = new RegExp(`${start}[\\s\\S]*?${end}`);
  if (!pattern.test(doc)) {
    throw new Error(`Marker ${marker} not found in ${docPath}`);
  }
  return doc.replace(pattern, `${start}\n${replacement}\n${end}`);
}

main();
