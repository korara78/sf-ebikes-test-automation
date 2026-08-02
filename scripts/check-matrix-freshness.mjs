#!/usr/bin/env node
// Fails if guides/03-requirements-traceability.md, as committed, doesn't
// match what `npm run gen:matrix` would produce from the current code and
// test results. Run gen:matrix immediately before this script — it compares
// gen:matrix's fresh output (already written to disk) against the version
// last committed to git.
//
// Timestamps (`_Last run: ..._` per row, `matrix auto-generated ...` in the
// summary) are normalized out before comparing: those always differ between
// a local run and a CI run even with zero substantive change, so diffing
// them raw would fail every single PR. Everything else — confirmed/total
// counts, status badges, notes text — is compared as-is, since a real drift
// there is exactly what this check exists to catch.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const DOC_PATH = 'guides/03-requirements-traceability.md';

function normalize(content) {
  return content
    .replace(
      /matrix auto-generated .*? from the latest test run/g,
      'matrix auto-generated [TIMESTAMP] from the latest test run'
    )
    .replace(/_Last run: .*?\._/g, '_Last run: [TIMESTAMP]._');
}

const committed = execFileSync('git', ['show', `HEAD:${DOC_PATH}`], { encoding: 'utf-8' });
const current = readFileSync(DOC_PATH, 'utf-8');

const normalizedCommitted = normalize(committed);
const normalizedCurrent = normalize(current);

if (normalizedCommitted !== normalizedCurrent) {
  console.error(`❌ ${DOC_PATH} is out of date.`);
  console.error(
    '   The committed file does not match what `npm run gen:matrix` produces from the current code/tests (ignoring timestamps).'
  );
  console.error('   Run `npm run gen:matrix` locally and commit the result.');
  process.exit(1);
}

console.log(`✅ ${DOC_PATH} is up to date (ignoring timestamps).`);
