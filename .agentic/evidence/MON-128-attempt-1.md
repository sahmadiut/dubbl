# MON-128 attempt 1 - shared core posting arithmetic

## Identity and scope

2026-10-10, Asia/Tehran. Operator/reviewer: coding-assistant; self-review only.
Entry master HEAD 61246271, clean working tree. The user authorized completing
and pushing the next task. Live controller validate/status/next selected MON-007.
Source review found separate shared backend arithmetic gaps and core UI float/
fixed-two consumers, including accounting/[id]/page.tsx and create-drawer.tsx.
Created MON-128/129 with inherited prerequisites and source sections, validated,
then used controller split to queue MON-007 with both children. Its original
three criteria remain untouched/unchecked. Live next selected MON-128 and it
was started. This is one bounded backend delivery; UI and original parent
acceptance remain open. No application schema/migration or production flag change.

## Implementation

- Added lib/money/posting.ts: explicit safe integer bridge, canonical roundRatio
  with signed ties toward positive infinity, arbitrary-precision ratio products/
  sums and checked legacyMinor projections. Exact sums preserve cancellation;
  unsupported input/result amounts fail with WireCompatibilityError.
- Shared tax calculator, inclusive VAT, recoverability and reverse-charge
  branches use bigint ratios. The reproducible 4000000000000001 * 3333 / 10000
  floating result was 1333200000000001; exact rounding gives 1333200000000000.
  Absorbed expense sums and retained invoice/credit/bill/payment journal totals
  no longer use floating Number aggregation. Invoice/credit sum rejection now
  precedes header writes. Retained bill helper owns a transaction including
  header/control accounts/lines, so a checked-arithmetic failure rolls back.
- Common scalar FX conversion and gain/loss differences use exact ratios and
  checked sums/differences. convert-entry side totals and line residuals remain
  bigint until final projection; largest-magnitude residual policy is preserved.
  journalTotals retains its existing safe intermediate FX-product cap and balance
  tolerance while using exact ratio rounding. Shared stock-to-GL money products
  and cost-per-whole-unit division are exact; physical hundredths rounding stays.
- Retained VAT control aggregate queries return SQL text rather than mapWith(Number).
  Their exact source totals/differences are checked before legacy projection.
  Existing date/status/scoping selection policy is preserved.
- Added pure posting regression tests and migrated-DB core-money-cutover harness/
  worker. Independent bigint expectations check real shared posting exports in
  four synthetic currencies, saved reversal mirrors, large low digits, scalar
  FX/reference edits and unchanged range rejection snapshots. Actual REST/MCP
  family regressions independently retain authentication, tenant/role, allocation,
  replay, locks, concurrency and current document-currency-scale policies.
- Added CORE_POSTING_CUTOVER_CONTRACTS with all six core backend inventories,
  shared/retained helper ownership, supported bounds, compatibility/nonmoney
  scale exceptions and MON-129/MON-007/MON-008 ownership. Updated money README,
  manifest, test matrix, task index/coverage and lexical source inventory.

The source check confirms createBillJournalEntry, createCategorizationJournalEntry
and calcTax have no current external application caller. Their regression tests
qualify retained exports, not newly invented public workflows. Current domain
services already use adopted exact adapters. Scalar legacy FX helpers do not
infer currency scales; current document services use convertInvoiceLegs with
both currency scales. No public range expansion or transport mode is introduced.

## Acceptance mapping

1. Exact backend arithmetic and ownership: canonical posting helper and checked
   ratio/sum/difference projections replace the remaining shared tax/FX/money
   calculation gaps. Contract table joins all affected core groups to the manifest
   and existing complete operation inventories; inventory hashes/source lines
   and Drizzle classification agree after regeneration.
2. Behavior: new pure/DB fixtures prove low-digit rounding, balanced posted
   journals, exact signed safe edges, saved mirror reversals/FX and unchanged
   failure state. Real core/cash family fixtures reverify idempotent replay,
   allocation, period-lock, role/tenant and concurrency behavior. All selected
   regressions pass; child status is not the acceptance evidence.
3. Scale exceptions: shared engine has no remaining monetary Math.round,
   parseFloat or mapWith(Number) aggregation. Its two remaining Math.round calls
   are physical quantity hundredths. Fixed-two journal legacy projections/imports
   preserve exact raw Minor aliases and explicit historical units. Rate and tax
   denominators are defined nonmoney ratios. Remaining core UI calculations are
   specifically MON-129; MON-007 remains open for final combined acceptance.

