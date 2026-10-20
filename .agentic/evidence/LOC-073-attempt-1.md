# LOC-073 attempt 1

2026-10-20 (Asia/Tehran), Codex. Bounded inventory item catalog extraction;
implementing-assistant self-review, not independent/native terminology approval.
Initial branch `master`, clean tree, HEAD `38474399beb8566508e0618ea1c2292d63122bcd`.
Controller validate/status/next selected LOC-073, started as `codex`. LOC-066,
LOC-008 and LOC-002 remain independent integration parents.

## Delivered behavior and acceptance

1. Added 208 paired `InventoryItems` messages (6,581 keys per locale), covering
   item list/title/statistics/chart/filter/sort/search/selection/CSV/import/bulk,
   detail workspace/navigation/stock adjustment/write-down, overview fields/
   revaluation/barcode/delete, history, item picker and InventoryDrawer only.
   Shared DrawerFooter receives translated cancel/creating overrides. The
   [scope and explicit exceptions](../registries/INVENTORY_ITEM_CATALOGS.md)
   reconcile caller data, canonical CSV/machine values and adjacent ownership.
2. Production JSX renders through real next-intl/PresentationProvider, controls
   and shared footer. Actual callbacks/effects test scoped methods/URLs/headers/
   payloads, exact high/low monetary digits, USD major input and canonical Minor
   strings, book versus catalog values, quantity units, busy/empty/search/error
   states, selection, cancellation, safe failures and unchanged CSV bytes.
3. This evidence, linked scope and separate honest self-review retain provisional
   Persian and independent parent/native/RTL/browser/output handoff. Key parity
   and controlled SSR/callback tests do not establish those qualifications.

Added `i18n/inventory-item-presentation.ts` validates HTTP/JSON/envelopes/identity,
money aliases, physical counts and displayed fields before response-driven state
adoption. Existing exact-money validators/calculators are reused without unit or
rounding changes. List validation completes before rows/summary/pagination change.
Finite known history labels use own-property mappings; unknown codes and all
caller-authored names/descriptions/reasons/IDs remain escaped data.

Failed mutations retain forms/selections/sheets; missing-org guards precede busy
flags. Delete reports success/navigates only after verified success. Bulk/import
distinguish saved writes from refresh failure; affected/created/updated/row counts
remain canonical. Arbitrary parser/server prose uses localized safe fallbacks,
including row-number feedback with a check-values prompt. History/location reads
handle errors and cancelled work. Barcode print localizes its owned title/alt and
escapes names before HTML interpolation; original SKU/code and CODE128 settings
are unchanged.

REST/MCP/service/authorization/database/schema/migrations, exact-money arithmetic,
FX/IRR flags and Stripe are unchanged. Existing inventory-master and movement
MCP tools already match the unchanged user operations; no new tool is needed.
Three existing integration workers additionally apply the new validators to
actual REST/MCP results while retaining their original SQL/transport assertions.

Refreshed generated MONEY_BOUNDARIES only for source hashes/line references and
two new scanned TypeScript consumers. MONEY_COLUMNS has no semantic diff.

## Verification actually completed

All commands ran from `D:\Projects\dubbl` with installed dependencies.

| Check | Observed result |
|---|---|
| Focused inventory item catalog/render/callback/effect/source suite | 18/18 pass |
| Full unit/static run | 1,059/1,059 pass; no failures/skips |
| Three migrated inventory REST/MCP/SQL suites | 3/3 pass; no skips |
| `pnpm typecheck` | Passed; no full build |
| `pnpm i18n:check` | Passed; 6,581 keys per locale |
| Owned TypeScript ESLint (11 files) | Zero errors/warnings |
| `pnpm lint` | Zero errors/65 remaining existing warnings; three prior history unused-import warnings removed |
| Money inventory write/verify and exact inventory loader | Passed; 417 columns, 1,755 consumer hashes |
| Legacy money guard | Nine regression checks passed |
| Controller validation / `git diff --check` | Passed; repeated at disposition |

```text
node --import tsx --test tests/inventory-item-catalogs.test.ts
node --import tsx --test --test-concurrency=4 tests/*.test.ts
node --import tsx --test --test-concurrency=1 tests/integration/inventory-master.test.ts tests/integration/inventory-movements.test.ts tests/integration/inventory-detail-ui-money.test.ts
pnpm typecheck
pnpm i18n:check
node node_modules/eslint/bin/eslint.js "app/(dashboard)/inventory/page.tsx" "app/(dashboard)/inventory/[id]/page.tsx" "app/(dashboard)/inventory/[id]/layout.tsx" "app/(dashboard)/inventory/[id]/history/page.tsx" components/dashboard/create-drawer.tsx components/dashboard/inventory-item-picker.tsx i18n/inventory-item-presentation.ts tests/inventory-item-catalogs.test.ts tests/integration/inventory-master-worker.ts tests/integration/inventory-movements-worker.ts tests/integration/inventory-detail-ui-money-worker.ts
pnpm lint
python .agentic/scripts/money_inventory.py --write
python .agentic/scripts/money_inventory.py
node --import tsx .agentic/scripts/verify_money_inventory.mjs
node .agentic/scripts/verify_legacy_money.mjs
python .agentic/agent.py validate
git diff --check
```

Database checks used a fresh OS-temp PostgreSQL 18 cluster on 127.0.0.1:6328,
explicit process-scoped TEST_DATABASE_URL/PG_BIN, loopback-only trust auth and
max_locks_per_transaction=256. Fixtures created/migrated/dropped randomized
databases. Admin SQL confirmed zero remaining `dubbl_ci_*` databases, and finally
stopped the cluster. Sanitized logs/stopped cluster files remain in OS temp. No
application database or external provider was used.

During implementation, checks caught the shared footer prop name (`creatingLabel`,
not `savingLabel`), a React effect-state lint violation and a missing quantity/cost
message. Fixed these before final validation. Harness corrections removed an
extra parenthesis, compared parsed response objects structurally, preserved SVG
chart context and recognized the existing arrow entity as punctuation. A temp
source-edit helper was corrected for Windows CRLF and a combined import; those
helpers are outside the repository. No failed check is represented as passing.

## Review and handoff

See [Codex self-review](LOC-073-review-1.md). Persian remains provisional. Native
terminology, full RTL/dates/numerals/input, mounted keyboard/browser, authored
outputs, hosted CI, deployment and production qualification remain separate.
No full build, unrequested dev server, Docker, deployment or dedicated Stripe work
ran. User authorized push through the task request.

Finish controller acceptance/submission/self-review/done,
scoped commit and push to origin/master, then verify remote SHA and clean tree.
Report the live next task and stop; do not start the sibling or accept a parent.
