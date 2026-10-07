# MON-109 attempt 1 - exact cash-flow report contracts

## Identity

2026-10-07, Asia/Tehran. Operator: codex. Entry master HEAD
`d07327681bddb4e7c3f04dd3686711cfe47ad62d`; clean working tree. Controller selected
MON-109 and it was claimed with start --owner codex. One bounded task only.
Self-review, no peer/human/independent accounting or deployment approval.

## Implementation

Read root/nested instructions, START_HERE/controller/project/repository map,
backend role, MON-109 and MON-011/MON-106 evidence, ADR-006 and money manifest.
Verified current REST cash-flow builder and independent MCP SQL implementation.

- cash-flow.ts now uses SQL-text source sums and exact GL aggregations with bigint
  intermediate arithmetic for both methods, source sums, working capital, items,
  activity totals, cash balances and reconciliation. Every query can share the
  caller-owned snapshot. Source sums scope chart accounts and entries.
- cash-flow-service.ts is the shared org/permission/currency-guarded read-only
  repeatable-read service. cash-flow-wire.ts validates dates, controls, cardinality
  and final numeric range, adding exact Minor strings recursively to every amount.
  Flat derived operating rows are computed before narrowing. Year 0001 opening
  cash is zero instead of passing unsupported year zero to PostgreSQL.
- REST delegates to cash-flow-response.ts and uses guarded wire JSON. MCP retains
  cash_flow_statement with the same structured legacy fields plus the REST
  superset, described optional date/method/basis controls and shared wrapTool
  errors. New export_cash_flow_statement supplies corresponding PDF/XLSX operation
  through the same service, returning base64/filename/MIME/encoding.
- cash-flow-export.ts preserves prior statement sections/subtotals/reconciliation
  rows and currency-aware shared exact PDF/Excel precision guards.
- CASH_FLOW_WIRE_CONTRACTS documents every input/output/unit/alias/range and
  error. Updated MONEY_MANIFEST, TEST_MATRIX, README and generated money inventory.
  Existing task index/source coverage already includes MON-109, so no planning
  metadata or task count changed. No schema/migration or historical/IRR change.

## Acceptance mapping

1. Registry maps REST JSON/files, MCP report/export, all optional controls/defaults,
   flat and nested monetary aliases, exact supported ranges and currency-scaled
   export units. Existing numeric fields remain integer cents without FX/rescale.
2. Actual API-key REST handlers and registered MCP SDK clients run on a randomly
   named migrated disposable PostgreSQL database. Fixtures cover both methods and
   bases, defaults/inclusive/earliest dates, all activity sections and legacy/exact
   agreement, signed transfers/refunds, two tenants, malformed cross-tenant links
   in both directions, bad key, denied custom role, strict input failures and
   actual PDF/XLSX/base64 exports for USD/IRR/JPY/KWD.
3. Gross SUMs above int64 and unsafe income operands cancel exactly before final
   numeric projection. Positive/negative safe limits pass; unsafe final source,
   combined net, closing cash and reconciliation amounts return 422
   LEGACY_NUMERIC_RANGE consistently. Excel unsafe precision fails on REST/MCP.
   Report/error snapshots preserve journal/chart/audit rows. API-key lastUsedAt is
   independently updated by authentication. No bigint JSON crash or money writes.

## Verification

All commands ran in D:/Projects/dubbl. A task-created PostgreSQL 18 cluster listened
only on 127.0.0.1:55509, synthetic fixture role and UTC timezone. TEST_DATABASE_URL
explicitly targeted that cluster. The harness created/migrated/dropped random
`dubbl_ci_` databases; the configured application database was not accessed.
Cluster stopped after fixtures; temporary cluster data retained outside the repo.

| Command | Actual result | Scope |
|---|---|---|
| node --import tsx --test tests/cash-flow-wire.test.ts tests/integration/cash-flow.test.ts | Initial 2 pure tests passed; integration failed due to fixture auth key syntax | Corrected test key to dk_bad_key to exercise API auth rather than session path |
| node --import tsx --test tests/integration/cash-flow.test.ts | Exit 0, 1/1 | Corrected initial fixture |
| node --import tsx --test --test-concurrency=1 tests/integration/cash-flow.test.ts tests/integration/cumulative-statement.test.ts tests/integration/period-statement.test.ts tests/integration/ledger-detail.test.ts | Exit 0, 4/4, no skips | Final cash-flow edge tests plus adjacent report regressions |
| pnpm test | Exit 0, 327/327, no skips | Complete pure/unit suite |
| pnpm typecheck | Exit 0 | MDX and tsc; no full build |
| pnpm exec eslint on all changed/new TS files | Exit 0, clean | Final changed-file check |
| pnpm lint | Exit 0, zero errors, 120 existing warnings | Full repository lint |
| python .agentic/scripts/money_inventory.py --write, then without --write | Exit 0, 415 columns, 1345 consumers, 26082 occurrences | Lexical inventory, not transitive correctness |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0 | Source hashes and occurrence lines verified |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0, 9 checks | No new legacy helper violations |
| python .agentic/agent.py validate | Exit 0, 173 tasks | Structural controller verification |
| git diff --check | Exit 0 | Whitespace |

No full build, dev server, Docker, deployment or screenshot workflow ran.

## Review and limits

Honest self-review: MON-109-review-1.md. Existing indirect and direct accounting
heuristics are intentionally retained. A balanced loan_payment source sum is zero;
direct is a cash-income heuristic with depreciation subtraction, not per-payment
tracing. Fixtures demonstrate nonzero reconciliation (50 indirect, 150 direct)
on synthetic loan/depreciation activity. Contract exactness and REST/MCP parity do
not qualify these classifications as complete cash-flow accounting. Unsupported
final amounts fail; full-int64 outputs, historical currency remediation,
independent accounting, performance, browser/session/OAuth and PDF localization
remain separate qualification. MON-110 retains compound/pack reports and
MON-101/MON-029 retain combined integration acceptance.

## Handoff

Implementation and verification complete. Finish controller checks/submit/self
review/done, commit task-owned files, push origin/master and verify remote SHA and
clean working tree. Stop after this one task; do not start the next task.
