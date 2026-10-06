# MON-100 attempt 1 - exact budget comparison report contracts

## Identity

2026-10-06, Asia/Tehran. Operator: codex. Entry master HEAD
`4b0320c`; working tree clean at entry. Honest self-review only. No independent
peer/human/accounting approval or deployment is claimed.

## Implementation and bounded scope

Live controller selected MON-029. Read root/nested instructions, START_HERE,
project/repository map, controller, MON-029/011 evidence, ADR-006, money manifest,
budget CRUD/service/schema, report/MCP/route inventory and existing fixture harness.
The report/dashboard task spans independent financial statements/ledger, aging/contact,
tax, operational analytics, dashboards/saved reports and budget comparison services.
Split it into MON-100 through MON-105 without weakening its original acceptance.
MON-029 remains blocked pending those children and retains final integration.
Current controller has no queue command; attempted queue was rejected without
mutation, then retained its supported blocked/resume workflow. No controller code
was changed. MON-100 was the next ready bounded child and is the only completed task.

- `lib/api/budget-report.ts` replaces duplicated REST/MCP calculations with a
  shared direct-Drizzle read-only repeatable-read transaction. Header, organization
  context, budget lines/periods and posted actuals share a database snapshot.
- SQL SUM(bigint) casts to text, then bigint handles exact sums, natural signs,
  subtraction and projection/percent products. Safe output narrowing and Minor
  aliases cover every root, comparison and period monetary field. A grouped
  period query replaces one query per distinct date window.
- `budget-report-wire.ts` defines strict optional UUID/query validation,
  canonical UTC ranges, nearest rounding with signed ties toward positive infinity,
  amount/currency checks and aliases. Stored unsupported values/results fail 422.
- Both routes require view:data; nested account/fiscal references cannot expose
  another organization. Newest non-deleted fallback is ordered deterministically
  and includes inactive budgets as existing MCP documentation promises. Missing,
  foreign and deleted budget IDs retain null/empty/zero behavior with zero aliases.
- Numeric cents remain compatible; no magnitude/currency-driven rescaling or
  second FX conversion of already-base journal amounts. currencyCode documents the
  organization's current implicit context; budget tables have no saved currency.
- [BUDGET_REPORT_WIRE_CONTRACTS](../registries/BUDGET_REPORT_WIRE_CONTRACTS.md)
  documents the complete operation pair, input/output units, aliases, ranges,
  errors, rounding, dates, overlapping periods and compatibility limitations.
  Updated money manifest, inventory, task index/source coverage and handoffs.

## Acceptance mapping

1. Registry maps GET reports/budget-vs-actual and budget_vs_actual to one shared
   service. Safe numeric cents and all Minor aliases are within +/-9007199254740991;
   variancePct is a safe integer percent. Input is optional UUID only; no version
   header or client opt-in. UTC dates/counts retain independent units.
2. Actual API-key REST handlers and registered MCP SDK clients run on migrated
   disposable PostgreSQL. Fixtures exercise legacy/exact-created budgets, numeric
   and string readers, all five natural signs, inclusive dates, overlapping
   periods, draft/void/deleted/foreign entries, foreign root/nested references,
   custom-role denial, bad keys, malformed UUID/query, newest/inactive/deleted
   fallback, and unchanged USD/IRR/JPY/KWD fixed-cent amounts.
3. Fixtures verify SQL sums above JS precision cancel exactly, safe maximum and
   negative values round-trip, unsafe stored amounts/period amounts/dates and
   final totals/variance/percent/projections reject visibly. Budget/ledger/audit
   snapshots remain unchanged on reads and failures. Authentication may update
   API-key lastUsedAt separately. Existing real budget CRUD regression passes.

## Verification

All commands ran in D:/Projects/dubbl. A task-created PostgreSQL 18 cluster used
127.0.0.1:55500 with a synthetic local role and UTC timezone. Explicit
TEST_DATABASE_URL targets only that cluster. Harness creates/migrates/drops random
dubbl_ci_ fixture databases. Configured application DB was not accessed. Cluster
stopped after checks; temporary cluster directory retained outside the repository.

| Actual command/check | Result | Limit |
|---|---|---|
| node --import tsx --test tests/budget-report-wire.test.ts tests/integration/budget-report.test.ts tests/integration/budget-wire.test.ts | Exit 0; 6/6, no skips | Four pure groups, report integration and real CRUD regression |
| node --import tsx --test tests/budget-report-wire.test.ts tests/integration/budget-report.test.ts, final after additional boundary fixtures | Exit 0; 5/5, no skips | Maximum API/MCP outputs, negative money, percentage and variance overflow added |
| pnpm test | Exit 0; 310/310, no skips | Full pure/unit suite |
| pnpm typecheck, initial and final | Exit 0 | MDX/tsc; no full Next build |
| pnpm lint | Exit 0; 0 errors, 122 remaining existing warnings | One existing unused notFound import removed with old route |
| pnpm exec eslint on changed services/wire/tools/routes/tests; final changed worker | Exit 0; clean | No added warnings |
| python .agentic/scripts/money_inventory.py --write, then without --write | Exit 0; 415 columns, 1322 consumers, 26013 occurrences | Source inventory only |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0 | Drizzle/source hashes and lines match |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0; nine checks | No new legacy-money use |
| git diff --check | Exit 0 | Whitespace check |
| python .agentic/agent.py validate/status/next and supported task transitions | Exit 0; 155 structurally valid tasks after split | Structure is not accounting qualification |

Initial patch tooling rejected replacing a file in one delete/add patch; no
partial edits occurred. Applied additions and route replacement separately.
Self-review replaced the period date-column comparison with explicit PostgreSQL
date casts before first integration execution. All actual behavioral checks passed.

No build, dev server, Docker, screenshot, provider/email request, schema/migration
generation, application DB mutation, production rollout or IRR flag change ran.
Fixture migrations qualify these boundaries, not production financial acceptance.

## Review and handoff

See MON-100-review-1.md. No blocker remains for MON-100. MON-029 retains all
other report domains and final integration. Budget alerts/widget/saved dispatch
remain MON-105; financial statement baseline sign defects remain PAR-008/QA-001.
Currency snapshots/history, full-int64 clients, performance and financial
qualification remain separate gates. Next controller task is MON-101. Stop
after completing, committing and pushing this one bounded child.
