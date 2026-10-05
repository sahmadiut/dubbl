# MON-079 attempt 1 - exact payroll employee and contractor masters

## Identity and scope

2026-10-05, Asia/Tehran. Operator: coding-assistant. Entry HEAD 8ed033f,
master tracking origin/master, clean working tree. User requested completion and
push of the next task. Controller validate/status/context selected MON-025;
verified 71 payroll route files, monolithic MCP and independent calculation/
workflow/output services. Claimed MON-025, split into MON-079 through MON-085 per
controller instructions, retained original parent acceptance, and claimed MON-079.
Children have priority 0 to retain the payroll sequence; no silent parent closure.
This evidence precedes the final commit, and records implementing-assistant
self-review, not independent human/peer financial/security approval.

## Implementation

- Added lib/api/payroll-master-wire.ts with strict described create/update/list
  contracts, named annual salary/per-hour cents aliases, matching/null/omission
  semantics, explicit Gregorian dates, currency and basis-point tax validation.
  Exact strings bridge through bigint plus checked legacy conversion; safe
  Number range only, with no unit/currency rescaling or full-int64 claim.
- Added lib/api/payroll-master.ts and replaced four REST route files with thin
  authenticated adapters. Ten operation services share org/permission checks,
  scoped live-record predicates, stable pagination and SQL text counts checked
  through bigint. Lists/counts/joins share repeatable-read snapshots.
- Scoped member assignment and joins independently. Employee GET/list previously
  returned users.passwordHash with full linked user records; responses now return
  only id/name/email/image. Corrupt foreign member links have null member details;
  writes require owned link or explicit clearing. No credential-bearing profile
  response or cross-tenant joined user data is retained.
- Master create/update/delete uses one transaction for row mutation, saved/output
  preflight and audit. Updates/deletes lock live scoped rows and reapply predicates.
  Contractor updates can no longer modify deleted records. Unsupported saved
  money/tax/currency cannot be masked by unrelated edits. Soft-delete retains
  history. Concurrent adopted REST/MCP deletion yields one success/one 404 and one
  audit. Metadata operations do not post GL or apply financial period locks.
- Employee currency editing, previously ignored despite being sent by the UI,
  now rejects existing pay-item history; contractor currency editing rejects any
  payment history. No historical record changes or automatic FX conversion.
  Unadopted run/payment writers and cross-writer concurrency remain MON-082/083
  and parent MON-025, explicitly documented rather than claimed qualified here.
- Added lib/mcp/tools/payroll-master.ts and registered it once in tools/index.ts.
  Moved two existing employee list/create tools out of payroll.ts, preserving
  names/envelopes and adding exact aliases. Eight missing employee/contractor
  operation tools complete root CRUD coverage. SDK input schemas remain strict
  with every field described; handlers use wrapTool and direct Drizzle services.
- Added lib/money/payroll-input.ts; root employee/contractor editor writes use
  exact two-decimal parsing rather than floating-point rounding. Hydration
  round-trips maximum safe cents and zero hourly rates. Fixed contractor drawer
  sending ignored defaultRate, now hourlyRateMinor. Employee period preview uses
  bigint half-up rounding; list formatting uses existing exact scale-aware
  display. Existing cents editor/ISO display convention retained; broader
  payroll presentation and actual posting math remain parent/locale tasks.
- Added registry PAYROLL_MASTER_WIRE_CONTRACTS.md, product/MCP docs, manifest,
  test matrix, task/source coverage and refreshed conservative source inventory.
  No schema modification or Drizzle migration is required by this change.

## Acceptance mapping

1. PAYROLL_MASTER_WIRE_CONTRACTS.md identifies all ten operation pairs, actual
   REST/MCP envelopes, annual/per-hour cents and aliases, null/omission rules,
   tax basis points, independent physical hours, dates/currencies, safe ranges,
   classification, auth and pagination. Contractor nested payment reads retain
   signed cents with amountMinor; writers/output aggregates remain other tasks.
