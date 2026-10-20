# LOC-086 attempt 1 - payroll time and leave catalogs

## Identity and scope

2026-10-21 (Asia/Tehran), Codex, D:/Projects/dubbl, master.
Entry HEAD `8a53a01c`; clean entry tree. Live controller validate/status/next
selected LOC-086; exactly that child was started. Origin fetch confirmed zero
ahead/zero behind. The user authorized completion and push. No subagents.
The memory controller-task skill guided the workflow; live repository and
controller state governed implementation and acceptance.

Read root instructions, START_HERE, project/map/frontend guidance, selected
task/parent, catalog contract and relevant locale/source sections. Inspected
the actual page, payrollJson, time service/wire, REST routes, registered MCP,
prior payroll evidence and migrated time fixture. No application DB was used.

## Acceptance mapping

1. Extracted authored copy in the owned page into 75 paired flat
   `PayrollTimeLeave` messages. Validation reports 7,594 compatible keys per
   locale. Every Persian leaf contains Persian script. See
   [scope and exceptions](../registries/PAYROLL_TIME_LEAVE_CATALOGS.md) for
   saved data, canonical dates, physical hours, shared loading and adjacent
   shifts/policies/detail/self-service ownership. All saved statuses have
   finite labels. Unknown protocol/server/parser/network prose stays internal.
2. Production JSX renders with real next-intl/PresentationProvider in both
   locales. Callback tests exercise checked initial reads, cleanup, pagination,
   choices, missing org/storage, filters/sort/search/navigation, creation and
   approval/rejection, including malformed/failed requests and form retention.
   Creation requires checked HTTP/envelopes before closing/resetting/navigating;
   failed mutations keep state and release busy. Approved/rejected responses
   must match the selected ID/status. Successful leave mutations remain
   successful when a checked follow-up read fails. That read receives separate
   finite translated feedback. Real REST/linked MCP responses also pass this
   reader under the migrated time fixture and its independent SQL assertions.
3. Task handoff, catalog index, scope registry and honest self-review record
   provisional Persian and independent LOC-067/008/002/native/RTL acceptance.

No financial computation, stored date/hour/money, authorization, statutory
identifier, API/MCP definition, schema/migration, IRR flag, provider or Stripe
change. Routes, headers, payloads, navigation, numeric physical hours and
canonical Gregorian dates retain their existing contracts. MCP already covers
all owned operations. Generated money inventory changes task-owned source
references/hashes and paths; stored column classifications remain unchanged.

## Actual verification

All commands ran from D:/Projects/dubbl.

| Check | Observed result | Boundary |
|---|---|---|
| Final focused rendering/callback and payroll money tests | 12/12 pass, zero skips; 4.392 seconds | Controlled hooks/IO and portal boundaries |
| Catalog validation | Exit 0; 7,594 keys in each locale | No native linguistic approval |
| Final owned-file ESLint | Exit 0; zero errors/warnings | Page, reader, focused/source-guard tests and worker |
| Full lint | Exit 0; zero errors, 51 existing warnings | No new owned-file warnings |
| Final typecheck | Exit 0 | fumadocs-mdx and tsc --noEmit |
| Migrated payroll time fixture | 1/1 pass, zero skips; 13.636 seconds | Real REST, linked MCP, independent SQL on isolated PostgreSQL 18 |
| Full unit/static suite | 1,206/1,206 pass, zero skips; 235.652 seconds | Concurrency 2; final focused suite also covers final search/sort assertions |
| Money inventory/source and legacy guards | Exit 0; 417 columns, 2,392 scanned paths, 1,783 consumer hashes; nine legacy checks | Final source inventory only |
| Controller validation and diff check | Pass during implementation | Repeat after evidence completion |

```text
node --import tsx --test tests/payroll-time-catalogs.test.ts tests/payroll-ui-money.test.ts
node --import tsx --test --test-concurrency=2 tests/*.test.ts
node --import tsx --test --test-concurrency=1 tests/integration/payroll-time.test.ts
pnpm typecheck
pnpm i18n:check
node node_modules/eslint/bin/eslint.js "app/(dashboard)/payroll/time-leave/page.tsx" i18n/payroll-time-presentation.ts tests/payroll-time-catalogs.test.ts tests/payroll-ui-money.test.ts tests/integration/payroll-time-worker.ts
pnpm lint
python .agentic/scripts/money_inventory.py --write
python .agentic/scripts/money_inventory.py
node --import tsx .agentic/scripts/verify_money_inventory.mjs
node .agentic/scripts/verify_legacy_money.mjs
python .agentic/agent.py validate
git diff --check
```

The focused suite covers both views and all eight saved statuses, authored JSX
and visible-attribute extraction, Persian script, empty/search/busy/loading,
escaped caller data, plural counts, unchanged choices, canonical dates and
fractional hours. It checks initial read/choice adoption, stale initial results,
HTTP/JSON/envelope/date/hour/enum/pagination/money-alias rejection, missing
organization/storage, navigation/search/sort/filter callbacks, successful and
failed pagination, creation payloads/navigation/refresh/form retention, confirmed
and cancelled rejection, approval payloads, matching IDs/status and finite
mutation/refresh failure feedback.

The migrated worker checks actual successful REST and linked registered MCP
timesheet/leave lists, policy choices, creation and approval/rejection through
the reader, including a populated leave list. Existing independent SQL,
permissions/isolation, binary32 quantities, nested exact money, migration
preservation, transaction rollback and audit assertions remain intact.

An OS-temp PostgreSQL 18 cluster listened only on 127.0.0.1:6454 with trust
authentication and max_locks_per_transaction=256. Process-scoped
TEST_DATABASE_URL/PG_BIN targeted it. The fixture created/dropped a randomized
database. The final admin query found zero remaining dubbl_ci_* databases;
pg_ctl stopped the isolated server successfully. No application DB or its
environment credentials were used.

The first callback tests exposed a circular React element in the test topbar
event log. The harness now treats the external topbar boundary as a no-op;
production callbacks remain captured directly. Final focused checks pass.
No product failure was suppressed. One intermediate shell-only audit had
PowerShell quote stripping; it was rerun successfully through literal stdin.

## Review and handoff

See [Codex self-review](LOC-086-review-1.md). This is self-review, not independent
peer/human/native/accounting approval. Persian is provisional. LOC-067/008/002,
mounted browser/keyboard, full RTL/numerals/calendar, hosted CI, deployment and
production qualification remain independent. No full build, unrequested dev
server, Docker, external provider request, deployment or Stripe work ran.
Controller closure and task-owned commit/push follow completed checks; remote
synchronization is reported only after verification.
