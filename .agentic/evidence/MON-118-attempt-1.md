# MON-118 attempt 1 - recurring, calendar and duplicate reports

## Identity

2026-10-08, Asia/Tehran. Operator codex, self-review only. Repository
D:/Projects/dubbl, master, entry HEAD 1cacf208bb970bd220da4183ab5be2e3e76a2251.
Clean working tree at entry; changes in this evidence were uncommitted when
written. No independent human/accounting or production approval is claimed.

## Implementation

Inspected root/nested instructions, controller START_HERE/reference/project/map,
backend role, MON-118, MON-011 dependency evidence, ADR-006, money manifest and
actual routes/MCP registration, schemas, report primitives, previous bank/forecast
services and fixtures. Used the memory Dubbl controller-task skill for the one-task
workflow. Controller selected and started MON-118; no other task was started.

- `lib/reports/operational.ts` and `operational-wire.ts` implement three shared
  view:data, organization-scoped, repeatable-read read-only services. SQL text
  projections and bigint calculations avoid ORM/aggregate precision loss.
  Existing numeric integer money gets explicit canonical Minor strings and
  currency codes; sources/final outputs retain +/-9007199254740991 support.
- All three REST routes use shared JSON/error adapters. New registered
  operational-reports MCP tools directly use the same services and wrapTool.
  Each tool operation and input field describes its expectations and outputs.
- Recurring reports now verify explicit account ownership before querying bank
  movements, fixing the previous foreign-account leak. Descriptions group by
  currency; excluded/deleted-bank carriers are omitted and mismatched saved
  movement currencies fail. Bigint averages retain positive-infinity signed ties,
  frequency/direction heuristics, top-50 and last-five limits.
- Calendar uses independently scoped live contact labels, exact quantity/price
  products and subtotal sums, complete bounded recurring schedules, occurrence
  caps/end dates and the existing UTC month-overflow behavior. Due documents and
  budgets retain individual currency tags; optional filtering performs no FX.
- Duplicate reports require live owned contacts and equal currency/total, retaining
  the existing whole-group <=7-day-span heuristic. Ordered JSON aggregation keeps
  item metadata aligned without separate array projections.
- Calendar and duplicate pages show server/network errors and format safe integer
  money with exact currency-aware rendering. Calendar month queries no longer
  shift local-midnight dates through UTC.
- OPERATIONAL_REPORT_WIRE_CONTRACTS maps the inputs/outputs, units, aliases, range,
  auth/errors, heuristics and limits. MONEY_MANIFEST and generated inventory updated.

No schema, Drizzle migration, saved-history rescaling, FX policy or IRR flag change.
Calendar estimate still precedes taxes/discounts and does not include journal-template
debit/credit legs; journal templates normally show zero. Duplicate detection remains
a whole-group heuristic, not rolling pairs. Full-int64 transport, combined parent
acceptance, independent financial accounting/performance and production qualification
remain separate.

## Acceptance mapping

1. OPERATIONAL_REPORT_WIRE_CONTRACTS documents all three actual REST/MCP pairs.
   Strict input schemas, MCP descriptions and shared outputs explicitly define
   units/ranges/aliases, no negotiation or magnitude-driven fallback. Existing
   integer values are never rescaled for USD/IRR/JPY/KWD. No server-side report
   export existed in this slice; the two existing pages were updated.
2. Actual GET handlers authenticate synthetic API keys; MCP SDK linked transports
   call all three registered tools against a migrated disposable PostgreSQL DB.
   Fixtures use actual legacy-major and exact-Minor document write services and
   recursively assert every returned numeric/Minor pair. They cover denied reads,
   authentication, foreign/deleted/missing banks, independently scoped contacts,
   API-key organization versus supplied header, foreign-org reads and currencies.
3. Unit and operation fixtures cover strict malformed/duplicate inputs, Gregorian
   dates/default overflow, signed safe boundaries and .5 ties, aggregate averages
   beyond numeric precision, large exact line products, source/line/subtotal
   overflow, currency mismatch, top-50/last-five, month overflow, 13 weekly dates,
   end/generated/max occurrence and backlog bounds. Successful reads and expected
   422 errors preserve snapshots of documents, lines, banking, templates, budgets,
   GL and audits. API-key last-used bookkeeping is excluded from these snapshots.

## Verification

All commands ran in D:/Projects/dubbl. A task-created PostgreSQL 18 cluster used
synthetic local trust role task_mon118 and listened on 127.0.0.1:55518, UTC.
Explicit TEST_DATABASE_URL targeted the cluster; fixtures created, migrated and
dropped randomly named dubbl_ci_ databases. Application DATABASE_URL was not read
or used. Worker TZ Asia/Tehran checks UTC behavior outside server timezone. Cluster
was stopped successfully after fixture verification; temporary data is outside repo.

| Actual command/check | Result | Limits |
|---|---|---|
| node --import tsx --test --test-concurrency=1 tests/operational-wire.test.ts tests/integration/operational-reports.test.ts tests/integration/forecast-fx.test.ts tests/integration/bank-analytics.test.ts | Exit 0, 5/5, no skips | Operation and adjacent regression fixtures |
| node --import tsx --test --test-concurrency=2 tests/*.test.ts | Exit 0, 343/343, no skips | Complete unit suite |
| pnpm typecheck | Final exit 0 | MDX/tsc, no build |
| pnpm exec eslint over the 12 task TS/TSX files | Exit 0, clean | After final test-helper annotation fix |
| pnpm lint | Exit 0, 0 errors, 113 warnings outside task files | Existing repository warnings |
| python .agentic/scripts/money_inventory.py --write, then without --write | Exit 0 | 415 columns, 1825 files, 1371 consumers, 25970 occurrences |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0 | Drizzle/source/hash/occurrence checks |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0 | 9 gate regressions |
| python .agentic/agent.py validate | Exit 0, 173 structurally valid tasks | Not financial qualification |
| git diff --check | Exit 0 | Line-ending notices only |

Initial fixture imports used singular writer filenames; corrected to existing plural
service modules. Typecheck then required an explicit unknown annotation in the
recursive alias assertion helper; final typecheck and changed-file lint passed.
The operation/adjacent and unit runs above preceded that annotation-only fix, which
does not change runtime behavior. No build, dev server, Docker, browser screenshots,
provider request, deployment or broad integration qualification was run.

## Review and handoff

See MON-118-review-1 for actual self-review. No remaining MON-118 blocker.
Controller completion, scoped commit and authorized origin/master push follow this
evidence. MON-104/MON-029 retain their combined acceptance. Next is MON-120.