## Test database and verification

Dedicated synthetic PostgreSQL 18 cluster:
C:/Users/Sajjad/AppData/Local/Temp/dubbl-mon007-pg-7488ee3717ed4303a2a1ee6177fa0073,
127.0.0.1:55407, synthetic trust-authenticated dubbl_ci role, loopback only,
max_locks_per_transaction=256 and jit=off. Explicit TEST_DATABASE_URL selected
this server; PG_BIN selected installed matching clients. Each harness creates,
migrates and drops a randomized dubbl_ci_* database. No application .env or
application database was read/migrated/reset. Final fixture DB count: zero;
pg_ctl fast stop succeeded. Temporary dedicated cluster files remain.

All commands ran from D:/Projects/dubbl. No full build, dev server, Docker,
live provider, deployment or hosted CI run.

| Command / procedure | Actual result | Scope/limit |
|---|---|---|
| node --import tsx --test tests/posting-money.test.ts tests/journal-wire.test.ts tests/convert-entry.test.ts tests/settlement.test.ts | Exit 0; 17/17 | New arithmetic plus old balance/settlement policies |
| node --import tsx --test tests/integration/core-money-cutover.test.ts | Exit 0; 1/1, rerun with final MON-128 title also passed | Real retained posting exports, independent expectations, four currencies and snapshots |
| node --import tsx --test --test-concurrency=2 tests/integration/core-accounting-integration.test.ts tests/integration/journal-integration.test.ts tests/integration/receivable-document-integration.test.ts tests/integration/payable-procurement-integration.test.ts tests/integration/payment-expense-bank-integration.test.ts tests/integration/configuration-integration.test.ts tests/integration/fx-history.test.ts tests/integration/fx-wire.test.ts tests/integration/exact-boundary-integration.test.ts tests/integration/inventory-master.test.ts | Exit 0; 14/14 | Selected core/auth/lock/replay/FX/stock regression families; not every historical suite |
| pnpm test | Exit 0; 375/375 | Complete current pure suite |
| pnpm typecheck | Exit 0 | MDX generation and tsc; no full build |
| pnpm exec eslint lib/money/posting.ts lib/currency/converter.ts lib/currency/convert-entry.ts lib/api/journal-wire.ts lib/api/journal-automation.ts lib/api/tax-calculator.ts tests/posting-money.test.ts tests/integration/core-money-cutover.test.ts tests/integration/core-money-cutover-worker.ts | Exit 0, no output | All changed TS source/tests |
| pnpm lint | Exit 0; 0 errors, 104 existing warnings | Same warning count as entry dependency evidence |
| python .agentic/scripts/money_inventory.py --write, then without write | Exit 0 | 415 columns, 1942 scanned files, 1440 consumer files, 27442 occurrences |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0 | Drizzle columns, all consumer hashes and source lines verified |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0; 9/9 | Existing legacy import/reference guard |
| Source/link review | 7 contract links resolve; only two physical quantity Math.round calls remain in changed shared engine | Source inspection, not universal whole-program dataflow proof |
| python .agentic/agent.py validate | Exit 0; 179 tasks | Controller structure only |
| git diff --check | Exit 0 | CRLF notices only |
| psql fixture DB count and pg_ctl fast stop | Zero DBs, stopped with exit 0 | Dedicated synthetic cluster only |

Self-review corrected the residual pure fixture to use two odd credit legs so
both round upward and truly require the one-unit residual; final focused
posting-money.test.ts passed 4/4. Only test data/expected values changed after
the complete unit run; no production changes followed its successful verification.
Inventory was refreshed/reverified after that correction. The initial shell
source-inspection globs and a one-line diagnostic had PowerShell syntax/path
errors; corrected bounded reads/diagnostics succeeded. They were not product
test failures. No implementation/typecheck/integration repair was required.

## Review and next action

Actual self-review: MON-128-review-1.md. No unresolved scoped blocker. Submit,
approve as self and complete MON-128 with the controller, commit only task-owned
files, perform authorized origin/master push and verify remote SHA/clean state.
Stop after this bounded task; next is MON-129. MON-007 original parent criteria,
MON-008 auxiliary/public closure, full-int64 business expansion, financial/
migration/base-currency/IRR/security/localization/release gates remain independent.
Local PostgreSQL 18/Node verification does not establish PostgreSQL 16/hosted CI
or production accounting correctness.
