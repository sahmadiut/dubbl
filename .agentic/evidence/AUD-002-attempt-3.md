# AUD-002 attempt 3: synthetic workflow and report capture

## Identity

Date: 2026-10-02, Asia/Tehran. Operator: coding-assistant. Entry HEAD: `4d120b98cef8b0e969b10a6775d341eed9c07997`; working tree clean at entry. DEC-003 authorizes the local test database. No Next.js server, full build, Docker command, migration or external provider was started.

## Implementation and observed results

Added `../scripts/capture_baseline.mjs`. It guards DATABASE_URL to loopback and database `dubbl`, bootstraps only a synthetic owner/org/manual Pro plan and temporary API key via Drizzle, and invokes actual v1 route handlers with bearer authentication. Financial records are created through account/bank/contact/journal/invoice/bill/payment/fiscal-close routes. No email-send option is supplied, and no recurring schedules/provider records are created. Existing global maintenance jobs were not inspected or disabled; these artifacts record snapshots at capture time.

The script revokes its temporary API key and closes the pool after each run. Synthetic organizations remain in the authorized test database for inspection; no other organization's records were read or modified. No credentials are persisted in capture artifacts. Each re-run creates a new identifiable fixture rather than changing an existing organization. The organization schema has no timezone field; this capture cannot establish an organization-level UTC setting.

Three executions were retained honestly:

1. `AUD-002-capture-a388a20a-38f2-432b-acb3-349267fa38c8.json`: first harness called approve on a draft bill; route correctly returned 400. Partial fixture org `68dbd5e8-ebed-446f-be3e-9f78e91d0c11` retained, credential revoked. Harness corrected to receive.
2. `AUD-002-capture-a224d970-5af7-4215-b4d3-f1660cd67d5b.json`: harness used AP code 2000; posting helpers require 2100 and returned no bill/payment journal for that missing control account. Partial financial baseline org `bcf1d625-744e-43c3-af4d-35cb3b578269` retained, credential revoked. Do not use it as the correct baseline. Exit 0 on this historical harness revision means capture completed, not financial correctness; the final script exits 1 for failed comparisons.
3. **Corrected baseline:** `AUD-002-capture-bf956749-da47-48f0-bb10-2f8fe74e3fc6.json`, organization `27c074b2-7c89-4d43-9b97-cfeb7d6cb406`. 36 route invocations; 24 comparisons, 22 passed, 2 failed. Credential revoked. Exit 1 intentionally reflects the two discrepancies.

All monetary expectations below are USD integer cents; report JSON currently returns decimal strings for GL reports and integers for aged reports. Existing invoice/bill v1 `unitPrice` expects decimal major units, so the harness uses 200 and 80 to produce totals 20000 and 8000. Journal/payment requests use integer cents. No API contract was changed.

| Output | Before close | After close |
|---|---|---|
| Bank GL natural balance | 102000 | 102000 |
| Aged AR | 15000 | 15000 |
| Aged AP | 5000 | 5000 |
| AP GL natural balance | 5000 | 5000 |
| Retained earnings | 0 | 12000 |
| Current earnings in balance sheet | 12000 | absent after close |
| Revenue / expense natural balances | 20000 / 8000 | 0 / 0 |
| Assets / liabilities / equity incl earnings | 117000 / 5000 / 112000 | 117000 / 5000 / 112000 |

Duplicate fiscal close returned 400 and all five captured report/bank JSON outputs were unchanged. This is a meaningful idempotency-negative check of this fixture, not general authorization/period-lock qualification.

## Observed discrepancies

- **Trial-balance debit/credit columns:** AP natural balance `50.00` is returned with debitBalance `50.00`, creditBalance `0.00`. The route splits natural-signed balances by sign without considering account type. Liability/equity/revenue positive natural balances therefore appear as debits in this fixture. Natural balances match expectations; the displayed debit/credit totals cannot be treated as balanced. Source: `app/api/v1/reports/trial-balance/route.ts`, `splitDebitCredit`; `lib/reports/gl-query.ts` natural balance semantics. No repair made in this baseline task.
- **Bank balance semantics:** `/bank-accounts` reports balance 0, while account 1100 GL is 102000. The opening manual journal and `/payments` workflow do not update `bank_account.balance`; the latter also does not pass the selected bank ledger account code to its journal helper. This fixture used standard code 1100; it does not test a second bank. Determine whether the API field is intended as statement balance or book balance before changing it. Do not overwrite it with the expected ledger balance to make the check pass.

## Acceptance mapping

1. Partial: exact capture commands and actual outputs recorded; dev startup and runtime/browser measurements remain pending.
2. Captured: actual trial balance, AR/AP, bank and balance-sheet/retained-earnings outputs before and after closure are retained, including failed comparisons. This criterion records capture, not a claim that every financial check passed.
3. Existing unavailable-provider documentation retained; no provider verification added.

## Verification

Commands executed from `D:\Projects\dubbl`:

- `python .agentic/agent.py validate`, `status`, `context`: exited 0; no ready task, AUD-002 blocked at entry. Resumed AUD-002 for authorized work.
- Inline Node fetch to `http://localhost:3000/api/health`, 5-second timeout: printed existing app unavailable; no server started. This does not prove why the service was unavailable.
- Inline direct import of the trial-balance route with `node --env-file=.env --import tsx --input-type=module`: exited 0.
- `node --env-file=.env --import tsx .agentic/scripts/capture_baseline.mjs`: three outcomes above; final exit 1 with 2 failed comparisons. Handler timings are recorded only as diagnostics; they exclude HTTP, Next.js lifecycle and browser rendering and are not performance qualification.

Targeted lint and final tracker validation are recorded in the separate review evidence. No application/schema change requires a build, migration or new MCP feature/tool. Route handlers were exercised directly, including auth/role checks for the synthetic owner; middleware, transport and cross-organization negative cases remain untested.

## Handoff

Dev-server request is still required by root AGENTS.md. Finish startup reproduction, authenticate only as the corrected synthetic fixture owner, capture English screenshots and first/warm HTTP timings. No fixture password was created or persisted; use a scoped test login setup when browser capture proceeds. Investigate/report the two baseline discrepancies explicitly; do not silently replace expected outputs or mark financial checks passed. AUD-005 remains dependent on AUD-002. Docker remains omitted under DEC-002.
