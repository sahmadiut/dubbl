# MON-152 attempt 1 - account ledger and shared presentation

## Identity and scope

2026-10-12, Asia/Tehran. Operator: coding-assistant. Entry master HEAD
011a21e8a7f778e99c353d3fbe3f2a14cf1b1c24, clean tree. Controller validate/status/
next selected MON-152; started with the controller. User authorized completing
and pushing this task, then explicitly authorized repairing the failing PostgreSQL
Migration Fixtures job in the same push without waiting for the next hosted run.
One task only; MON-133/MON-129/MON-007 retain independent acceptance.

## Implementation and acceptance mapping

1. Ownership/exact boundaries: CORE_UI_MONEY_CUTOVER has every requested consumer
   and REST/MCP pairing. core-presentation.ts requires agreeing canonical Minor
   aliases, validates saved journal groups against raw fixed-two REST aliases,
   uses bigint sums and sorts like-currency amount groups. Account layout/ledger
   removes parseFloat/toFixed and the incorrect multiply-by-100 of already-minor
   numeric API values. Signed natural balances and pagination remain. Account
   list/AccountPicker/settings have metadata/count/currency controls, no monetary
   inputs or totals; metadata PATCH preserves validated detail and refetches.
   Journal list/posted totals and recent dashboard rows render explicit currency
   groups. Manual edit previews/writes still use saved tag scales/Minor inputs.
   Detail uses amountCurrencyCode, validates before storing UI state and refreshes
   GET after post/void. Invalid responses suppress values with English alerts.
2. Meaningful behavior: pure cases verify safe-edge low digits, negative signs,
   0/2/3 scales, malformed/missing/conflicting/range aliases, grouped sums and
   large bigint loaded totals. Migrated REST/API-key, linked registered MCP and
   SQL fixture exercises actual manual preview/create/post, account totals and
   deterministic running pages, mixed manual currency groups/reversals, retained
   shared invoice automation (EUR source tag, one converted base amount), opening
   USD cents and tenant/auth/foreign/cyclic reversal rejection in USD/JPY/IRR/KWD.
   Reads leave source SQL amount/tag snapshots unchanged. Core/journal/opening
   regressions preserve supported transport/lifecycle behavior. Source layout/
   accessibility review preserves labels, keyboard order, scrollable tables and
   English; DEC-005 does not require screenshots.
3. Compatibility/parent boundary: journal-presentation.ts is shared by REST list/
   detail and list_entries/get_entry MCP; accountDetail serves account REST and
   get_account MCP. Additive debitTotals and amountCurrencyCode leave old raw
   numeric/fixed-two aliases and saved FX intact. Manual/null/recurring_journal
   tags own their units; opening balances retain USD cents; other automated
   amounts use current organization base. Linked reversals inherit original policy
   and invalid/missing/foreign/overlong chains fail closed. Removed the unused
   obsolete automated-USD fallback helper. No stored amount is rescaled or
   converted again. Existing raw GL aggregate/base conventions, identity foreign
   recurring templates and absence of historical base snapshots are documented
   exceptions; this task does not normalize mixed manual/opening units or repair
   changed-base history. Safe Number wire limits remain. Auxiliary report widgets
   stay MON-008. No schema/migration/production IRR flag changes.

## Authorized CI repair

Actual failed run: https://github.com/sahmadiut/dubbl/actions/runs/38186023154,
PostgreSQL Migration Fixtures job 114608399229, duration 8m38s. Queried the fork
explicitly with gh -R sahmadiut/dubbl. The first unqualified gh query resolved the
upstream repository; it was corrected before diagnosis. Actual logs show only
receivable-document-ui.test.ts failed, at worker line 133, with "Cash settlement
cannot predate document recognition". Lint/typecheck/unit/controller jobs passed.

