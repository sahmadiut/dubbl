# MON-061 attempt 1 - expense claim lifecycle contracts

## Identity

2026-10-04, Asia/Tehran. Operator: coding-assistant. Entry HEAD cbd3b60 on
master, clean working tree. User authorized the next task, commit and push when
complete. Controller validate/status/context selected MON-061; ownership claimed.
This evidence describes verified uncommitted changes; no invented final commit.
Implementing-assistant self-review only, not independent financial/security or
production approval.

Read root/nested instructions, START_HERE/controller/project/repository map,
backend role, MON-061/MON-011/060 evidence and handoffs, ADR-006, manifest, source
migration/API compatibility sections and actual routes/MCP/schema/helpers. No
external implementation copied, tax rule research or statutory compliance claim.

## Implementation and actual findings

Six REST operations now use shared direct-DB lifecycle services in
lib/api/expense-claims.ts, with six strict described tools in expenses.ts.
Existing tool-index registration is preserved; reject/reverse add the missing
REST-equivalent MCP operations. Submit/recall/approve/pay names remain unchanged.
Every updated header keeps numeric claim-currency totalAmount and adds
totalAmountMinor. New expense-lifecycle-wire.ts describes strict pay/reject
inputs and provides pure bigint tax ratios. Existing CRUD tenant/reference/
saved-money/mileage/receipt/person checks are shared via explicit helper exports.

Actual old approval ignored item taxRateId/costCenterId, skipped nonpositive
lines and credited the sum instead of requiring equality to the saved header.
Old settlement converted the payable at the new rate, leaving recognition
carrying value uncleared; concurrency loaded state outside transactions and
audits were separate/unawaited. These paths now use exact tax/FX, complete saved
totals and atomic organization/claim locking with CRUD.

Approval supports inclusive standard/partial, gross blocked/exempt/no_vat/
sales_tax_us and net supplier reverse-charge semantics. Expense/input/output
tax legs retain dimensions and posting rounds exact ratios; compound components
explicitly reject rather than disappear. Approval uses current UTC date, exact
historical document-to-base rate, currency minor scales and deterministic
conversion residuals. Qualified FX source/effective date/provider metadata and
complete base legs are in the same posting audit.

Reimbursement clears actual saved 2110 carrying, credits cash converted at saved
payment date and balances existing FX gain/loss codes 4910/5930. No repeated
expense debit, partial payment, bank-feed update or external transfer. Cash GL
eligibility now requires live active owned bank/cash asset or standard bank band
and claim/base denomination; liability/revenue/other assets cannot receive the
cash leg merely because their code exists. System account type/base and journal
sequence ranges are guarded.

Saved recognition/payment history is scoped, posted, unreversed and unambiguous,
with original header link, exact rate metadata, nonnegative balanced amounts,
owned dimensions and posting-specific base/total/leg audit provenance. Missing
legacy provenance, changed base or tampered history rejects without guessing.
Reversal swaps saved sides verbatim on original open dates, retaining rates/
dimensions/links and resets all lifecycle metadata. Repeated correction cycles
match their own journal audits; changing/deleting quotes cannot revalue reversal.

All status/account/number/journal/link/response/audit effects commit together.
Repeated successful operations fail on state (no replay-key API), and duplicate
concurrent approve/pay/reverse cannot post twice. Submit/approve validate item
dates plus posting dates; payment validates posting date and chronology; reversal
validates original dates. Recall/reject remain nonposting transitions. Two-tier
locks/fiscal closure and distinct manage/approve permissions are preserved.

Registry EXPENSE_LIFECYCLE_WIRE_CONTRACTS.md inventories every operation's inputs,
outputs, units, aliases, rounding/ranges, errors and supported history. Updated
money README, manifest, current CRUD coordination note, matrix and reproducible
money inventory; historical evidence/task approvals remain unchanged.

## Acceptance mapping

1. All six boundaries documented in the new contract registry, including absent
   money input, REST/MCP field names, numeric/minor response coexistence, stored
   claim versus base GL denomination, FX direction/precision, dates and ranges.
2. Actual handler/API-key and linked MCP SDK fixtures exercise all six tools,
   legacy/exact saved amounts, multiple role authorities, invalid/expired API
   keys, foreign/missing claims and tenant references. No HTTP mock substitute.
3. Snapshot assertions prove no committed financial/status/audit changes for
   malformed/state/range/tenant/FX/history/lock failures; real SQL audit faults
   prove rollback after posting and reversal work. Max-safe money succeeds;
   larger stored money rejects, without BigInt JSON crashes or rescaling.

