# LOC-087 attempt 1 - payroll leave and timesheet list/detail catalogs

## Identity and scope

2026-10-21 (Asia/Tehran), Codex, D:/Projects/dubbl, master.
Entry HEAD `6089a3b6f61cfca2dd70ff444c70e0241a3ca087`; clean entry tree.
Live controller validate/status/next selected LOC-087; exactly this child was
started. Origin fetch confirmed zero ahead/zero behind. The user authorized
completion and push. No subagents. The memory controller-task skill guided the
workflow; current controller and actual repository source governed acceptance.

Read root instructions, START_HERE, project/map/frontend guidance, selected
task/parent, catalog contract and relevant locale/source sections. Inspected
all four owned routes, payrollJson, time service/wire, REST and registered MCP,
prior payroll evidence and migrated time fixture. No application DB was used.

## Acceptance mapping

1. Extracted all authored copy in the four owned leave/timesheet list/detail
   routes into 95 paired `PayrollTimeDetail` messages. Catalog validation
   reports 7,689 compatible keys per locale. Every new Persian leaf contains
   Persian script. Saved data, date/hour/count formatting, shared loading and
   adjacent overview/self-service ownership are explicit in the
   [scope registry](../registries/PAYROLL_TIME_DETAIL_CATALOGS.md).
   All four timesheet/four leave statuses and five shift labels are finite.
   Raw server/parser/network diagnostics remain internal.
2. Real next-intl/PresentationProvider renders the production JSX in both
   locales. Callback assertions exercise initial reads, cleanup, explicit 404,
   missing organization/storage, filtering/search/navigation, creation, entry
   add/delete, submission, approval/rejection, confirmations/cancellation,
   failed form retention, busy release and separate refresh failures. Reader
   checks cover HTTP/JSON/envelopes, dates, hours, statuses, shift types, unique
   in-period entries, approval timestamps, nested exact money and matching
   selected IDs. Existing overview tests continue to pass with the extended
   shared reader. Actual REST and linked MCP successful detail/entry/lifecycle
   responses pass the same reader under the migrated fixture and independent
   SQL assertions.
3. Task handoff, catalog index, scope registry and honest Codex self-review
   record provisional Persian and independent parent/native/RTL acceptance.

Existing requests, methods, headers, payloads, navigation, canonical dates,
physical hours, fixed-two payroll cents, monetary aliases, stored values,
authorization, calculations and statutory identifiers are preserved. No
REST/MCP operation, schema/migration, provider, IRR flag or Stripe change.
Existing registered MCP tools already cover the owned operations. The generated
money inventory updates only task-owned source paths/hashes/references; all
stored column definitions and classifications are unchanged.

## Actual verification

All commands ran from D:/Projects/dubbl.

| Check | Observed result | Boundary |
|---|---|---|
| Final focused detail/overview/rendering/callback/payroll money suite | 19/19 pass, zero skips; 5.273 seconds | Controlled hooks/IO and portal boundaries |
| Catalog validation | Exit 0; 7,689 keys per locale | No native linguistic approval |
| Final owned-file ESLint | Exit 0; zero errors/warnings | Four pages, reader, focused/source-guard tests and worker |
| Full lint | Exit 0; zero errors, 46 warnings elsewhere | No new owned-file warnings |
| Typecheck | Exit 0 | fumadocs-mdx and tsc --noEmit |
| Migrated payroll time fixture | 1/1 pass, zero skips; 9.886 seconds | Real REST, linked MCP and independent SQL on isolated PostgreSQL 18 |
| Full unit/static suite | 1,213/1,213 pass, zero skips; 236.650 seconds | Concurrency 2; final focused checks also cover subsequent whitespace cleanup |
| Money inventory/source and legacy guards | Exit 0; 417 columns, 2,393 scanned paths, 1,784 consumer hashes; nine legacy checks | Source/contract guard, not native review |
| Controller validation and diff check | Pass during implementation | Repeat after controller completion |

```text
node --import tsx --test tests/payroll-time-detail-catalogs.test.ts tests/payroll-time-catalogs.test.ts tests/payroll-ui-money.test.ts
node --import tsx --test --test-concurrency=2 tests/*.test.ts
node --import tsx --test --test-concurrency=1 tests/integration/payroll-time.test.ts
pnpm typecheck
pnpm i18n:check
node node_modules/eslint/bin/eslint.js "app/(dashboard)/payroll/leave" "app/(dashboard)/payroll/timesheets" i18n/payroll-time-presentation.ts tests/payroll-time-detail-catalogs.test.ts tests/payroll-ui-money.test.ts tests/integration/payroll-time-worker.ts
pnpm lint
python .agentic/scripts/money_inventory.py --write
python .agentic/scripts/money_inventory.py
node --import tsx .agentic/scripts/verify_money_inventory.mjs
node .agentic/scripts/verify_legacy_money.mjs
python .agentic/agent.py validate
git diff --check
```

The focused suite checks real bilingual templates, escaped adversarial saved
names/reasons/descriptions, document titles, finite statuses/shifts, unchanged
machine choices and canonical dates/fractional hours. Its AST audit rejects
remaining authored JSX text/raw visible attributes and its script assertion
checks every added Persian leaf. Failure tests include HTTP, malformed JSON,
missing/malformed envelopes, mismatched IDs, network failures and failed refresh.
Failed creation/rejection/entry actions retain forms; success is accepted before
refresh and a failed read cannot relabel the completed mutation as failed.
Initial effect cleanup suppresses both obsolete success and obsolete failure.

The migrated worker validates real REST/linked MCP detail, entry create/delete
and timesheet submit/approve/reject envelopes through the extended reader,
alongside its existing lists/choices/creation/leave transitions. Existing
independent SQL, permission/isolation, binary32 quantities, nested exact money,
migration preservation, transaction rollback and audit checks remain intact.

An OS-temp PostgreSQL 18 cluster listened only on 127.0.0.1:6454 with trust
authentication and max_locks_per_transaction=256. Process-scoped
TEST_DATABASE_URL/PG_BIN targeted it; the fixture created/dropped a randomized
database. The final admin query found zero remaining dubbl_ci_* databases.
pg_ctl stopped the isolated server successfully. No application DB or its
environment credentials were used.

The initial typecheck caught literal-true callback inference in the four read
callbacks and a missing AST predicate in the test harness. Explicit boolean
callback types and the FunctionDeclaration predicate corrected these errors;
the subsequent typecheck and final focused tests passed. No product failure was
suppressed. Later edits only tidied whitespace and documentation; the final
focused suite, lint and source guards cover the final production source.

## Review and handoff

See [Codex self-review](LOC-087-review-1.md). This is self-review, not independent
peer/human/native/accounting approval. Persian is provisional. LOC-067/008/002,
mounted browser/keyboard, full RTL/numerals/calendar, hosted CI, deployment and
production qualification remain independent. No full build, unrequested dev
server, Docker, external provider request, deployment or Stripe work ran.
Controller closure and task-owned commit/push follow completed checks; remote
synchronization is reported only after verification.
