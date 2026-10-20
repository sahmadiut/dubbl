# LOC-076 attempt 1

## Identity and authorization

2026-10-20 (Asia/Tehran), coding-assistant/Codex, `D:/Projects/dubbl`,
branch `master`. Entry HEAD `82bb7b3770e7fbf4e92b7605312e4150b31faeb7`;
clean entry tree. Controller validate/status/next selected LOC-076, started by
`coding-assistant`. User authorized completing and pushing the next task.
Fresh origin/master fetch confirmed zero ahead/zero behind. No subagents used.
The controller-task memory skill guided the workflow, checked against current
repository instructions and controller state.

## Implementation and acceptance mapping

1. Added 168 paired `InventoryMovements` messages, 6,880 keys per locale.
   Extracted stock-take list/detail, transfer route/list/detail and only
   StockTakeDrawer/TransferDrawer, including their shared-footer overrides,
   confirmation cancel labels, accessible quantity/search/sort/removal labels,
   empty examples, statuses, plural summaries and finite feedback. The
   [scope inventory](../registries/INVENTORY_MOVEMENT_CATALOGS.md) records explicit
   exceptions and independent parent/native/RTL handoff.
2. Fourteen focused tests render actual production JSX through real next-intl
   and PresentationProvider with controlled hooks and portal/IO boundaries.
   Canonical requests, organization headers, statuses, IDs, whole-unit quantity
   payloads, cancel/failure retention, posting and bulk feedback, optimistic
   restoration, nullable history, request cleanup/generations, escaping, Persian
   script and source-copy audits pass. The migrated fixture validates real
   authenticated REST and linked registered MCP results through the new readers,
   with independent SQL-text assertions for stock/transfer counts and adjustments.
3. Scope/catalog registry, handoff and separate honest self-review retain
   provisional Persian and independent LOC-066/008/002/native/RTL qualification.

The shared display reader validates HTTP/JSON/envelopes and finite displayed
fields before adoption/success. It reuses existing exact money/count validation
for stock-take lines and inventory lookup, retaining canonical Minor aliases,
live-stock discrepancies and nullable adjusted flags. Stock-take creation
validates the header-only response rather than requiring absent detail lines.

Raw server/parser/network prose uses finite localized operation feedback.
Missing organization prevents writes and terminates loading. Stale/disposed
reads cannot adopt results. Transfer cancellation verifies HTTP/shape before
success. Failed optimistic counts restore only the affected line and return a
failure to bulk confirmation. A successful posting retains its verified full
result if the follow-up GET fails. Forms/details remain on failed mutations;
busy states clear.

Existing REST/MCP/services cover every unchanged operation. Routes, methods,
organization headers, status/sort/filter codes, form names, custom events,
IDs, notes/warehouse null semantics and whole-unit count/transfer payloads remain.
No production API/MCP/service/auth/schema/migration, stock posting, ledger,
currency/FX/IRR or Stripe source changed. AST comparison of creation-drawer
function declarations confirmed only StockTakeDrawer and TransferDrawer changed.

Money inventory refresh adds two scanned files and changes/adds ten owned
consumer records. All 417 schema-column records are identical; MONEY_COLUMNS
has no semantic diff. The source guard follows the presentation reader to its
existing exact-money validators rather than requiring a direct page import.

## Verification actually completed

Commands ran with installed dependencies in `D:/Projects/dubbl`.

| Check | Observed result | Limit |
|---|---|---|
| Focused movement catalog/render/behavior suite plus inventory money suites | 26/26 passed, including 14 new focused tests; 5.397 seconds | Controlled hooks/IO, not mounted browser |
| Full unit/static suite, concurrency 4 | 1,095/1,095 passed, no skips; 147.612 seconds | Local, not hosted CI |
| Migrated movement REST/MCP/SQL suite | 1/1 passed, no skips; 21.683 seconds | Disposable synthetic PostgreSQL |
| `pnpm typecheck`, final repeat | Exit 0 | fumadocs-mdx/tsc; no full build |
| `pnpm i18n:check`, final repeat | Exit 0; 6,880 keys per locale | Not native terminology approval |
| Owned TypeScript ESLint, eight files | Exit 0, zero errors/warnings | Owned sources/tests |
| Full `pnpm lint` | Exit 0, zero errors, 65 existing warnings | Repository lint |
| Money inventory write/check and exact loader | Passed, 417 columns, 1,761 consumers | Conservative lexical inventory |
| Legacy money guard | Nine regression checks passed | Existing guard scope |
| Controller validate and `git diff --check` | Passed | Structural validation only |

```text
node --import tsx --test tests/inventory-movement-catalogs.test.ts tests/inventory-ui-money.test.ts tests/inventory-detail-ui-money.test.ts
node --import tsx --test --test-concurrency=4 tests/*.test.ts
node --import tsx --test --test-concurrency=1 tests/integration/inventory-movements.test.ts
pnpm typecheck
pnpm i18n:check
node node_modules/eslint/bin/eslint.js "app/(dashboard)/inventory/stock-takes/page.tsx" "app/(dashboard)/inventory/stock-takes/[id]/page.tsx" "app/(dashboard)/inventory/transfers/page.tsx" components/dashboard/create-drawer.tsx i18n/inventory-movement-presentation.ts tests/inventory-movement-catalogs.test.ts tests/inventory-ui-money.test.ts tests/integration/inventory-movements-worker.ts
pnpm lint
python .agentic/scripts/money_inventory.py --write
python .agentic/scripts/money_inventory.py
node --import tsx .agentic/scripts/verify_money_inventory.mjs
node .agentic/scripts/verify_legacy_money.mjs
python .agentic/agent.py validate
git diff --check
```

Integration used a fresh OS-temp PostgreSQL 18 cluster, bound only to
127.0.0.1:6331, explicit process-scoped TEST_DATABASE_URL/PG_BIN, loopback trust
authentication and max_locks_per_transaction=256. The fixture created, migrated
and dropped its randomized database. Admin SQL confirmed zero remaining
`dubbl_ci_*` databases; pg_ctl stopped the cluster in finally. Sanitized logs and
stopped cluster artifacts remain in OS temp. No application database was used.
Existing cost-flow, whole-stock, money, organization isolation, custom permission,
malformed-input, audit and atomic rollback assertions also pass.

Initial typecheck caught an overbroad label-type replacement in the shared
drawer file; it was restored and an AST comparison verified scope. Initial
focused tests exposed the placeholder-only statusCount Persian-script exception
and a stale direct-import source assertion; both were corrected without
weakening the retained exact-money validation. An effect-ref lint warning was
repaired. The final checks above passed after these corrections; no failed check
is represented as a pass.

## Review and handoff

See [Codex self-review](LOC-076-review-1.md). Persian wording remains provisional.
LOC-066/008/002 combined acceptance, native terminology, full RTL/date/numeral/
input, mounted browser/keyboard, output, hosted CI, deployment and production
qualification remain independent. No full build, unrequested dev server,
application DB/provider, deployment or dedicated Stripe work ran. Finish the
controller acceptance/submission/self-review/done sequence, commit only owned
files, push origin/master, verify remote SHA/clean tree, report live next task
and stop. Commit/push outcomes are reported separately after they occur.
