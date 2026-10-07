# MON-113 attempt 1 - exact payment-performance analytics

## Identity

2026-10-08, Asia/Tehran. Operator: codex. Repository D:/Projects/dubbl,
entry HEAD 2a037c1da7007c134cfef5603961b62870227eed on master; clean entry tree.
Controller selected and started exactly MON-113. Technical self-review only.
This evidence precedes the task commit/push and makes no remote-CI claim.

## Implementation

- Replaced independent REST SQL/Number totals with getPaymentPerformance in
  lib/reports/payment-performance.ts, shared with new registered payment_performance
  MCP operation in lib/mcp/tools/reports.ts. REST uses jsonResponse and MCP wrapTool.
- One direct-Drizzle repeatable-read read-only snapshot scopes paid, non-deleted
  invoices/bills with paidAt by inclusive issue date. Scoped left joins prevent
  foreign/deleted contact-name disclosure while preserving document contributions.
- SQL-text source money, checked safe integers and bigint group sums produce
  totalCollected/totalCollectedMinor and totalPaid/totalPaidMinor. Single-currency
  selection applies across both arrays, with an optional ISO filter and empty
  organization fallback. No conversion, rescaling or full-int64 contract is added.
- Timing retains saved paidAt::date, due-date lateness and calendar-day semantics.
  Exact rational rounding preserves negative ties toward positive infinity and
  existing count-weighted rounded-contact summaries. Rational ordering replaces
  the previous unbound SQL aliases and uses deterministic contact-ID ties.
- Existing document-analytics input/query helpers validate real UTC default dates,
  range, ISO currency, duplicate/unknown parameters and unsupported formats. Requires
  view:data. Saved date validation and guarded SQL differences reject infinity and
  year-10000 history with classified 422, rather than database arithmetic crashes.
- Dashboard adds currency filter/reset, visible errors and disabled stale/error
  CSV exports. Exact aliases feed decimal display and CSV with currency/counts.
- Added actual REST/MCP SDK migrated PostgreSQL fixture/worker, boundary registry,
  verification matrix/manifest entries and regenerated source money inventory.
  No schema change, migration generation or application database access.

## Acceptance mapping

1. PAYMENT_PERFORMANCE_WIRE_CONTRACTS.md documents the one REST/MCP pair, inputs,
   defaults, integer-cents aliases, supported ranges, days/counts/percentage units,
   scope, selection, rounding, errors, CSV/display and limitations. MCP input fields
   have schema descriptions; discovery fixtures inspect description and fields.
2. payment-performance-worker.ts invokes the actual API-key REST handler and real
   registered MCP clients. Both compare entire payloads; numeric and BigInt-parsed
   Minor aliases agree through both signed safe endpoints. Fixtures cover empty
   and UTC defaults, inclusive issue dates independent of payment year, on-due
   timestamps, negative half-day/term rounding, late whole percentages, weighted
   summaries, raw-mean ordering, deterministic ties, status/deleted/missing-paidAt
   exclusions, foreign/deleted contact labels and tenants, invalid keys (401),
   denied custom permissions (403), allowed explicit read permissions and missing
   organization (404). Contradictory organization headers cannot retarget keys.
3. Invalid dates/ranges/currencies/types/queries fail via actual readers. Mixed
   invoice/bill currencies require a filter, with unchanged IRR/JPY/KWD 1250 units.
   Exact cancellation succeeds; unsafe source amounts reject even when cancellation
   would yield a safe total. Positive/negative group overflow, both unsafe int64
   storage endpoints, year-10000/infinite paidAt and infinite dueDate yield classified
   422 without financial/audit changes. Contact totals are individually checked;
   two safe-max contacts are accepted because no cross-contact money sum is exposed.

## Fixture and verification

All commands ran in D:/Projects/dubbl. Task-created PostgreSQL 18 cluster bound
only to 127.0.0.1:55513 with synthetic fixture role and UTC timezone. Explicit
TEST_DATABASE_URL selected that server; harness created/migrated/dropped random
dubbl_ci_ databases. The application database was not used. Cluster stopped after
verification. Authentication lastUsedAt bookkeeping is excluded from financial
and audit snapshots.

| Actual command/check | Result | Limitation |
|---|---|---|
| python .agentic/agent.py validate/status/next/context/start | Exit 0; 173 structurally valid tasks | Controller is not financial qualification |
| node --import tsx --test tests/integration/payment-performance.test.ts | Final exit 0; 1/1, no skips | Final rerun includes all additional source-cancellation/date/status/ranking negatives |
| node --import tsx --test --test-concurrency=1 tests/integration/payment-performance.test.ts tests/integration/document-analytics.test.ts tests/integration/aging.test.ts | Exit 0; 3/3, no skips | Actual migrated PostgreSQL with report/MCP/helper regressions |
| pnpm test | Exit 0; 333/333, no skips | Unit suite; no new pure rounding helper |
| pnpm typecheck | Exit 0, including final post-fixture-edit run | MDX and tsc; no full build |
| pnpm exec eslint on all six changed TS files | Exit 0; no warnings/errors, including final run | Task-owned files |
| pnpm lint | Exit 0; 0 errors, 119 warnings in unchanged files | Existing warnings retained; removed unused Clock in touched page |
| python .agentic/scripts/money_inventory.py --write and without --write | Exit 0; 415 columns, 1800 scanned files, 1358 consumers, 25875 occurrences | Lexical inventory, not dataflow proof |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0; Drizzle/source hashes/lines verified | No storage migration |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0; 9 regression checks | Legacy usage gate |
| git diff --check | Exit 0 | Git line-ending notices only |

The initial fixture attempted missing-session authentication outside a Next request
scope, receiving the framework headers-context error; removed that unsupported
in-process session assertion. Actual invalid API-key authentication is verified;
live browser/session authentication is not claimed. Self-review added SQL date
guards and saved infinite/year-10000 cases, source cancellation, status exclusions,
negative terms, permitted custom reads and raw-mean/tie ordering coverage. Final
focused fixture, typecheck and changed-file lint pass after these additions.

## Review and handoff

See MON-113-review-1.md for honest self-review. No outstanding bounded-task blocker.
No full build, dev server, Docker, deployment, schema/history correction or IRR
enablement. Browser interactions reviewed in source only. Independent accounting,
session/browser, performance, full-int64 and production qualification remain open.
MON-102/MON-029 retain combined acceptance. Commit/push this task only, verify
origin/master synchronization and clean tree, then stop without starting another.
