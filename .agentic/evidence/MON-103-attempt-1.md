# MON-103 attempt 1 - exact tax and regulatory reports

## Identity

2026-10-07, Asia/Tehran. Operator: coding-assistant. Entry master HEAD
`d013b3bba47305c1e269ca026ddaf3aefc5fa7a7`, clean working tree. User authorized
completing and pushing one next task; controller selected and started MON-103.
Evidence prepared before the task commit. Self-review only; no independent human,
financial/statutory or production approval is claimed.

## Implementation

Read root/nested AGENTS, START_HERE/controller/project/map/backend role, task,
MON-011 foundation evidence, ADR-006, money manifest, actual seven REST reports,
tax-profile MCP registration, shared tax/statement services and fixture harness.

- `lib/reports/tax-reports.ts` shares all seven direct-Drizzle REST/MCP report
  computations under view:data and one repeatable-read read-only snapshot.
- SQL aggregates are text and monetary calculations use bigint. Additive Minor
  strings preserve numeric integer-cents outputs at safe final bounds. The net
  quantity/price SQL expression keeps the prior per-line integer truncation while
  casting multiplication to numeric to avoid int64 product overflow. Flat-rate
  rational rounding preserves Math.round ties toward positive infinity.
- `tax-return.ts` helpers accept the caller snapshot, use exact amounts and scope
  cash bank/contact metadata. Schedule C scopes accounts as well as entries;
  sales-tax never exposes foreign tax-rate metadata. Reports require supported
  organization currency and reject foreign document/payment totals rather than
  mixing amounts without qualified historical FX conversion.
- Seven thin REST handlers use the shared response/query service and jsonResponse.
  MCP adds six report operations; report_1099 stays registered through the existing
  tax-profile registration, delegates to the same service and adds thresholdMinor.
  Tool fields describe dates, units, defaults, range and known report semantics.
- Strict dates, year/threshold/basis/rate/box/period inputs replace permissive
  parseInt/Number conversion. Unknown/duplicate REST parameters reject. Numeric
  cents, basis points, scaled quantities and counts remain distinct.
- TAX_REPORT_WIRE_CONTRACTS maps every boundary, input, result, alias, scope, range
  and known limitation. Updated manifest, matrix, source traceability, READMEs and
  machine inventory. No schema/migration/history/production IRR changes.

## Acceptance mapping

1. Registry documents all seven REST/MCP pairs, dates/threshold aliases, integer
   cents and exact aliases, basis-point inputs, safe numeric limits and errors.
   Existing envelopes and statutory heuristics are preserved; no exact-only or
   full-int64 public promise is made.
2. Actual migrated PostgreSQL fixtures call all seven API-key REST handlers and
   registered MCP SDK tools. Numeric/exact readers and threshold inputs agree;
   every VAT/BAS field, tax-summary truncation, sales-tax grouping/exemption,
   vendor exclusions, Schedule C/returns mapping, defaults, cash/flat rate/reverse
   charge and owned period overrides have concrete assertions. Two organizations,
   custom-role denial, invalid API key, cross-org entry/account/payment/contact/
   rate/period references and foreign cash-bank recognition are covered.
3. SQL sums above int64/Number range and numeric price products cancel to exact
   cents. Unsafe summary/sales/VAT/BAS/Schedule C/1099 finals and drill-down legs/
   combined totals reject with 422 LEGACY_NUMERIC_RANGE. Supported USD/IRR/JPY/KWD
   integer values retain their units; foreign-currency data fails. Input failures,
   successful queries and output failures preserve whole-table report/GL/audit
   snapshots. Authentication's lastUsedAt is independent from report mutation.

## Verification

All commands ran in D:/Projects/dubbl. Task-created PostgreSQL 18 cluster listened
only on 127.0.0.1:55503, synthetic fixture role, UTC timezone. Explicit
TEST_DATABASE_URL targeted this cluster. Harness created/migrated/dropped random
dubbl_ci_ databases; configured application database was not accessed. Cluster
stopped after final integration tests; temporary directory remains outside repo.

| Actual command/check | Result | Scope/limit |
|---|---|---|
| node --import tsx --test tests/tax-report-wire.test.ts tests/integration/tax-report.test.ts | Exit 0; 4/4, no skips | After exact SQL/product/final range additions |
| node --import tsx --test --test-concurrency=2 tests/tax-report-wire.test.ts tests/integration/tax-report.test.ts tests/integration/tax-period-contracts.test.ts tests/integration/tax-rate-contracts.test.ts tests/integration/cumulative-statement.test.ts | Final exit 0; 7/7, no skips | All seven report pairs plus existing tax/statement regressions |
| node --import tsx --test --test-concurrency=2 tests/*.test.ts | Exit 0; 320/320, no skips | Complete pure/unit suite |
| pnpm typecheck | Final exit 0 | MDX/tsc, no full build |
| pnpm exec eslint on all 18 changed/new TS files | Final exit 0; clean | Changed-file verification |
| pnpm lint | Exit 0; zero errors, 121 existing warnings | One previous unused report import removed |
| python .agentic/scripts/money_inventory.py --write, then without --write | Final exit 0; 415 columns, 1331 consumer files, 26061 occurrences | Source inventory, not transitive product proof |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Final exit 0 | Drizzle/schema/source hashes and occurrence lines match |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0; nine checks | No new legacy-money helper use |
| python .agentic/agent.py validate; git diff --check | Exit 0 | Structural/whitespace checks |

Earlier typecheck caught omitted moved VAT movement declarations, a fixture's
required journal description and union-tuple spread arguments. Fixed before final
checks. First runtime fixture similarly failed its missing journal description.
Tax-rate regression caught the moved 1099 registration/tool count; restored its
original registration composition. Initial lint identified one new unused binding;
replaced it with explicit public projection. Inventory was refreshed again after
an EOF cleanup changed a source hash. All final checks above pass; no outstanding
behavior or verification failure remains.

No full build, dev server, Docker, provider/email request, schema generation,
application database access, deployment or production IRR flag change occurred.

## Review and handoff

See MON-103-review-1.md for honest self-review. Existing VAT reverse-charge/cash,
cross-border classification, flat-rate/drill-down mismatch, BAS placeholders and
Schedule C returns behavior are explicitly preserved and documented. Historical
currency remediation, high-volume, independent accounting/statutory and release
gates remain separate; MON-029 retains combined report acceptance. Finish
controller transitions, commit only task-owned files, push master, verify remote
SHA/clean tree and stop. No MON-103 blocker remains.
