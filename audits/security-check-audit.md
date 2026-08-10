# Security Check Audit

**Date:** August 4, 2026
**Suite size at time of audit:** see [Scale Check Audit](./scale-check-audit.md) for current test counts.

## Purpose

A periodic check against a standard list of security controls applicable to a Salesforce Experience Cloud application tested via Playwright — authorization boundaries, injection resistance, transport/header hardening, credential handling, and software supply chain integrity. Not every control applies at every project's scope; the point of this audit is to confirm which are already in place, which are worth implementing now, and which are explicitly out of scope with a stated reason. Each row was verified against the actual repository and live org rather than assumed.

This audit references the **OWASP API Security Top 10 (2023)** for authorization controls (already applied via the Penetration Suite, see [Guide 6](../guides/06-api-and-authorization-boundary-testing.md)), the **OWASP Top 10:2025** (the web application list — a separate document from the API list above) for broader web risk categories, and the **OWASP Secure Headers Project** / **OWASP Cheat Sheet Series** for header and XSS-specific guidance. Salesforce's own guest-user security documentation is referenced for platform-specific findings.

**Playwright itself has no official security-testing methodology.** This suite applies the external frameworks above *through* Playwright as the execution tool — the frameworks are the authority, not Playwright.

## Findings

| Control | Status (verified) | Risk if absent | Outcome |
|---|---|---|---|
| **OWASP API Top 10** — BOLA (API1), BOPLA (API3), Broken Function-Level Auth (API5) | ✅ Confirmed built | Unauthorized cross-record access, field-level tampering | No action needed — Penetration Suite (TC-020–022), see Guide 6 |
| **Security response headers** (CSP, X-Frame-Options, HSTS) | ⚠️ Identified, not yet implemented | Clickjacking, XSS blast-radius, SSL-stripping on first connection | To implement — new Penetration Suite tests |
| **XSS / stored input reflection** (Create Case free-text fields) | ⚠️ Identified, not yet implemented | Guest-submitted payload executing in an internal, privileged staff session later | To implement — new Penetration Suite test |
| **Cookie security flags** (`Secure`, `HttpOnly`, `SameSite`) | ⚠️ Identified, deprioritized | Session/cookie theft via XSS or MITM | Deferred — largely platform-default-determined, lower differentiation value |
| **Rate limiting / brute-force resistance** | N/A | — | Not applicable — no login form exists on the guest-tested surface |
| **Credential scope / least privilege** (JWT Connected App vs. broader refresh-token reuse) | ✅ Confirmed built | Overbroad, hard-to-revoke standing credential in CI | No action needed — see [Guide 4](../guides/04-authentication-test-session-strategy.md)'s JWT migration |
| **Certificate/credential expiry tracking** | ❌ Not tracked | Silent CI auth failure when the self-signed cert expires | To document — add expiry date + renewal note to Guide 4 |
| **Software supply chain** (`npm audit` + OSV.dev + GitHub Actions pinning) | ⚠️ Partially built | Vulnerable or malicious dependencies, hijacked mutable-tag Actions going undetected between manual checks | See [OSV Vulnerability Scanning](#osv-vulnerability-scanning) below. Maps to OWASP Top 10:2025 A03. |
| **Branch protection on `main`** | ✅ Confirmed enforced | "Green check required before merge" exists conceptually but may not be enforced | No action needed — verified live via GitHub API: PR required (0 approvals needed, solo project), `test` status check required, force-pushes and deletions blocked, `enforce_admins` on |
| **Guest profile permission minimality** (API Enabled, object CRUD) | ✅ Investigated, documented | Overbroad guest access to Salesforce APIs/objects | No action needed — see Guide 6's Create Case investigation |

## OSV Vulnerability Scanning

`npm audit` only checks against GitHub's own advisory database. [OSV.dev](https://osv.dev) (Google/OpenSSF) aggregates vulnerability data across multiple sources — including OSS-Fuzz-discovered issues `npm audit` doesn't cover — added here as a second, complementary source, not a replacement for the existing `npm audit` judgment call documented in [Guide 1](../guides/01-environment-setup.md).

**Implementation:** [`google/osv-scanner-action`](https://github.com/google/osv-scanner-action), Google's officially supported reusable workflow, rather than hand-rolled API calls — less to maintain, purpose-built for CI. See `.github/workflows/osv-scan.yml`.

**Trigger: `workflow_dispatch` (manual) + weekly `schedule` only** — deliberately decoupled from `push`/`pull_request`. Dependency vulnerability disclosure is time-based, not code-change-based: a dependency that's clean today can have a CVE disclosed against it next week with zero commits on this repo's side. Tying the scan to code changes would miss that entirely. Keeping it a separate workflow file (not folded into `playwright.yml`) also preserves the test suite's pass/fail as a clean, unambiguous signal.

**Schedule:** `0 6 * * 1` (Monday 06:00 UTC) — this is **Sunday 11:00 PM Arizona time** (UTC-7, no DST), landing results before Monday morning.

**Policy: `fail-on-vuln: false`.** A known, already-triaged PostCSS advisory (documented in Guide 1 — dev-tooling-only, no untrusted-input path, deliberately not auto-fixed to preserve compatibility with vendor-tested tooling) is expected to surface here too. A hard fail-on-any-finding policy would put this workflow in a permanent red state for something already assessed as low-risk, which is noise, not signal.

**Real alerting mechanism: GitHub Security → Code Scanning, not job status.** Results upload via SARIF (default behavior) to a persistent, browsable alert list that distinguishes new findings from previously-seen ones. Notifications are enabled for new Code Scanning alerts specifically, so a genuinely new vulnerability produces a real notification — the pre-existing PostCSS advisory doesn't re-trigger one on every routine run.

**Category: Software Composition Analysis (SCA).** OSV-Scanner belongs to a specific, named class of tooling — SCA, which checks third-party/open-source dependencies for known vulnerabilities. Distinct from SAST (analyzing an application's own source) and DAST (testing a running application). Worth naming explicitly: SCA is a standard line item in regulated-industry security programs, not a generic "best practice."

**Why the same control carries more weight outside this project's scope.** This application has no production data at stake — practical exposure here is limited to CI-environment secrets (see Findings above). The identical control means materially more once real regulated data is involved:
- **Healthcare (PHI):** the HIPAA Security Rule requires documented risk analysis covering an application's full technology stack, including third-party and open-source components. A breach traced to a known, unpatched CVE in a dependency is a materially harder finding to defend than one from a genuinely unknown vulnerability.
- **Finance (payment/account data):** PCI-DSS 4.0 Requirement 6.3.2 requires an inventory of custom and third-party software components paired with a vulnerability-management process — functionally what SCA scanning plus the documented response policy above provides. (Illustrative only — see "Explicitly out of scope" below; this application has no payment-processing surface, so PCI-DSS itself doesn't apply here.)

Both examples describe the same shift: SCA moves from good hygiene to a named compliance control once an application handles PHI or payment/financial data.

## Framework Applicability

**Directly applied:**
- **OWASP API Security Top 10 (2023)** — categories API1, API3, API5, via the Penetration Suite.
- **OWASP Top 10:2025** (web application list, a separate document from the API list) — roughly half the categories are meaningfully testable via browser automation (Broken Access Control, Security Misconfiguration, Software Supply Chain Failures, Injection); the remainder (Cryptographic Failures, Insecure Design, Authentication Failures as an architecture concern, Security Logging and Alerting Failures) require infrastructure scanning, architecture review, or log-analysis tooling this suite doesn't provide.
- **OWASP Secure Headers Project** and **OWASP Cheat Sheet Series** — the source for the headers and XSS controls above.

**Cited narrowly as cross-references, not claimed as compliance:**
- **NIST SP 800-53** — a control catalog, not a whole-program certification. Individual control IDs are referenced alongside relevant rows above where genuinely applicable (e.g., AC-3 for the authorization tests, IA-5 for the JWT credential work), not claimed as a standalone category.

**Explicitly out of scope, with reason:**
- **PCI-DSS** — not applicable; the application has no payment-processing surface.
- **SOC 2 Type II** — not applicable; it's a third-party CPA-audited attestation of controls operating effectively over time, not a technical standard a test suite can satisfy directly.
- **ISO/IEC 27001** — not applicable; a whole-organization Information Security Management System standard, most of which (HR security, physical security, vendor governance) is outside a single application's test suite entirely.

## Deferred, not neglected

Cookie security flags, security response headers, and the XSS reflection test are all real, identified gaps — deferred here only in the sense that this audit is the planning document; see the linked PRs (once shipped) for implementation. Certificate expiry tracking is an open action item independent of the OSV work above and worth tracking to closure separately, so it doesn't get lost once OSV implementation becomes the visible focus.
