# MON-119 attempt 1 - exact dashboard widget and action alerts

## Identity

2026-10-07, Asia/Tehran. Operator: coding-assistant. Entry master HEAD
9d71596 (working tree clean). Technical self-review only; no peer/human/accounting
approval, production qualification or deployment is claimed.

## Implementation and bounded scope

The live controller selected MON-105. Read applicable instructions, START_HERE,
controller/project/repository map, backend role, selected task, MON-011 evidence,
ADR-006, money manifest and actual dashboard/report/schedule/budget implementations.
Verified separate dashboard data, opaque layout CRUD, custom/saved reports,
scheduled delivery and budget notification workflows. Split into MON-119..123 per
the controller; MON-105 retains all original criteria and child dependencies.
MON-122 depends on MON-121 for saved report execution/export. Only MON-119 is
implemented; the controller code is unchanged.

- lib/api/dashboard-data.ts and dashboard-wire.ts are shared scoped services for
  two REST route files/six MCP operations. Every operation requires view:data,
  validates input and organization existence, and uses a repeatable-read read-only
  snapshot. Narrow projections avoid decoding unrelated money or exposing relations.
- SQL text preserves source integers. Bigint sums and safe source/result guards
  expose total/totalMinor and balance/balanceMinor with currency labels. Document
  fixed cents and bank currency minor units retain their distinct existing semantics.
  Mixed document totals require an explicit currency filter; bank accounts are
  never aggregated across currencies. No rescaling, FX or exact-only mode is added.
- Existing widget/status/count behavior is retained. Alerts exclude soft-deleted
  banks from uncategorized counts, select latest completed reconciliation per active
  account, and preserve the more-than-30-day threshold and enabled reminder counts.
  Due today and draft/void/paid documents are excluded from action alerts. Counts
  remain numeric, inventory quantities retain physical units, and first-ten item
  selection is deterministic by ID.
- New dashboard-data MCP tools use shared direct-DB services with wrapTool and
  described fields; all six are registered in index.ts. The final owner SDK fixture
  goes through registerAllTools, proving integration with the full tool registry.
- DASHBOARD_DATA_WIRE_CONTRACTS maps inputs, outputs, units, ranges, aliases,
  errors, currency filters and selection. Updated manifest, generated inventory,
  task index/source coverage and split-parent/child handoffs.

## Acceptance mapping

1. The registry maps five widget REST/MCP pairs and action alerts. Safe signed
   source/output range is +/-9007199254740991; no unsupported full-int64 capability
   is advertised. Currency, count, quantity, Gregorian date and UTC selection rules
   are explicit, including all-status widgets versus actionable overdue alerts.
2. Migrated disposable PostgreSQL fixtures invoke actual API-key handlers and
   MCP SDK clients. Existing invoice/bill/bank writer services accept both numeric
   and exact input aliases before reader assertions. All six operation responses
   agree; auth/custom-role/tenant isolation, empty defaults, signed values,
   IRR/JPY/KWD units, document status/date boundaries and operational selections
   are asserted. Foreign header spoofing cannot redirect API-key organization scope.
3. Invalid input, mixed/unsupported currency, source/root overflow, infinite saved
   alert dates and unsafe bank balances fail visibly. Safe signed edges and exact
   cancellation pass. Unconsumed unsafe inventory prices/bank thresholds do not
   break narrow read operations. Domain/financial/audit/notification snapshots stay
   unchanged across successful and failed calls; API-key lastUsedAt is deliberately
   outside the read-only service snapshot claim.

## Verification

All commands ran in D:/Projects/dubbl. A task-created PostgreSQL 18 cluster bound
only to 127.0.0.1:55519 with a synthetic local role and UTC server timezone.
Explicit TEST_DATABASE_URL targeted this cluster. The harness created, migrated
and dropped random dubbl_ci_ databases; the application database was not accessed.
The temporary cluster was stopped after final integration verification. Its data
directory remains outside the repository; no application data was deleted.

| Actual command/check | Result | Limit |
|---|---|---|
| node --import tsx --test tests/integration/dashboard-data.test.ts tests/integration/document-analytics.test.ts | Exit 0; 2/2, no skips | Dashboard and shared report regression |
| node --import tsx --test tests/integration/dashboard-data.test.ts | Final exit 0; 1/1, no skips | Includes full tool registration, saved infinite-date rejection and expanded tenant checks |
| node --import tsx --test --test-concurrency=2 tests/*.test.ts | Exit 0; 322/322, no skips | Full unit suite |
| pnpm typecheck | Final exit 0 after all source/fixture edits | MDX/tsc only, no Next build |
| pnpm exec eslint on two services, two routes, MCP file/index and both fixtures | Final exit 0, clean | All changed code |
| pnpm lint | Exit 0; 0 errors, 120 warnings in unrelated files | Existing warning debt remains |
| python .agentic/scripts/money_inventory.py --write, then without --write | Exit 0; 415 columns, 1336 consumer files, 26121 occurrences | Source inventory only |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0 | Drizzle/source hashes and lines match |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0; 9 checks | No new legacy money consumer |
| python .agentic/agent.py validate; git diff --check | Exit 0 | Structure/whitespace, not financial qualification |

The initial fixture used invalid reminder enum values (overdue/contact).
Replaced them with actual schema values after_due/contact_email; final runs pass
without changing product behavior or relaxing assertions. Self-review added saved
infinite-date rejection and exercised the global MCP registration entry point.

No full build, dev server, Docker, schema generation, application DB, provider/email
request, deployment or IRR configuration change ran. Controller implementation was
not changed; its full regression suite was not run. Source rows are aggregated in
memory; large-volume performance, full-int64 business paths, the remaining MON-105
children and independent accounting/migration/release qualification remain separate.

## Review and handoff

See MON-119-review-1.md for actual technical self-review. No blocker remains for
MON-119. MON-105 retains MON-120..123 and independent integration. Stop after
controller completion, committing only task-owned files, pushing origin/master
and confirming matching remote SHA and clean working tree.
