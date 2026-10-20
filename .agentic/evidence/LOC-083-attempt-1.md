# LOC-083 attempt 1 - payroll run list and creation catalogs

## Identity and scope

2026-10-21 (Asia/Tehran), Codex, D:/Projects/dubbl, master.
Entry HEAD `2dd325c2`; clean entry tree. Live controller validate/status/next
selected LOC-083 and exactly that child was started. Origin fetch confirmed
zero ahead/zero behind before implementation. User authorized completion and
push. No subagents. The memory controller-task skill guided the workflow;
current repository/controller state governed selection and acceptance.

Read root and nested agent rules, START_HERE, controller, project/map/frontend
guidance, task/parent, catalog contract, prior payroll evidence and relevant
locale source sections. Inspected both owned components, money and overview
readers, actual run/employee REST/MCP definitions, shared services and migrated
fixtures. No application database was used.

## Acceptance mapping

1. Extracted all authored copy in the run list, NewRunDialog and OffCycleDialog
   into 71 paired `PayrollRuns` messages. Catalog validation reports 7,337
   compatible keys per locale. All authored Persian prose contains Persian
   script. The [scope inventory](../registries/PAYROLL_RUN_CATALOGS.md) records
   the data-only employee separator, shared loader, numeric examples, caller
   data, dates, identifiers and fixed-two cents exceptions.
2. Real next-intl/PresentationProvider rendering and actual production callbacks
   pass in both locales. Checked readers require HTTP success, valid envelopes,
   displayed fields, finite statuses/types, pagination, canonical dates and
   exact money aliases before adopting data. Missing organization/storage and
   failed reads finish loading with finite translated feedback. Off-cycle
   choices traverse checked pages and suppress obsolete results/errors.
   Failed mutations preserve forms, release busy and avoid false success,
   closing or navigation. Regular and all three off-cycle payloads, route
   headers, signed correction cents, PTO, notes and success variants retain
   their existing contracts. Invalid cents fail before any fetch.
3. Task handoff, scope inventory, catalog index and honest self-review retain
   provisional Persian and independent LOC-067/008/002/native/RTL acceptance.

No monetary calculation, currency scale, stored value, canonical date, statutory
identifier, permission, REST/MCP definition, schema/migration, IRR flag,
provider or Stripe change. The existing run list default first page and client
search/sort/filter behavior remain. Existing dedicated MCP operations already
cover this user-facing presentation. Generated money inventory changes only
scanned paths and task-owned source consumers; schema classifications and
other top-level sections match entry HEAD.

## Actual verification

All commands ran from D:/Projects/dubbl.

| Check | Observed result | Boundary |
|---|---|---|
| Focused production rendering/callback and payroll money suite | 13/13 pass, zero skips; final focused run 3.502 seconds | Controlled hooks/IO and portal boundaries |
| Catalog validation | Exit 0; 7,337 keys per locale | No native linguistic approval |
| Owned-file ESLint | Exit 0, zero warnings/errors | Both components, reader, focused/source-guard tests and run worker |
| Full lint | Exit 0; zero errors, 51 existing warnings | Final focused test assertion strengthening also passed owned lint |
| Typecheck | Exit 0 after correcting fixture helper typing | fumadocs-mdx and tsc --noEmit |
| Migrated payroll run/lifecycle and preservation fixtures | 2/2 pass, zero skips; 21.818 seconds | Real REST, registered linked MCP and independent SQL on isolated PostgreSQL 18 |
| Full unit/static suite, concurrency 2 | 1,179/1,179 pass, zero skips; 287.079 seconds | Final strengthened assertion also passed the focused suite |
| Money inventory/source and legacy guards | Exit 0; 417 columns, 2,386 scanned paths, 1,777 consumer hashes; nine legacy checks | Final focused-test source hash refreshed |
| Controller validation and diff check | Pass during implementation | Repeat with completed evidence |
| Owned Markdown links | 95 local targets exist | Task, catalog index, scope, attempt and review |

```text
node --import tsx --test tests/payroll-run-catalogs.test.ts tests/payroll-ui-money.test.ts
node --import tsx --test --test-concurrency=2 tests/*.test.ts
node --import tsx --test --test-concurrency=1 tests/integration/payroll-runs.test.ts
pnpm typecheck
pnpm i18n:check
node node_modules/eslint/bin/eslint.js "app/(dashboard)/payroll/runs/page.tsx" "app/(dashboard)/payroll/runs/off-cycle-dialog.tsx" i18n/payroll-run-presentation.ts tests/payroll-run-catalogs.test.ts tests/payroll-ui-money.test.ts tests/integration/payroll-runs-worker.ts
pnpm lint
python .agentic/scripts/money_inventory.py --write
python .agentic/scripts/money_inventory.py
node --import tsx .agentic/scripts/verify_money_inventory.mjs
node .agentic/scripts/verify_legacy_money.mjs
python .agentic/agent.py validate
git diff --check
```

Focused checks cover populated/empty/filtered/loading/error/busy states,
status/type/sort labels and values, date/status filtering, sort directions,
navigation, caller escaping, null/JPY/KWD currency, zero/29/max-safe cents,
missing/malformed/conflicting money, invalid fields/enums/dates/pagination,
checked page traversal, read cleanup, actual regular/final-pay/bonus/correction
callbacks, exact payloads/headers, notes/PTO/signed adjustments, translated
success variants, failure retention, organization/storage errors and copy audit.
No private server/parser/network/storage prose becomes visible feedback.

The migrated run worker passes actual REST and linked MCP regular/bonus/
termination/correction creation responses through the new reader, validates
run lists and completed-parent choices with an explicit MCP list adapter, and
checks employee choices from the real REST handler. Existing SQL text, exact
FX and cents, history preservation, balanced journal, authorization/isolation,
audit and rollback assertions remain intact. The subsequent generic type-only
fix to its response-check helper preserves fixture response types and runtime
behavior; typecheck passes.

An OS-temp PostgreSQL 18 cluster listened only on 127.0.0.1:6453, with trust
authentication and max_locks_per_transaction=256. Process-scoped
TEST_DATABASE_URL/PG_BIN pointed fixtures there; each case created and dropped
its own randomized database. An independent admin query found zero remaining
dubbl_ci_* databases. pg_ctl stopped the isolated server successfully.

Initial focused failures exposed the local hardcoded loading accessibility
label and the data-only separator exception: localized the loader through
SharedUI and documented/tested the separator. Updated the shared money source
guard to follow the new reader. Initial typecheck exposed an overly narrow
test-helper response type; a generic return preserves existing fixture types.
Self-review strengthened the invalid-money test to count requests explicitly,
so caught assertions cannot masquerade as pre-fetch rejection. Final focused
checks and changed-test lint passed after that strengthening.

## Review and remaining qualification

See [Codex self-review](LOC-083-review-1.md). This is self-review, not independent
peer/human/native/accounting approval. Persian financial terminology remains
provisional. LOC-067/008/002 retain independent combined acceptance.
Mounted browser/keyboard, complete RTL/numerals/calendar, run detail/output
translation, hosted CI, deployment and production acceptance are not claimed.
No full build, dev server, Docker, external provider request, application DB,
deployment or dedicated Stripe work ran. Controller closure and scoped commit/
push follow successful checks; remote synchronization is reported only after
verification.
