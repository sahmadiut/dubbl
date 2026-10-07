# MON-108 attempt 1 - exact ledger detail contracts

## Identity

2026-10-07, Asia/Tehran. Operator: codex. Entry master HEAD
`28f60cff1f3a1f5caffa12f04aa127922e208921`, clean working tree.
User authorized completing/pushing one controller-selected task. Controller
selected and started MON-108. This evidence precedes the task commit; self-review
only, no independent human/accounting/deployment approval.

## Implementation and acceptance mapping

1. LEDGER_DETAIL_WIRE_CONTRACTS maps both REST/MCP pairs and general-ledger
   PDF/XLSX/MCP export, input expectations, exact aliases, default UTC/inclusive
   dates, pagination, dimensions, natural signs, safe ranges and file scales.
   Updated MONEY_MANIFEST, TEST_MATRIX, README and generated MONEY_BOUNDARIES.
2. Shared ledger-detail service reads SQL numeric/text aggregates/windows and
   projects bigint calculations into numeric cents plus Minor strings. Both
   REST handlers, newly registered general_ledger/account_transactions tools
   and the existing ledger export call this direct-DB service. Actual migrated
   PostgreSQL fixture calls API-key handlers and registered MCP SDK clients.
   It verifies numeric/exact agreement, defaults, empty/opening-only results,
   debit/credit-normal and negative signs, multi-line stable pagination, counts
   and full totals independent of line caps, dimensions/sentinels/precedence,
   two tenants and malformed cross-org joins, deleted/missing accounts, API-key
   and custom-role denial, strict syntax/ranges/query rejection and four currencies.
3. One repeatable-read read-only transaction guards all scoped queries/currency.
   Existing period-only runningBalance, balance and closingBalance semantics
   remain; openingBalance and ledgerBalance/closingLedgerBalance add prior
   history explicitly. Stable UUID tie breakers avoid same-entry page drift.
   Final amount/source/running/gross/history bounds reject before serialization
   with 422 LEGACY_NUMERIC_RANGE; aliases never recover rounded Numbers.
   Historical SQL sums exceed int64 twice and cancel to exactly one cent. Safe
   maximum passes; unsafe source/period/running/currency and XLSX precision
   fail visibly. Report snapshots prove unchanged ledger/chart/audit rows.

General ledger exports include all qualifying period lines in both transports;
MCP already exported the full period, while REST previously exported only the
JSON first page. The fixture checks 52 lines despite a JSON limit of 1 and
compares actual REST/MCP worksheet values. Default JSON remains capped at 50.
PDF/XLSX keep prior debit-minus-credit rows and natural-sign period subtotals,
currency scaling and shared export guards. Existing entry/line descriptions and
opaque source metadata remain; scoped entryId/lineId are additive. No schema,
historical rescale or production IRR flag changes.

## Verification

All commands ran in D:/Projects/dubbl. Task-created PostgreSQL 18 cluster listened
only on 127.0.0.1:55508 with synthetic fixture role, UTC timezone and explicit
TEST_DATABASE_URL. Harness created/migrated/dropped random dubbl_ci_ databases;
configured application database was not accessed. Cluster was stopped after
verification; temporary cluster directory retained outside the repository.

| Actual command/check | Result | Scope/limit |
|---|---|---|
| node --import tsx --test tests/integration/ledger-detail.test.ts | Exit 0, 1/1, no skips | Initial fixed ledger fixture |
| node --import tsx --test --test-concurrency=1 tests/integration/ledger-detail.test.ts tests/integration/period-statement.test.ts tests/integration/cumulative-statement.test.ts | Exit 0, 3/3, no skips | Final complete exports/defaults/cap fixture plus adjacent reports |
| pnpm test | Final exit 0, 325/325, no skips | Full pure/unit suite |
| pnpm typecheck | Exit 0 | MDX/tsc, no build |
| pnpm exec eslint on all eight changed/new TypeScript files | Exit 0, clean | Final changed-file check |
| pnpm lint | Exit 0, zero errors, 120 pre-existing warnings | Full repo, no changed-file warnings |
| python .agentic/scripts/money_inventory.py --write, then without --write | Exit 0; 415 columns, 1340 consumers, 26095 occurrences | Inventory, not transitive correctness |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0 | Drizzle/source hashes and lines match |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0, nine checks | No new legacy money usage |
| python .agentic/agent.py validate | Exit 0, 173 tasks | Structural validation |
| git diff --check | Exit 0 | Whitespace |

Initial ledger fixture exposed ambiguous duplicate id/description columns in the
window subquery; explicitly aliased those columns and reran successfully. Initial
lint found an unused import, removed before final checks. Initial full unit run
under concurrent lint/typecheck/integration load hit a currency-rollout child
process timeout. Reran unchanged pnpm test after those checks; all 325 pass.
No full build, dev server, Docker, deployment or schema migration changes.

## Review and handoff

See MON-108-review-1.md for honest self-review. No remaining MON-108 blocker.
Browser/session/OAuth, large-volume performance, independent accounting,
full-range migration and production gates remain separate. MON-101/MON-029
retain combined report acceptance; cash flow/compound reports remain MON-109/110.
Finish controller transitions, commit task-owned files, push origin/master,
verify remote SHA and clean tree, then stop after this task.
