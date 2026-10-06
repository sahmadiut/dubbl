# MON-106 attempt 1 - cumulative financial statement contracts

## Identity

2026-10-07, Asia/Tehran. Operator: coding-assistant. Entry master HEAD
`f071e1fa335b894eeae080bd3518df40266a3cab`; clean working tree at entry.
This evidence is prepared before the task commit. Self-review only, no independent
human/accounting or deployment approval. User authorized completing and pushing
one next bounded controller task.

## Implementation and inspected scope

Controller selected MON-101. Read root/nested instructions, project/repository
map, controller, task/parent, MON-011 foundation evidence, ADR-006, money manifest,
actual report REST/MCP, GL and export implementations and fixture harness.
Eleven reports use independent period, line/running-balance, cash flow, dimensional
and compound computations. Split per controller rules into MON-106 cumulative
statements/shared GL/export, MON-107 period statements, MON-108 ledger detail,
MON-109 cash flow and MON-110 compound reports/ratios. Parent criteria remain
unchanged/unchecked; children inherit MON-011 and source sections, dependent
reports also require shared/combined services. Started only MON-106.

- `cumulative-statement.ts` is the shared REST/MCP direct-DB service. Organization,
  inclusive cutoffs and cumulative unclosed earnings use one repeatable-read
  read-only transaction. Require view:data and a supported organization currency.
- `gl-query.ts` reads SQL SUM as text, uses bigint intermediate debit/credit/natural
  balances and exports exact as-at/range/dimension APIs. Legacy APIs retain their
  numeric field types with final range guards. Account and entry scope is enforced
  in both join directions, including cash-account existence subqueries.
- `statement-wire.ts` validates real Gregorian input, canonical/legacy cutoff
  aliases, comparison count and formats. Existing fixed two-place decimal strings
  coexist with Minor strings; final reported amounts are safe numeric-range cents.
  No amount is rescaled by JSON currency or original journal-line currency tag.
- REST routes delegate through `cumulative-response.ts`; registered trial_balance
  and balance_sheet MCP tools call the same service through wrapTool with described
  inputs, units and returned fields. Strict dates/auth/errors match both surfaces.
- `statement-money.ts` formats PDF integer/fraction parts exactly and guards XLSX
  numeric cells against failed decimal round-trip and Excel 15-digit precision.
  Shared single/multi-sheet exports retain their prior currency-based scaling,
  explicitly distinguished from fixed-two-place JSON. Existing formula-text escaping
  and comparative layouts remain. JSON trial-balance rows do not enforce unexposed
  export-subtotal bounds; exports do.
- CUMULATIVE_STATEMENT_WIRE_CONTRACTS documents every input/output/alias, supported
  range, error, scope and export distinction. Updated manifest, README, test matrix,
  inventory, task index and source traceability. No schema/migration/history or
  production IRR flag changes.

## Acceptance mapping

1. Registry maps both REST/MCP pairs and shared GL/export consumers, fixed cents
   versus currency-scaled exports, aliases and safe/Excel limits; no exact-only
   negotiation or full-int64 promise. Existing field names/envelopes are retained
   with additive currencyCode/Minor fields.
2. Actual migrated disposable PostgreSQL fixture invokes both API-key REST handlers
   and registered MCP SDK clients. Exercises empty accounts, all account types,
   cumulative history/inclusive dates, three comparison columns, default/legacy
   cutoffs, unclosed earnings, duplicate removal, two organizations, malformed
   cross-org references in both directions, bad API key, custom-role denial and
   invalid dates/count/query. Both clients match, including USD/IRR/JPY/KWD inputs
   as implicit context with unchanged JSON cents. Shared GL type/date/dimension/
   cash/empty paths and prior budget-report fixtures are exercised.
3. SQL sums above safe-number and int64 bounds cancel without losing a cent. Safe
   maximum decimal/Minor outputs match exactly; unsafe final balances, section
   totals, earnings and currency fail with 422 LEGACY_NUMERIC_RANGE. Hidden revenue/
   expense operands can cancel exactly before balance-sheet projection. Actual
   XLSX routes reject unrepresentable cells, PDF and workbook serialization work,
   and query/failure snapshots preserve ledger/chart/audit rows. Authentication can
   update API-key lastUsedAt independently. No bigint JSON crash or rounded-Number
   recovery; no report mutation.

## Verification

All commands ran in D:/Projects/dubbl. Task-created PostgreSQL 18 cluster listened
only on 127.0.0.1:55506 with a synthetic fixture role and UTC timezone.
TEST_DATABASE_URL explicitly targeted that cluster. Harness created, migrated and
dropped random dubbl_ci_ databases; configured application DB was not accessed.
Cluster stopped after final checks; temporary cluster directory retained outside
the repository. No full build, dev server, Docker or deployment was run.

| Command/check | Actual result | Scope/limit |
|---|---|---|
| node --import tsx --test tests/cumulative-statement-wire.test.ts tests/integration/cumulative-statement.test.ts tests/integration/budget-report.test.ts | Exit 0; 6/6, no skips | Initial pure/report/regression run |
| node --import tsx --test tests/integration/cumulative-statement.test.ts tests/integration/budget-report.test.ts | Exit 0; 2/2, no skips | Final DB run after added edge-export/hidden-earnings fixtures |
| pnpm test | Exit 0; 314/314, no skips | Full pure/unit suite, including actual XLSX/workbook/PDF serialization |
| pnpm typecheck | Exit 0 | Final MDX/tsc after fixes; no full build |
| pnpm exec eslint on all changed TS files, then final worker | Exit 0; clean | Changed-file checks |
| pnpm lint | Exit 0; 0 errors, 122 pre-existing warnings | Full repository verification; no changed-file warnings |
| python .agentic/scripts/money_inventory.py --write, then without --write | Exit 0; 415 columns, 1329 consumers, 26058 occurrences | Inventory, not transitive correctness |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0 | All Drizzle/source hashes and occurrence lines match |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0; nine checks | No new legacy-money helper usage |
| python .agentic/agent.py validate/status/next | Exit 0; 160 tasks after split | Structural state, not product qualification |
| git diff --check | Exit 0 | Whitespace check |

Initial typecheck caught a removed type import still required by the untouched
MCP report implementations, then a fixture result-union property access. Restored
the import and asserted the result shape before access; final typecheck passes.
No behavioral fixture failure occurred. All final code checks above are actual
results and completed before submit/done.

## Review and handoff

Honest self-review is recorded separately in MON-106-review-1.md. Trial-balance
natural-sign debit/credit presentation and natural-balance export subtotal remain
the assigned PAR-008/QA-001 defect, characterized by fixtures and explicitly
excluded from accounting qualification. Broader historical/full-range/currency,
high-volume, localization/PDF layout, independent financial and production gates
remain open. MON-107..110 retain other report calculations, and MON-101/MON-029
retain independent combined acceptance. Finish review/controller transitions,
commit only task-owned files, push master and verify remote SHA/clean tree; stop.
