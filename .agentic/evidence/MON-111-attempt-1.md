# MON-111 attempt 1 - exact aged receivable/payable reports

## Identity

2026-10-07, Asia/Tehran. Operator: codex. Entry master HEAD b116069;
working tree clean at entry. Honest technical self-review only; no independent
peer/human/accounting review, deployment or production qualification is claimed.

## Implementation and bounded scope

Live controller selected MON-102. Read root/nested instructions, controller,
START_HERE, project/repository map, MON-011 evidence, ADR-006, money manifest,
MON-102 and actual aging/contact/PDF/email/performance/MCP sources. Verified three
independent domains and split MON-102 into MON-111 aging/exports, MON-112 contact
statements/activity/delivery and MON-113 payment-performance. Parent retains every
original acceptance criterion and all child dependencies. Current controller
supports block/resume, without queue; no controller code changed. Started only
MON-111 as the bounded continuation of the selected task.

- aging.ts replaces duplicated REST/MCP/aging-export calculations with one
  direct-Drizzle read-only repeatable-read service and narrow scoped projections.
  Bigint handles historical allocation sums, balances, bucket and root totals.
- aging-wire.ts validates strict real Gregorian dates, optional single-currency
  selection, supported format/query shape and saved dates/currencies. Safe numeric
  fixed cents coexist with amountDueMinor, totalMinor and grandTotalMinor strings.
- Both REST routes and registered MCP aging tools use the same service. Existing
  multi-statement MCP export ages use the same statement and accept asAt/currencyCode;
  other statement branches retain their independently owned behavior.
- Explicit asAt reconstructs balances, including currently paid documents, from
  scoped non-deleted allocations through cutoff; omitted asAt preserves stored
  current amountDue and non-paid selection. Draft/void/deleted exclusion, carriers,
  current zero/negative/future issue behavior and export currency scales remain.
- Document and allocation currency/contact/type agreement avoids silent mixed
  totals or foreign payment reduction. Scoped contact names cannot expose another
  tenant; unsupported history/results reject visibly. No repeated FX conversion.
- JSON/PDF/XLSX share checked totals; existing renderer guards spreadsheet
  precision and text/formula interpretation. Exact PDF integers remain supported.
- AGING_REPORT_WIRE_CONTRACTS documents every boundary, alias/range, mode,
  input/error, currency/export unit and historical limitation. Updated manifest,
  inventory, task index/source coverage and controller handoffs.

## Acceptance mapping

1. The registry maps two REST JSON/binary routes, two MCP readers and both aged
   branches of export_financial_statement. Numeric fixed cents and matching Minor
   strings use +/-9007199254740991; date/count units stay explicit. Historical
   status/writeoff reconstruction, full-int64 and accounting gates stay separate.
2. Migrated disposable PostgreSQL fixtures invoke actual API-key REST handlers,
   registered MCP SDK clients, both existing legacy/exact document writers and
   real PDF/XLSX renderers. They verify permissions, key failures, org/contact/payment
   isolation, live/history selection and dates, carrier/future/deleted payments,
   currency filter/scales, numeric/exact fields and parity of exported sheet values.
3. Malformed inputs and inconsistent saved allocations reject; unsafe stored inputs,
   bucket/root results and lossy XLSX values return LEGACY_NUMERIC_RANGE. Bigint
   intermediate cancellation, safe signed edges and separate-bucket root overflow
   are asserted. Financial/audit snapshots remain unchanged on reads, exports and
   failures, separately from API-key authentication lastUsedAt updates.

## Verification

All commands ran in D:/Projects/dubbl. A task-created PostgreSQL 18 cluster listened
only on 127.0.0.1:55511 with a synthetic local role and UTC timezone. Explicit
TEST_DATABASE_URL targets that cluster. Harness creates/migrates/drops random
dubbl_ci_ fixture databases; configured application database was not accessed.
Cluster stopped after integration checks; temporary cluster remains outside repo.

| Actual command/check | Result | Limitation |
|---|---|---|
| node --import tsx --test tests/aging-wire.test.ts tests/integration/aging.test.ts | Exit 0; 4/4, no skips | Initial successful focused run |
| node --import tsx --test tests/aging-wire.test.ts tests/integration/aging.test.ts tests/integration/cumulative-statement.test.ts tests/integration/budget-report.test.ts | Exit 0; 6/6, no skips | Final extra signed/stored/root limits and existing shared-report regressions |
| node --import tsx --test --test-concurrency=2 tests/*.test.ts | Exit 0; 317/317, no skips | Full pure/unit suite, reduced concurrency after startup timeout |
| pnpm typecheck | Exit 0, final | MDX/tsc only, no full Next build |
| pnpm exec eslint on both routes, aging service/wire/route helper, reports MCP and all three fixtures | Exit 0, final; clean | No added warnings |
| pnpm lint | Exit 0; zero errors, 122 existing warnings | Repository-wide lint; unchanged file warnings retained |
| python .agentic/scripts/money_inventory.py --write, then without --write | Exit 0; 415 columns, 1332 consumer files, 26027 occurrences | Source inventory only |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0 | Final Drizzle exports/hashes/source lines match |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0; nine regression checks | No new legacy-money use |
| python .agentic/agent.py validate and git diff --check | Exit 0 | Structure/whitespace only |

Earlier fixture runs found empty-query undefined keys, incorrect document-writer
envelope access, SDK validation errors returned as text, XLSX row-value union types
and a non-API-key credential exercising session auth outside Next's request scope.
Corrected query shape and fixtures; final behavioral run passes. Initial default
pnpm test passed 316/317 but existing currency-rollout startup subprocess hit its
15-second timeout under broad concurrent verification; lower-concurrency retry
does not relax assertions/timeouts. An early inventory verifier ran before refresh,
and later export-description editing invalidated its prior snapshot; final sequential
refresh/drift/Drizzle verification passes. No behavior failures remain in focused tests.

No build, dev server, Docker, schema/migration generation, application DB access,
email/provider request, deployment or production IRR flag change ran. Migration
fixture execution qualifies this boundary only. Native language/PDF layout,
high-volume performance, full-range and independent accounting remain separate.

## Review and handoff

See MON-111-review-1.md for honest self-review. MON-102 remains blocked on MON-112,
MON-113 and independent integration acceptance; MON-029 retains combined reports.
Next controller task after this child is MON-103. Stop after this one task is
completed, committed and pushed. All required checks pass. No blocker remains
for MON-111; controller self-review approval records technical acceptance only.
