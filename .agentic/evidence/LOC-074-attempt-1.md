# LOC-074 attempt 1

2026-10-20 (Asia/Tehran), Codex, `D:/Projects/dubbl`, branch `master`.
Entry HEAD `f3d832ffa99d456b2e661501a35ee14cd403492c`; clean entry tree.
Controller validate/status/next selected LOC-074, started by `codex`.
User authorized completing and pushing the next task. A fresh origin/master
fetch before disposition confirmed zero ahead/zero behind. No subagents used.
LOC-066/008/002 remain independent integration parents.

Read current root/.agentic instructions, controller, project/map/frontend role,
task/parent/catalog inputs, localization source requirements, existing item
evidence, actual routes, inventory catalog service/wire/schema/MCP and fixtures.
The memory controller-task skill supplied workflow guidance, checked against
current controller state. Completed sibling evidence remains unchanged.

## Acceptance mapping and delivered behavior

1. Added 54 paired `InventoryCatalogs` messages (6,635 compatible keys per
   locale). All authored variants/suppliers route titles, headings, empty states,
   forms/examples/actions, badges, captions, validation/read/mutation feedback
   and unlink confirmation/cancel labels are extracted. Added accessible unlink
   text. The [scope inventory](../registries/INVENTORY_VARIANT_SUPPLIER_CATALOGS.md)
   records caller/machine/currency/formatting exceptions and adjacent ownership.
2. Real production JSX renders through next-intl/PresentationProvider and actual
   controls with controlled hook/portal/IO boundaries. Actual callbacks/effects
   preserve scoped requests, exact high/low monetary digits, canonical Minor
   strings, signed int32 quantities, nonnegative int32 days, blank omission and
   explicit zero. They cover failure/form retention, preference/contact fallback,
   translated confirmation/cancellation, nullable history and cancelled reads.
   Existing migrated REST/MCP fixtures now apply the new presentation validators
   to successful DTOs and retain authorization/isolation/audit/rollback checks.
3. Scope, catalog index, task handoff and separate honest self-review retain
   provisional Persian and independent parent/native/RTL/browser qualification.
   Neither key parity nor controlled rendering establishes those qualifications.

New `i18n/inventory-catalog-presentation.ts` validates HTTP/JSON/envelopes, all
displayed fields and existing exact money/count aliases before state adoption.
Historical null prices and null variant physical counts remain nullable;
nullable active/preferred flags retain prior semantics. No monetary coercion,
rescaling, quantity conversion or new financial rule is introduced.

Missing organization and unverified server/parser prose use safe localized
fallbacks; only known local input errors receive finite translated mappings.
Failed mutations retain forms/rows and clear busy state. Saved supplier links
with failed refresh have distinct feedback. Unlink removes a row only after
verified success. Initial reads suppress cancelled results and terminate loading
without an organization. Existing REST/MCP/service/authorization/database/schema/
migration/ledger/FX/IRR behavior and Stripe are unchanged; registered inventory
catalog MCP operations already cover all unchanged UI operations.

Generated MONEY_BOUNDARIES refresh adds two scanned consumers and updates six
owned consumer records. Only scanned_paths/consumers change; all 417 schema
column classifications are identical. MONEY_COLUMNS has no semantic diff.

## Verification actually completed

Commands ran from `D:/Projects/dubbl` with installed dependencies.

| Check | Observed result | Limit |
|---|---|---|
| New focused catalog/render/callback/effect suite | 10/10 passed | Controlled SSR/IO, not mounted browser |
| Focused suite plus existing inventory money guards | 18/18 passed, no skips | Same focused boundary |
| Full unit/static suite, concurrency 4 | 1,069/1,069 passed, no skips; 189.553 seconds | Local tests, not hosted CI |
| Two migrated REST/MCP/SQL suites | 2/2 passed, no skips; 52.651 seconds | Disposable synthetic PostgreSQL fixtures |
| `pnpm typecheck` | Exit 0 | fumadocs-mdx and tsc, no full build |
| `pnpm i18n:check` | Exit 0; 6,635 keys per locale | No native terminology approval |
| Owned TypeScript ESLint, six files | Zero errors/warnings | Owned files only |
| Full `pnpm lint` | Exit 0; zero errors/65 existing warnings | Existing warnings retained |
| Money inventory write/verify and exact loader | Passed; 417 columns/1,757 consumers | Conservative lexical inventory |
| Legacy money guard | Nine regression checks passed | Existing gate scope |
| Controller validation / `git diff --check` | Passed; repeated at disposition | Structural validation only |

```text
node --import tsx --test tests/inventory-variant-supplier-catalogs.test.ts
node --import tsx --test tests/inventory-variant-supplier-catalogs.test.ts tests/inventory-ui-money.test.ts
node --import tsx --test --test-concurrency=4 tests/*.test.ts
node --import tsx --test --test-concurrency=1 tests/integration/inventory-catalog.test.ts tests/integration/inventory-ui-money.test.ts
pnpm typecheck
pnpm i18n:check
node node_modules/eslint/bin/eslint.js "app/(dashboard)/inventory/[id]/variants/page.tsx" "app/(dashboard)/inventory/[id]/suppliers/page.tsx" i18n/inventory-catalog-presentation.ts tests/inventory-variant-supplier-catalogs.test.ts tests/inventory-ui-money.test.ts tests/integration/inventory-catalog-worker.ts
pnpm lint
python .agentic/scripts/money_inventory.py --write
python .agentic/scripts/money_inventory.py
node --import tsx .agentic/scripts/verify_money_inventory.mjs
node .agentic/scripts/verify_legacy_money.mjs
python .agentic/agent.py validate
git diff --check
```

Database checks used a fresh OS-temp PostgreSQL 18 cluster listening exclusively
on 127.0.0.1:6329, explicit process-scoped TEST_DATABASE_URL/PG_BIN, loopback-only
trust authentication and max_locks_per_transaction=256. Fixtures created,
migrated and dropped randomized databases. Admin SQL confirmed zero remaining
`dubbl_ci_*` databases; pg_ctl stopped the cluster in finally. Sanitized logs and
stopped cluster files remain in OS temp. No application database/provider used.
Independent SQL-text assertions check variant cents through MAX_SAFE_INTEGER,
quantity and supplier price/lead days; the second suite retains six monetary
workflows. Existing authorization, foreign/deleted ownership, custom permissions,
malformed/unsafe alias rejection, audit rollback and no-ledger-posting checks pass.

An initial PowerShell-to-Python text pipe damaged new Unicode literals. A
filesystem UTF-8 helper restored the 54 Persian values and English title separator;
all Persian messages now have script assertions. Initial focused tests found the
test harness loading a separate next-intl module through BrandLoader; importing
the real module directly fixed provider identity. Updated the existing inventory
source guard to follow the extracted validator. A money inventory check caught
expected source drift while the final optional-input test was being added;
regenerated after source completion and both final verifiers pass. No failed
check is represented as a pass.

## Review and handoff

See [Codex self-review](LOC-074-review-1.md). Persian is provisional; native
terminology, complete RTL/dates/numerals/input, mounted browser/keyboard, output,
hosted CI, release/deployment and production qualification remain independent.
No full build, unrequested dev server, Docker, deployment or dedicated Stripe
work ran. Finish controller acceptance/submission/self-review/done, commit only
owned files, push origin/master, verify remote SHA/clean tree, report next task
and stop. Commit/push results are reported separately only after they occur.