Quote conversion deliberately uses current UTC issueDate; the fixture supplied
hardcoded 2026-10-11 for payment/prepayment even when its converted invoice was
recognized later. Updated only this fixture to settle using the saved invoice
issueDate for payment, prepayment/create/apply and overpayment negatives. Added
REST/MCP rejection of the immediately preceding UTC date and unchanged-state
assertions. Backend date enforcement remains intact. Final repaired 24-workflow
fixture passes locally, including all four currencies and three origins over
REST/MCP. No workflow/migration configuration was changed. The next hosted CI
result is deliberately not awaited, per the user.

## Verification

All commands ran from D:/Projects/dubbl. Dedicated synthetic PostgreSQL 18 cluster:
C:/Users/Sajjad/AppData/Local/Temp/dubbl-mon152-pg-bb3f9548f3f244f6826aae7e62c0abf6,
127.0.0.1:55452, trust-authenticated synthetic dubbl_ci, UTC, jit=off,
max_locks_per_transaction=256. Explicit loopback TEST_DATABASE_URL and PG_BIN;
each harness created/migrated/dropped a randomized fixture database. Application
.env/database was not read or mutated. Final fixture DB count 0; pg_ctl fast stop
passed. No full build, dev server, Docker, provider call or deployment.

| Command/procedure | Actual final result | Limit |
|---|---|---|
| node --import tsx --test tests/core-presentation-money.test.ts tests/journal-ui-money.test.ts tests/journal-ui-components.test.ts | Exit 0; 11/11 | Final focused pure/rendered editor behavior |
| node --import tsx --test --test-concurrency=2 tests/integration/receivable-document-ui.test.ts tests/integration/core-presentation-money.test.ts tests/integration/journal-ui-money.test.ts tests/integration/core-accounting-integration.test.ts tests/integration/journal-integration.test.ts tests/integration/opening-balance-ui-money.test.ts | Exit 0; 6/6 | Final migrated transport/SQL regressions and CI repair |
| pnpm test | Exit 0; 474/474 | Full current pure suite; subsequent removal of unused journalDisplayCurrency/assertions separately verified by final focused suite/typecheck |
| pnpm typecheck | Exit 0 | Final source/test MDX/tsc; no full build |
| pnpm exec eslint over all 18 changed/new TS/TSX files | Exit 0; no output | Final changed-file lint including CI worker |
| pnpm lint | Exit 0; 0 errors, 98 existing warnings | Whole-repo warnings; final changed-file lint has none |
| python .agentic/scripts/money_inventory.py --write; then without arguments | Exit 0 | 415 columns; 2048 scanned files; 1538 consumers; 29515 occurrences |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0 | Drizzle classification, hashes and all source lines |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0; 9/9 | Legacy import guard regression |
| python .agentic/agent.py validate | Exit 0; 202 tasks | Structural workflow only |
| git diff --check | Exit 0 | Line-ending notices only |
| Source/layout/self-review | Completed | No browser screenshots; not independent accounting approval |

Initial new fixture mistakes (unbalanced opening sample, unauthenticated session
read outside Next request scope, widened owner role and implicit test types) were
corrected to balanced data, explicit invalid API key and proper fixture types.
The first early-payment assertion expected 422; inspected backend AuthError policy
is 400, corrected and reran successfully. These were fixture/typing failures;
no backend date policy was relaxed. Final complete focused integration selection
passes 6/6 after all corrections. Read-only source commands with nonexistent
guessed file names/PowerShell glob syntax were corrected with bounded searches.

## Review and handoff

Honest self-review: MON-152-review-1.md. No scoped unresolved blocker. Submit,
self-approve and complete with the controller; commit only task-owned changes
and the explicitly authorized CI fixture repair; push origin/master, verify remote
SHA/clean tree and report the next task. Do not wait for new hosted CI or start
the next task. Local PostgreSQL 18/Node checks do not prove hosted PostgreSQL 16,
production IRR, full-int64 workflows, historical remediation or accounting/
linguistic/release qualification.
