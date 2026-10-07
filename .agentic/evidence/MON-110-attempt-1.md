# MON-110 attempt 1 - exact compound financial reports

## Identity and scope

2026-10-07, Asia/Tehran. Operator: codex. Entry master HEAD
`37a52fa2528007d647277874444830beb55153ea`, clean working tree. User authorized
completing and pushing one next bounded controller task. Controller selected
MON-110; started it with owner codex. Self-review only, no independent human,
accounting, deployment or production approval.

Read root/nested AGENTS, START_HERE, controller, project/repository map, selected
task and dependency evidence, ADR-006 and money manifest. Inspected actual REST,
MCP, shared GL/cumulative/period/cash-flow/export/workbook code and fixture harness.
No other task was started. MON-101/MON-029 retain combined acceptance.

## Implementation and acceptance mapping

1. COMPOUND_REPORT_WIRE_CONTRACTS documents tracking-category, report-pack and
   financial-ratios REST/MCP pairs, tracking PDF/XLSX and pack workbook exports,
   dates/defaults/enums, scalar and aligned array Minor fields, exact ratio units,
   ranges and errors. Updated README, money manifest, test matrix and generated
   inventory. JSON retains numeric integer cents independent of currency; exports
   retain currency scaling and existing exact Excel/PDF/formula-text guards.
2. Shared direct-DB service requires view:data and uses one read-only repeatable-read
   snapshot for currency/labels/all periods/documents. Existing tracking/report-pack
   tools delegate to it; financial_ratios and two export operations add missing MCP
   parity. Actual API-key REST and registered MCP SDK clients on migrated disposable
   PostgreSQL verify all three pairs, both tracking dimensions/modes, both applicable
   bases, prior earnings versus period income, full trial balance, cash subtype,
   defaults/earliest/inclusive periods, empty columns and aligned zero cells,
   historical deleted labels, two tenants and malformed cross-org account/entry/
   dimension references, denied keys/custom permissions and USD/IRR/JPY/KWD.
3. All SQL money aggregates are text; amounts and derived sums use bigint before
   guarded numeric projection. Tests cover SQL sums above int64 that cancel,
   positive/negative safe limits, unsafe row/section/global/net output, rounded ratio
   decimal precision and Excel failure. Unknown/duplicate/invalid date/enum controls,
   unsupported saved currency, foreign dimensions and mismatched outstanding document
   currency fail with unchanged ledger/chart/document/dimension/audit snapshots.
   No bigint JSON crash, unsafe Number recovery or magnitude/unit inference.

Pack reuses the standalone exact income-period reader, cumulative earnings helper
and cash-balance helper within its own snapshot. It fixes period-only earnings in
cumulative balance sheet, omitted revenue/expense trial-balance accounts and omitted
explicit cash subtype. Standalone helper refactoring retains existing behavior and
passes adjacent fixtures. Ratios now honor endDate, shared posted/deleted/tenant
filters and deleted-document exclusion, correcting the old outer-join leakage.
Outstanding documents retain their current snapshot, with an explicit requirement
for organization currency and no FX. Ratio formulas retain existing classifiers,
net-income gross-margin heuristic, day convention and rounding ties. Exact strings
have the same rounded decimal meaning as numeric ratios, independently of money.

## Verification environment

Commands ran in D:/Projects/dubbl. Created a disposable PostgreSQL 16.15 cluster
using the existing portable runtime, bound only to 127.0.0.1:55510 with synthetic
fixture role and UTC timezone. Explicit TEST_DATABASE_URL targeted it; harness
created, migrated and dropped random dubbl_ci_ databases. Application DB was not
accessed. Cluster stopped after final fixtures; temporary data retained outside Git.
No full build, dev server, Docker or deployment was run.

| Actual check | Result | Scope/limit |
|---|---|---|
| node --import tsx --test tests/compound-wire.test.ts tests/integration/compound.test.ts (initial) | 2 passed, 2 failed | Test-only expected-lossy example and default URL construction corrected |
| node --import tsx --test --test-concurrency=1 tests/compound-wire.test.ts tests/integration/compound.test.ts tests/integration/cumulative-statement.test.ts tests/integration/period-statement.test.ts tests/integration/cash-flow.test.ts tests/integration/ledger-detail.test.ts | Exit 0, 8/8, no skips | Shared-helper/compound and adjacent report regression, PostgreSQL 16 |
| node --import tsx --test tests/integration/compound.test.ts (final) | Exit 0, 1/1, no skips | Added formula escaping, signed negative overflow, separate section overflow and actual ratio precision failure |
| node --import tsx --test --test-concurrency=2 tests/*.test.ts | Exit 0, 330/330, no skips | Full pure/unit suite |
| pnpm typecheck | Exit 0 | MDX/tsc, no build |
| pnpm exec eslint on changed/new TS files; final compound worker | Exit 0, clean | Changed-file lint after fixture additions |
| pnpm lint | Exit 0, 0 errors, 120 existing warnings | Full repository lint; no task-file warnings |
| python .agentic/scripts/money_inventory.py --write | Exit 0, 415 columns, 1348 consumers, 25964 occurrences | Lexical inventory, not transitive correctness |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0 | Drizzle/source hashes and occurrence lines verified |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0, 9 checks | No new legacy helper violations |
| python .agentic/agent.py validate; git diff --check | Exit 0 | Structural/whitespace checks |

Initial typecheck found a union of Zod enum instances narrowing the common format
result to json/xlsx. Parsing each enum separately preserved json/pdf/xlsx inference;
final typecheck passes. The initial pure test used a large decimal that actually
round-tripped, so it was replaced by an independently demonstrated failing digit.
Default pack fixture URL used &format without a leading ?, returning a workbook;
corrected URL construction. Final assertions pass without skips or weakened gates.

## Review and handoff

Honest self-review: MON-110-review-1.md. Pack trial balance preserves its normal-sign
split; standalone trial-balance's tracked natural-sign defect remains PAR-008/QA-001.
Cash summary is actual cash movement, not the standalone heuristic activity statement.
Current outstanding documents and existing ratio/cash-basis heuristics are explicit.
Full-int64 public clients, historical currency, independent accounting, large-data,
browser/session/OAuth, localization/PDF layout and production/release qualification
remain separate. No schema, history rescale or IRR flag change.

Implementation/verification complete. Finish criterion checks/submit/self-review/done,
commit only task-owned files, push origin/master and verify matching remote SHA and
clean working tree, then stop after this one task.