2. tests/integration/payroll-master-worker.ts invokes every actual REST/MCP root
   pair on migrated PostgreSQL with numeric/exact/dual/nullable clients, two orgs,
   custom permission roles, invalid/expired keys, attempted header override,
   foreign root/member IDs, full registry uniqueness and field descriptions.
   Lists are empty for the foreign tenant; credential-free scoped member profiles
   and corrupt-link handling are directly asserted.
3. Database snapshots cover invalid schemas/aliases/ranges/dates/currency/roles,
   deleted/foreign IDs, unsafe stored bigint/tax and nested payment outputs.
   Six synthetic audit failure operations roll back rows and audit; insert DTO
   failure rolls back for REST and MCP. Adopted competing deletion has one audit;
   retained item/payment money remains unchanged and no journal is created.
   Pure groups verify exact max-safe editor round-trip and integer preview math.

## Actual verification

Commands ran at D:/Projects/dubbl, installed dependencies and generated sources.
Final integrations used a newly initialized PostgreSQL 18 trust cluster on
127.0.0.1:55479 with max_locks_per_transaction=1024 and synthetic fixtures. No
existing app DB schema/data reset or migration occurred; final cluster contained
zero dubbl_ci databases and was stopped successfully.

| Command/procedure | Actual result | Limit |
|---|---|---|
| Controller validate/status/context/start/split/start MON-079 | Exit 0, valid 135-task graph after split | Orchestration only |
| node --import tsx --test tests/payroll-master-wire.test.ts | Exit 0, 6/6 | Pure contracts/editors |
| Corrected payroll PostgreSQL fixture | Exit 0, 1/1 | Ten actual REST/MCP pairs |
| Final three-file PostgreSQL run, --test-concurrency=2: payroll-master, inventory-catalog, inventory-assembly | Exit 0, 3/3 | Payroll fixture plus shared registration regressions |
| npm test | Exit 0, 236/236 | Full pure suite |
| Final pnpm typecheck | Exit 0; MDX generation and tsc --noEmit | No build/dev |
| npm run lint | Exit 0, 0 errors/143 existing warnings | Full lint |
| Final npx eslint for all changed service/schema/tool/routes/tests and payroll-input | Exit 0, no output | Subsequent final assertions are TS/typechecked; existing UI warnings unchanged |
| money_inventory.py --write, then without --write | Exit 0; 412 columns, 1271 consumer files | Lexical inventory |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0; source/Drizzle hashes verified | Conservative source coverage |
| node .agentic/scripts/verify_legacy_money.mjs | Exit 0; 9 checks | No new deprecated money use |
| git fetch origin; git rev-list --left-right --count HEAD...origin/master | Exit 0, 0/0 before commit | No upstream change/deployment |
| pg_database fixture count; pg_ctl stop | Zero fixture databases; exit 0 stop | New cluster only |
| git diff --check; controller validate | Exit 0 | LF/CRLF notices only |

Development repairs: first typecheck caught the generic nullable money alias
assignment; explicit salary/hourly assignments fixed it and final typechecks pass.
A re-run of a temporary transformation script found its already-removed MCP
block; corrected the script, applied UI edits and removed the temporary scripts.
PowerShell quoting caused one local eval launcher syntax failure. A subsequent
test setup attempt via the configured authorized test DB role failed CREATEDB
permission before any fixture/migration/data changes. Did not broaden role
permissions; used the fresh separate cluster as the CI runbook prescribes. Initial
PostgreSQL fixture expected a numeric status on wrapTool's existing Zod validation
result; that wrapper returns isError/details without status. Corrected the fixture
expectation, retaining the rejected-input/snapshot assertions. No failed
financial/data assertion was waived.

No full build, dev server, Docker, browser screenshot/session/OAuth fixture,
production migration/restore, live provider, statutory tax-rule change, IRR flag
enablement, deployment or independent financial/security qualification occurred.
Full-range workflows and remaining payroll surfaces retain assigned tasks.

## Review and handoff

See MON-079-review-1.md for actual implementing-assistant self-review. No blocker
remains for this bounded child. Complete controller checks/submit/review/done,
validate/status, commit and push as authorized, verify clean synchronized master
and stop. Next MON-080 settings/deduction/tax configuration. Parent MON-025 retains
combined acceptance and MON-082/083 own shared-writer locking/FX/posting work.
