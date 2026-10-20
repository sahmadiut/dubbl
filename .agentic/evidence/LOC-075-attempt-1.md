# LOC-075 attempt 1

## Identity

2026-10-20 (Asia/Tehran), Codex, `D:/Projects/dubbl`, branch `master`.
Entry HEAD `e46d530f43febdac2a9371f1e65ac0d1c7d83286`; clean entry tree.
Controller validate/status/next selected LOC-075, started by `codex`.
User authorized completing and pushing the next task. Fresh origin/master
fetch confirmed zero ahead/zero behind before disposition. No subagents used.
The controller-task memory skill supplied workflow guidance, checked against
current repository instructions and controller state.

## Implementation and acceptance mapping

1. Added 77 paired `Warehouses` messages, 6,712 compatible keys per locale.
   Extracted warehouse page headings, empty examples/help, benefits, stats,
   filters/sort, badges, forms/actions/loading, confirmations and read/mutation
   feedback; WarehouseDrawer only and its shared-footer overrides; shared picker
   labels, placeholders, default badge and failure feedback. Added translated
   accessible labels to clear search and toggle sort. The
   [scope inventory](../registries/WAREHOUSE_CATALOGS.md) records all exceptions.
2. Real production JSX/controls render through next-intl/PresentationProvider
   with controlled hooks and portal/IO boundaries. Twelve focused tests exercise
   canonical payloads, edit/create failure retention, cancellation, default
   booleans, request generations, picker selection/deselection, filtering and
   sorting, historical nullable flags, caller escaping, Persian script and source
   copy coverage. The migrated fixture validates actual REST/MCP warehouse DTOs
   through the new reader and checks SQL location/default values independently.
3. Scope/catalog registry, task handoff and separate honest self-review retain
   provisional Persian and independent LOC-066/008/002/native/RTL qualification.

`i18n/warehouse-presentation.ts` validates HTTP/JSON/envelopes and displayed
location fields before adoption or mutation success. Nullable active/default
flags remain nullable with previous truthiness. Unknown server/parser/network
prose uses safe operation-specific localized feedback. Failed writes retain
forms/rows; busy states clear. Missing organization prevents writes and ends
loading. Page cleanup/superseding requests suppress stale results. Picker errors
are visible and closing/superseding requests suppresses adoption.

Unchanged routes/methods/organization headers, IDs, location payloads including
blank-address null, default boolean payload, form names, canonical filters/sort,
custom event and caller overrides preserve existing contracts. Existing
org-scoped REST/MCP/services already implement every operation. No production
API/MCP/service/auth/schema/migration/stock/ledger/FX/IRR or Stripe source changed.
Money inventory refresh changes only scanned_paths/consumers: two added scanned
files and eight owned changed/added consumer records. All 417 schema-column
classifications are identical; MONEY_COLUMNS has no semantic diff.

## Verification actually completed

Commands ran in `D:/Projects/dubbl` using installed dependencies.

| Check | Actual result | Limit |
|---|---|---|
| Focused catalogs/render/callback/source suite | 12/12 passed; repeated after final harness cleanup, 2.786 seconds | Controlled rendering/IO, not mounted browser |
| Full unit/static suite, concurrency 4 | 1,081/1,081 passed, no skips; 156.335 seconds | Local suite, not hosted CI |
| Migrated inventory movement REST/MCP/SQL | 1/1 passed, no skips; 26.352 seconds | Disposable synthetic PostgreSQL |
| `pnpm typecheck`, final repeat | Exit 0 | fumadocs-mdx/tsc, no full build |
| `pnpm i18n:check` | Exit 0; 6,712 keys per locale | Not native approval |
| Owned TypeScript ESLint, six files | Exit 0; zero errors/warnings | Owned sources/tests |
| Full `pnpm lint` | Exit 0; zero errors, existing warnings | Final count recorded in self-review |
| Money inventory write/verify and exact loader | Passed; 417 columns/1,759 consumers | Conservative lexical inventory |
| Legacy money guard | Nine regression checks passed | Existing gate scope |
| Controller validation / `git diff --check` | Passed | Structural validation only |

```text
node --import tsx --test tests/warehouse-catalogs.test.ts
node --import tsx --test --test-concurrency=4 tests/*.test.ts
node --import tsx --test --test-concurrency=1 tests/integration/inventory-movements.test.ts
pnpm typecheck
pnpm i18n:check
node node_modules/eslint/bin/eslint.js "app/(dashboard)/inventory/warehouses/page.tsx" components/dashboard/warehouse-picker.tsx components/dashboard/create-drawer.tsx i18n/warehouse-presentation.ts tests/warehouse-catalogs.test.ts tests/integration/inventory-movements-worker.ts
pnpm lint
python .agentic/scripts/money_inventory.py --write
python .agentic/scripts/money_inventory.py
node --import tsx .agentic/scripts/verify_money_inventory.mjs
node .agentic/scripts/verify_legacy_money.mjs
python .agentic/agent.py validate
git diff --check
```

Integration used a fresh OS-temp PostgreSQL 18 cluster listening exclusively on
127.0.0.1:6330, explicit process-scoped TEST_DATABASE_URL/PG_BIN, loopback-only
trust authentication and max_locks_per_transaction=256. The fixture created,
migrated and dropped its randomized database. Admin SQL confirmed zero remaining
`dubbl_ci_*` databases; pg_ctl stopped the cluster in finally. Sanitized logs and
stopped cluster files remain in OS temp. No application database/provider used.
Existing inventory cost/whole-stock/money, organization isolation/custom
permissions, malformed input, audit and atomic rollback assertions also pass.

Initial source review caught and corrected an automated namespace replacement,
a shared-footer prop name and the exact English transfer-help wording before
focused execution. Initial lint reported an effect-ref warning and unused test
variable; both were repaired, and final owned lint is clean. The full suite ran
all twelve tests; final focused execution repeated after dead harness code
cleanup. No failed check is represented as a pass.

## Review and handoff

See [Codex self-review](LOC-075-review-1.md). Persian wording remains provisional;
LOC-066/008/002, native terminology, complete RTL/date/numeral/input, mounted
browser/keyboard, output, hosted CI, deployment and production qualification
remain independent. No full build, unrequested dev server, Docker, application
database/provider, deployment or dedicated Stripe work ran. Finish controller
acceptance/submission/self-review/done, commit only owned files, push
origin/master, verify SHA/clean tree, report live next task and stop. Commit/push
results are reported separately only after they occur.