## Actual verification

All commands ran at D:/Projects/dubbl with installed dependencies. Synthetic
PostgreSQL 18.6 cluster D:/Temp/dubbl-mon061-pg-09649395596c455f8bd74bd54d477430,
loopback 55471, trust-auth dubbl_ci role. pg_ctl launched hidden. Explicit
TEST_DATABASE_URL targeted only that cluster; harness created/migrated/dropped
random databases. Existing .env target/credentials were not used or printed.
Worker provider keys blank; no provider or Next server requests.

| Actual command / procedure | Result | Scope / limitations |
|---|---|---|
| Controller validate/status/context/start | Exit 0; valid 119 tasks, MON-061 selected/claimed | Structure only |
| pnpm test | Exit 0; 182/182 | Includes two new pure schema/tax groups |
| Final node --import tsx --test --test-concurrency=1 tests/integration/expense-lifecycle.test.ts tests/integration/expense-crud.test.ts tests/integration/payment-settlements.test.ts tests/integration/payment-reversals.test.ts tests/integration/credits.test.ts tests/integration/debit-notes.test.ts tests/integration/bill-lifecycle.test.ts | Exit 0; 7/7 | Actual routes/SDK and migrated disposable PostgreSQL |
| Expanded lifecycle standalone rerun | Exit 0; 1/1 | Negative history/compound tax/base/FX cases plus rollback/races |
| Final pnpm typecheck | Exit 0; MDX generation and tsc --noEmit | Installed/generated environment; no build |
| pnpm lint | Exit 0; 0 errors/155 existing warnings | Whole repository |
| Final affected source/routes/unit/integration eslint | Exit 0; no warnings | Changed TS paths |
| money_inventory.py --write; money_inventory.py | Exit 0; 410 columns/1479 scanned paths/1211 consumer files | Source inventory, not dataflow proof |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0; Drizzle/hash/source lines verified | No schema mutation |
| node .agentic/scripts/verify_legacy_money.mjs | Exit 0; nine regression checks | No increased legacy allowance |
| git diff --check; git fetch origin; rev-list HEAD...origin/master | Exit 0; 0/0 ahead/behind at fetch | User-authorized commit/push follow tracker closure |
| psql disposable database count; pg_ctl -m fast -w stop | Zero fixture databases; shutdown exit 0 | Synthetic cluster retained outside repo |

Pure fixtures verify inclusive/partial/reverse-charge ties, safe maximum and
overflow, strict dates/unknown fields/nonblank rejection. DB assertions cover
nonposting submit/recall/reject, positive totals, exact tax accounts and dimensions,
EUR loss and JPY gain with differing scales, max-safe approval/pay/reverse, deleted
rates and changed tax configurations during saved reversal, repeated cycles,
invalid/future/locked/pre-approval dates, two-tier bypass/fiscal closure, zero/
unsafe/mismatched/foreign/inactive data, missing/tiny/unrepresentable inverse FX,
compound components, changed base, duplicate/draft and missing-audit histories.
Real audit trigger faults roll back approval/payment/reversal/recall/reject and
MCP equivalents. Parallel double approval, REST/MCP reimbursement, double
reversal, edit/submit and recall/approve assert serialized state and exact money.
Payment table remains empty: this slice performs reimbursement GL only.

Preliminary failures were corrected: fixture bearer token without the dk_ prefix
fell through to session auth outside a Next request; replaced with invalid dk_
API token. Direct unrepresentable FX fixture update was correctly rejected by the
coexistence trigger; assert that rejection and use unrepresentable inverse lookup
for the application test. Ambiguous-journal fixture omitted required description;
fixed and final typecheck/7-worker run pass. Plain node inventory verifier lacked
tsx module resolution; corrected launcher passes. A combined long shell write/
launcher was automatically rejected; applied explicit patches and separate hidden
launcher successfully. No required action or approval remains blocked.

## Review and handoff

See MON-061-review-1.md for the implementing assistant's self-review and limits.
No schema edits, migration generation, production migrations, builds, dev server,
Docker, browser/session/OAuth, live provider calls, deployment or IRR enablement.
MON-021 retains combined payment/expense/banking acceptance and MON-042/045/048/051
carrier coordination. Historic remediation, full-int64, compound tax, generic
bank/restore/merge/reference/configuration writer races, PostgreSQL 16/clean
install/production migration, independent financial/security/locale/provider/IRR
and release gates remain assigned. This task has no bounded-slice blocker.
Close the controller, commit/push as authorized and stop. Next task MON-062:
exact bank account contracts.
