# MON-122 attempt 1 - exact report schedules and delivery

## Identity and scope

2026-10-08, Asia/Tehran. Operator: codex. Entry master HEAD
`9172397edab64198b2ddf6c29018b0f3c0bcb216`, clean working tree. Controller
validate/status/next selected MON-122; start assigned codex. Read root/nested
AGENTS, START_HERE, controller, project/repository map, backend role, ADR-006,
MON-011/MON-121 evidence, manifest and actual schedule/report/SMTP/Trigger/UI
sources. One bounded child of MON-105. Changes are uncommitted when this
evidence is written. Self-review only.

## Implementation

- Added shared schedule schemas/services, transactional saved-report readers,
  actual attachment generation, three REST handlers (including a new manual
  trigger route) and six described registered MCP tools. Existing tool names
  and success envelopes remain; metadata responses add validated savedReport.
- Replaced header-only placeholder mail with scoped real custom-report execution
  in all formats. CSV matches saved export; PDF includes literal field/value
  data; XLSX money/Minor cells are text to preserve safe 16-digit integers.
  Nulls, filters, inclusive dates, empty output, selected columns and Minor-only
  projections use the existing six-source runner. No implicit FX or rescaling.
- Create/update/delete render data before scheduling mutations; returned-row
  validation runs before transaction commit. Existing schedules lock for writes.
  Read-only snapshots validate saved metadata/config/reference ownership. CRUD
  retains audit entries and REST request metadata. Unsupported historical configs,
  currencies, dates, source money and SQL-infinite timestamps fail without repair.
- REST/MCP now consistently enforce view:data and manage:reports for mutations
  and manual sending; payroll execution requires view:payroll-reports. Trusted
  background automation remains owner-equivalent within each schedule's org.
  SMTP and saved-report lookups are independently scoped to that organization.
- Timing uses configured local weekday/month-day/HH:MM/IANA zone. Quarterly uses
  Jan/Apr/Jul/Oct; missing weekly/month days default to Monday/1. DST gaps skip;
  overlaps use the earlier instant once. Omitted PATCH defaults remain omitted.
- Delivery preflights all data/attachments/next occurrence before SMTP and run
  metadata; a row lock spans sending and success update. Concurrent due workers
  recheck due state after locking. Failed preflight/provider calls do not advance
  run state; background counts/logs errors. HTML report names are escaped and
  attachment filenames sanitized. Existing hourly Trigger consumer needs no
  duplicated logic or deployment change.
- Added contract registry/manifest and regenerated machine money inventory.

## Acceptance mapping

1. REPORT_SCHEDULE_WIRE_CONTRACTS.md maps all REST/MCP operations and the actual
   Trigger consumer, schemas, success/error envelopes, units/aliases/ranges,
   scheduling semantics and external delivery limits. Every MCP field describes
   its meaning; money retains numeric cents/Minor strings within the safe range.
2. Migrated PostgreSQL fixture invokes actual REST handlers/API-key auth and MCP
   SDK linked transports/full registration, all six operations, both legacy and
   exact invoice writer clients, formats and recorded SMTP. Tenant spoofing,
   foreign/deleted references, permissions/payroll and pagination are asserted.
3. Pure/DB fixtures cover malformed/unknown/empty controls, omitted defaults,
   signed safe endpoints/zero, both unsafe signs and stored int64 max, filtered
   empty CSV headers, XLSX text precision, PDF compressed content extraction,
   corrupt persisted configs/recipients/times/SQL infinity, missing SMTP and
   provider errors. Failed-operation snapshots retain schedule/config/financial/
   audit state and recorded mail count. Concurrent due calls send one occurrence.

## Verification

All commands ran in D:/Projects/dubbl. A temporary PostgreSQL 18 trust cluster
used task_mon122 on 127.0.0.1:55522, UTC. Explicit TEST_DATABASE_URL selected
that server; fixtures created/migrated/dropped random dubbl_ci_ databases. The
application DATABASE_URL was not read or used. Nodemailer transport was replaced
with an in-process recorder; no actual email or provider request occurred.
The temporary cluster was stopped successfully; data remains outside the repo.

| Actual command/procedure | Result | Scope |
|---|---|---|
| node --import tsx --test --test-concurrency=1 tests/report-schedule-wire.test.ts tests/integration/report-schedules.test.ts | Final exit 0, 3/3 | Final timezone/DST code and expanded failure/content assertions |
| Same command plus tests/integration/custom-reports.test.ts, dashboard-data.test.ts, dashboard-layouts.test.ts | Exit 0, 6/6 | Task plus custom/shared-runner and dashboard regressions |
| node --import tsx --test --test-concurrency=2 tests/*.test.ts | Exit 0, 350/350, no skips | Complete units; later timezone/DST edits covered by final focused run |
| pnpm typecheck | Final exit 0 | MDX plus tsc, no Next build |
| pnpm exec eslint on all changed/new modules, routes and fixtures | Final exit 0, no warnings | Final source/tests |
| pnpm lint | Exit 0, zero errors/111 existing warnings | Warnings outside changed files; final small changes pass changed-file lint |
| python .agentic/scripts/money_inventory.py --write | Exit 0 | 415 columns, 1844 scanned files, 1381 consumers, 26084 occurrences |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0 | All columns, hashes and occurrence lines verified |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0, 9 checks | Money lint regression |
| python .agentic/agent.py validate | Exit 0, valid 173 tasks | Controller structure |
| git diff --check | Exit 0 | No whitespace defects, LF/CRLF notices only |
| pg_ctl stop for task cluster | Exit 0, stopped | Fixture resource cleanup |

Initial typecheck identified TypeScript assertion-flow inference on two fixture
mail-count constants; explicit numeric annotations fixed it. Self-review found
that schema defaults must not populate omitted PATCH fields; removeDefault plus
behavioral assertions prevents that. Review also changed repeated DST-hour
handling to one earlier occurrence, covered by the final timing fixture.

No full build, dev server, full integration suite, screenshots, PDF visual-fit or
localization qualification, schema generation, application migration, deployment
or IRR enablement was performed. SMTP lacks a persistent outbox/idempotency;
partial acceptance/crashes can repeat email on retry and cannot roll back with
DB writes. Existing hourly cadence can send after the configured minute. Large
report rendering/locks held through SMTP are not performance-qualified. Exact
clients still share the safe numeric storage bridge. These limits are explicit
in the boundary registry, not claims of production/exactly-once qualification.

## Review and handoff

Self-review: MON-122-review-1.md. No remaining blocker in this bounded slice.
MON-105 retains independent combined integration acceptance; MON-123 owns budget
alert writes. Controller checks/submit/review/done and task-owned commit/push
follow this evidence, then verify origin/master SHA and clean tree and stop.
