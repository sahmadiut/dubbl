# AUD-002 attempt 4: HTTP capture and owner scope closure

## Identity and owner decisions

2026-10-02, Asia/Tehran. Operator: coding-assistant. Entry HEAD `4d120b98cef8b0e969b10a6775d341eed9c07997`; these changes were uncommitted during verification. This attempt supplements, rather than rewrites, attempts 1–3.

The actual owner replied that they had run the dev server. The assistant did not start/restart it. A Node fetch of `http://localhost:3000/api/health` then returned HTTP 200, body `{"status":"ok"}`, observed 1668.5394 ms. This verifies availability, not a clean installation or DB readiness by itself.

The actual owner subsequently said screenshots are unnecessary for continuation, instructed removing their requirements from `.agentic`, and requested committing to prepare for the next task. DEC-005 records this scope decision. Screenshots, screenshot tests and screenshot goldens are omitted; other behavioral, accounting, layout/accessibility and human review requirements remain. No human accounting review is inferred.

## Actual HTTP capture

Added `../scripts/capture_http_baseline.mjs`. It restricts the DB target to local `dubbl`, checks the corrected fixture's org slug and owner membership, creates a one-hour temporary API credential, performs read-only localhost HTTP requests and revokes the key. No financial records are changed by this script. Corrected fixture org: `27c074b2-7c89-4d43-9b97-cfeb7d6cb406`.

Command from repository root: `node --env-file=.env --import tsx .agentic/scripts/capture_http_baseline.mjs`. Exit 0. Raw sanitized responses and every individual timing: `AUD-002-http-7602aabf-02dc-4e83-96f7-7e71a3dd004e.json`.

All 30 authenticated requests returned 200 and each response matched the direct-handler closed-fixture baseline. Times include HTTP response body reading. First means first in this capture, not guaranteed cold start; the user may already have warmed routes. Warm median is the middle of five subsequent samples. This tiny development fixture does not establish production performance budgets, browser rendering or large-report scalability.

| Endpoint | First request ms | Five-warm-request median ms |
|---|---:|---:|
| trial-balance, asAt=2025-12-31 | 2923.564 | 18.360 |
| aged-receivables, asAt=2025-12-31 | 135.079 | 16.428 |
| aged-payables, asAt=2025-12-31 | 108.265 | 15.622 |
| balance-sheet, asAt=2025-12-31 | 337.804 | 15.883 |
| bank-accounts | 137.142 | 14.040 |

## Commands and environment

- `node --version`: v23.11.0, exit 0; differs from CI's Node 22.
- `pnpm --version`: 10.30.3, exit 0, matches declared package manager.
- `python --version`: 3.13.9, exit 0.
- `npx eslint --no-ignore .agentic/scripts/capture_baseline.mjs`: exit 0.
- `npx eslint --no-ignore .agentic/scripts/capture_baseline.mjs .agentic/scripts/capture_http_baseline.mjs`: exit 0.
- Existing installed lockfile graph/dependencies used; no frozen clean install performed. Baseline lint/typecheck/44 unit tests from attempt 1 remain historical, not claimed rerun here. No application TypeScript or schema changed.
- Browser tool inventory was empty; Windows helper's app inventory failed twice with native pipe unavailable. Screenshot work stopped following the owner's DEC-005 decision. No UI capture or browser check claimed passed.
- No full builds, Docker execution, migrations, provider calls, production operations or deployment. No secrets persisted. Temporary API credentials revoked in every fixture/HTTP run.

## Acceptance mapping and limitations

1. Met for current baseline scope: exact commands/environment/observed results retained, owner-started app HTTP availability verified. Clean install, CI-runtime reproduction and production qualification remain limitations. Docker omitted under DEC-002; screenshot gates removed under DEC-005.
2. Met as a baseline capture: trial balance, AR/AP, bank GL/API and retained earnings before/after close retained in attempt 3. 22/24 comparisons passed; two failed comparisons explicitly remain open. Capturing discrepancies satisfies the audit capture criterion, not financial release qualification.
3. Met: integrations remain individually unverified as documented in attempts 1–3; none claimed passed.

No changes to product behavior, REST contracts, MCP tools or database schema. Existing financial discrepancies remain in docs/RISKS.md and accounting/banking QA scope. The corrected fixture's bank API balance differs from GL; trial-balance debit/credit columns misclassify credit-normal balances. No change was made to hide those failures. Historical partial fixtures remain identifiable and must not be used as the correct baseline.

## Handoff

AUD-002 is ready for honest self-review and closure under current owner scope. Next controller task is AUD-005 after closure; it requires actual owner scope/parity review. Do not begin another task in this continuation. Do not restart the user's dev server. A future generic continue does not grant new dev-start or deployment authorization.
