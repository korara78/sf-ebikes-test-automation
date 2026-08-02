# Guide 5: Visual Reporting & Trace Debugging

**Project:** Salesforce LWC Test Automation Portfolio (E-Bikes)
**Status:** ✅ Built and verified against the live org — screenshots, video, and trace capture are wired into `playwright.config.ts` and confirmed working against the Guest Suite

---

## Overview

Beyond pass/fail in the terminal, Playwright can produce an HTML report, per-test screenshots, failure video, and a full step-by-step trace (DOM snapshots, network, console, actions). This guide documents what's configured, why, and how to use the artifacts when troubleshooting a failure — so the same setup can be reproduced on another machine without re-deriving it.

---

## Config Wiring

`playwright.config.ts`:

```ts
reporter: 'html',

use: {
  /* Collect trace when retrying the failed test. */
  trace: 'on-first-retry',

  /* Capture a screenshot after every test. */
  screenshot: 'on',

  /* Record video, keeping it only for failed tests. */
  video: 'retain-on-failure',
},
```

| Setting | Value | Why |
|---|---|---|
| `reporter` | `'html'` | Scaffold default; produces a browsable report with embedded screenshots/video/trace links. |
| `screenshot` | `'on'` | Always captured, pass or fail — useful for visually confirming a passing test actually rendered what's expected (e.g. filter results), not just that the assertion matched. |
| `video` | `'retain-on-failure'` | Recorded for every test but discarded unless the test fails, to avoid keeping video for the whole (passing) suite. |
| `trace` | `'on-first-retry'` | Only fires when a test retries. **Note:** local runs default to `retries: 0` (see `playwright.config.ts`), so this never triggers locally unless retries are explicitly enabled — it's effectively a CI-only setting today (CI has `retries: 2`). |

---

## Viewing Results

```bash
npx playwright show-report        # opens the last HTML report in a browser
```

The report links directly into failure screenshots, video, and (when present) the Trace Viewer — a GUI app for scrubbing through a test's timeline action-by-action, inspecting DOM snapshots and network calls at each step.

To open a specific trace file directly:

```bash
npx playwright show-trace test-results/<test-folder>/trace.zip
```

---

## Demoing the Failure Pipeline On Demand

The real suites are fully green (51/51 confirmed), which is good for the app but means there's no live failure sitting around to walk through when explaining this reporting setup. `tests/reporting-demo.spec.ts` exists purely to produce one on demand: a deliberately, deterministically wrong assertion against the Guest catalog's product count, run via its own isolated config:

```bash
npm run demo:failure
```

It's intentionally kept separate from everything above — no `@TC-###` tag, not mapped in `guides/traceability-map.mjs`, and not picked up by `playwright.config.ts` (every project there is scoped via `testMatch` to one specific real spec file, so this one matches none of them and never runs as part of `npx playwright test` or CI). It has its own `playwright.demo.config.ts` and writes to `test-results/demo/` / `playwright-report/demo/`, so a demo run never touches the real suite's tracked `test-results/results.json` or overwrites its HTML report.

One deliberate difference from the rest of this project: it's **not** wrapped in `test.fail()`. That convention (used for `REQ-CASE-003`) marks a failure as expected, and Playwright's video/trace retention logic treats an expected failure the same as a pass for retention purposes — no video gets kept. Since this test's entire purpose is showing off the artifact pipeline, it needs to be a genuine, unexpected failure instead, which is what actually triggers `retain-on-failure` video and `on-first-retry` trace capture.

---

## Troubleshooting a Failure: Read the Artifacts, Don't Just Trust the Error Text

The console/report error message (assertion diff, stack trace) is the first thing to check and is usually enough. But when it isn't — e.g. a selector matched the wrong element, or a filter didn't visually update the way the assertion expected — go straight to the actual artifacts rather than guessing from the error text alone:

1. **Check the failure screenshot first** (`test-results/<test-folder>/test-failed-1.png`) — fastest way to see the rendered page state at the moment of failure.
2. **Unzip and inspect `trace.zip` directly** — it's a plain zip, not a proprietary format, so its contents are readable without opening the GUI:

   ```bash
   unzip -o test-results/<test-folder>/trace.zip -d /tmp/trace-inspect
   ```

   Inside: per-action JSON logs (`trace.trace`, `trace.network`), DOM snapshot HTML per step, and PNG snapshots. This is the way to reconstruct *what the page actually looked like and did* at each step of a failing test without a display attached — relevant since this project runs in WSL2/CI, where launching the interactive Trace Viewer GUI often isn't practical.

This two-step habit (screenshot first, then unzip the trace if the screenshot alone doesn't explain it) is the standard troubleshooting path for this project going forward, not just a one-off for this run.

---

## Reproducing This Setup on Another Machine

Nothing here is machine-specific — it's entirely `playwright.config.ts` plus the standard install steps from [Guide 1](01-environment-setup.md):

```bash
npm install
npx playwright install --with-deps
```

The `use.screenshot` / `use.video` / `use.trace` settings above are already committed in `playwright.config.ts`, so a fresh clone gets the same reporting behavior with no extra setup.

---

## Next Guide

Writing `internal-app.spec.ts` against the Internal Suite requirements from Guide 2, using the authenticated session from [Guide 4](04-authentication-test-session-strategy.md).

Later: [Guide 6: API & Authorization Boundary Testing](06-api-and-authorization-boundary-testing.md) — a standalone API Suite and a Penetration Suite, added once the Guest/Internal Suites were both complete and CI-green.
