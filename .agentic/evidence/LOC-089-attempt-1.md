# LOC-089 attempt 1 - payroll compensation catalogs

## Identity and scope

2026-10-21 (Asia/Tehran), Codex, D:/Projects/dubbl, master.
Entry HEAD `566d4e37e8b7c99dfd5ddf32de5edd4a485dcf9f`; clean entry tree.
Live controller validate/status/next selected LOC-089, and exactly that child
was started. Origin fetch confirmed zero ahead/zero behind. User authorized
completion and push. No subagents. The memory controller-task skill guided
the workflow; current controller and source governed acceptance.

Read root instructions, START_HERE, controller/project/repository map/frontend
guidance, task/parent boundary, catalog contract, locale/source requirements,
dependency review and prior payroll evidence. Inspected both owned pages,
payrollJson, compensation wire/service, REST routes, registered MCP tools and
the actual migrated fixture. No application database or credentials were used.

## Acceptance mapping

1. Extracted authored copy from the compensation list, two creation sheets and
   review detail into 82 paired `PayrollCompensation` messages. Catalogs contain
   7,813 compatible keys per locale. Every new Persian prose message contains
   Persian letters; the adjustment message is an explicit symbol/placeholder
   exception. Scope and preserved data/separator/shared-component exceptions
   are in the [registry](../registries/PAYROLL_COMPENSATION_CATALOGS.md).
2. Actual production JSX renders through real next-intl/PresentationProvider
   in both locales. Controlled hooks/IO invoke the real effect/form/control
   callbacks. Cases include exact high/low cents, mixed currencies, saved-data
   escaping, four statuses, all sort option values, filtering/search/clear,
   navigation, forms and busy/missing/empty/error states. HTTP/JSON/envelope,
   invalid input/money, absent organization, unavailable storage, stale success/
   rejection and failed refresh cases pass. Real migrated REST/linked MCP
   responses pass the reader alongside existing independent SQL contracts.
3. Task handoff, catalog index, scope registry and honest Codex self-review
   record provisional Persian wording and independent parent/native/RTL gates.

List reads adopt both collections/base currency atomically after successful
checks. Detail checks the selected review ID, canonical effectiveDate, finite
status, nullable budget, unique entries, binary32 percent, employee display,
counts and exact totals. Totals match independently computed bigint entry sums
and difference. Missing organization/storage releases loading; detail 404 clears
prior errors and preserves the missing state. Other read failures show finite
translated feedback. Obsolete reads cannot change state after effect cleanup.

Successful creation requires a checked band/review response before feedback,
form reset/close and refresh. Failed creation retains edits and releases busy.
A successful create remains successful if its subsequent refresh fails.
Requests preserve routes, methods, headers, field names, canonical Minor strings,
blank optional omission, empty salary zero defaults and existing currency reset
rules. Review create still omits currency; the service owns its base currency.
Existing band-width bigint rounding, mixed currency behavior, fixed-two payroll
cents, saved data, canonical dates and informational percent display remain.
Existing compensation/equity/forecasting tools cover all operations; no duplicate
tool or new user operation was introduced. No backend, authorization, schema/
migration, provider, statutory, IRR flag, stored value or Stripe change.

## Actual verification

All commands ran from D:/Projects/dubbl.

| Check | Observed result | Boundary |
|---|---|---|
| Final focused rendering/callback and payroll money checks | 12/12 pass, zero skips; 4.601 seconds | Real JSX/next-intl with controlled hooks/IO |
| Migrated compensation fixture | 2/2 pass, zero skips; 23.106 seconds | Real REST, linked MCP and independent SQL on isolated PostgreSQL 18 |
| Typecheck | Exit 0 | fumadocs-mdx and tsc --noEmit |
| Catalog validation | Exit 0; 7,813 compatible keys per locale | No native linguistic approval |
| Final owned-file ESLint | Exit 0; zero errors/warnings | Two pages, reader, focused/source-guard tests and compensation worker |
| Final full lint | Exit 0; zero errors, 33 warnings elsewhere | Existing warnings outside task |
| Full unit/static suite | 1,225/1,225 pass, zero skips; 261.917 seconds | Concurrency 2; final focused checks also cover final read-cancellation and symbol exception refinements |
| Money inventory/source and legacy guards | Exit 0; 417 columns, 2,397 scanned paths, 1,788 consumer hashes; nine legacy checks | Source/contract guards |
| Controller validation and diff check | Pass during implementation | Repeat after controller completion |

```text
node --import tsx --test tests/payroll-compensation-catalogs.test.ts tests/payroll-ui-money.test.ts
node --import tsx --test --test-concurrency=2 tests/*.test.ts
node --import tsx --test --test-concurrency=1 tests/integration/payroll-compensation.test.ts
pnpm typecheck
pnpm i18n:check
node node_modules/eslint/bin/eslint.js "app/(dashboard)/payroll/compensation/page.tsx" "app/(dashboard)/payroll/compensation/reviews/[id]/page.tsx" i18n/payroll-compensation-presentation.ts tests/payroll-compensation-catalogs.test.ts tests/payroll-ui-money.test.ts tests/integration/payroll-compensation-worker.ts
pnpm lint
python .agentic/scripts/money_inventory.py --write
python .agentic/scripts/money_inventory.py
node --import tsx .agentic/scripts/verify_money_inventory.mjs
node .agentic/scripts/verify_legacy_money.mjs
python .agentic/agent.py validate
git diff --check
```

The compensation worker applies the reader to successful list/create/get/update
band and review REST/MCP envelopes and review detail. Existing fixture checks
retain independent SQL, organization/role/membership isolation, exact-money
compatibility, immutable completed reviews, employee salary invariance, audits,
rollback, equity, forecasting and legacy migration preservation.

An OS-temp PostgreSQL 18 cluster listened only on 127.0.0.1:6455 with trust
authentication and max_locks_per_transaction=256. Process-scoped
TEST_DATABASE_URL/PG_BIN targeted it; fixtures created/dropped randomized
databases. The final admin query found zero remaining dubbl_ci_* databases.
pg_ctl stopped the isolated server successfully.

Parsed comparison confirms existing namespaces are unchanged in both catalogs.
The generated money inventory changes only scanned paths and the eight owned
consumer hashes/references. Schema-column inventory, declarations, column types,
units, classifications and saved-money semantics are unchanged.

Self-review replaced a false-positive ref-cleanup lint warning with a stable
read-cancellation callback. Final focused checks, owned/full lint and typecheck
pass after that change. The percentage catalog exception was made explicit and
final focused checks validate Persian letters rather than punctuation alone.

## Review and handoff

See [Codex self-review](LOC-089-review-1.md). This is self-review, not independent
peer/human/native/accounting approval. Persian is provisional. LOC-067/008/002,
mounted browser/keyboard, complete RTL/numerals/calendar, hosted CI, deployment
and production qualification remain independent. No full build, unrequested
dev server, Docker, external provider request, deployment or Stripe work ran.
Controller closure and scoped commit/push follow completed checks; remote
synchronization is reported only after verification.
