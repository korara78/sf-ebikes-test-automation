---

## Appendix C: AI-Assisted Development Workflow

This project uses two different AI surfaces at different stages of the loop, plus Git/GitHub as the source of truth in between. Worth documenting explicitly, since it's as much a part of this portfolio's process as the tests themselves.

![AI-assisted development workflow](../guides-assets/dev-workflow-loop.svg)

### The loop

| Step | Actor | What happens |
|---|---|---|
| 1 | **Claude Cowork** | Plans test coverage and generates draft code (page objects, spec files, guides) against the actual E-Bikes source — not just the rendered UI. |
| 2 | **You + VS Code** | Copy the generated files into the local WSL clone of this repo. This is a manual step — Cowork has no direct write access to the local filesystem. |
| 3 | **Claude Code (CLI)** | Run `claude` from the repo root, then `/code-review`, for a sanity check with full local repo context before committing. |
| 4 | **You + Git** | Fix anything flagged, then `git add` / `commit` / `push` from the WSL terminal. |
| 5 | **GitHub** | Verify the push landed as expected on `origin/main`. |
| 6 | **Claude Cowork** | Plan the next round (e.g. Tier 2 tests, once `auth.setup.ts` exists) — loop repeats. |

### Two copies of one repo

The local WSL clone and the GitHub repo are two independent copies of the same history, kept in sync in one direction only: `git push` from local to GitHub. There's no automatic sync — if a change were ever made directly on GitHub (e.g. editing a file in the browser), it would need an explicit `git pull` locally to catch up, which this workflow doesn't currently do.

### How Cowork sees GitHub

Since this repo is public, Cowork reads it via a plain, unauthenticated fetch of the raw file contents — the same way anyone's browser could. That's the "Public fetch (read-only)" path in the diagram, and it's what's actually active today.

The GitHub Connector (the "Claude" GitHub App shown under Authorized OAuth Apps) is a separate, more capable path — it would allow Cowork to read via GitHub's API directly, work with private repos, and interact with PRs — but it was never granted repository access, only authorized at the account level. Right now, public fetch does the job for this project, so this hasn't been revisited.

---
