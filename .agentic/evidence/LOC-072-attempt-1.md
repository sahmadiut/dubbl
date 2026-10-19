# LOC-072 attempt 1

2026-10-20 (Asia/Tehran), Codex. Bounded inventory category catalog extraction;
honest implementing-assistant self-review, not native linguistic approval.

## Selection and scope

Initial branch `master`, clean working tree, HEAD `6f9a680e`. Controller validate,
status and next selected broad LOC-008 after completed LOC-007. Source inspection
found 101 route components / 34,958 lines: inventory 18/7,059, payroll 27/10,917,
projects 11/5,262, CRM 7/2,307, reports 34/7,414, dashboard 2/858 and documents
2/1,141, plus shared controls/drawers. Created LOC-066..071 module children and
used controller split to retain LOC-008 integration acceptance. Inventory was
subdivided into LOC-072..078, retaining LOC-066 integration. Inventory children
have priority 0, other modules priority 1; live next selected LOC-072, which was
started with owner `codex`. No sibling or parent acceptance was claimed.

Updated task index, source coverage and catalog ownership with explicit child
boundaries. Broad payroll/reporting children can be subdivided when selected.
This planning does not assert implementation of their untranslated surfaces.

## Delivered behavior

- Added 40 paired `InventoryCategories` and five `InventoryNavigation` messages,
  totaling 6,373 keys per locale. Covers the category page/title/tree/count,
  empty/create/edit states, shared picker, CategoryDrawer, real footer overrides,
  pending labels, confirmations and safe operation errors. Persian is provisional.
- Preserved all five navigation routes, icons and exact root matching. Category
  names/descriptions and caller placeholder overrides remain escaped data. Form
  names/IDs, hex colors, root/null values, IDs, root-only parent choices, selection
  toggle/clear behavior, organization header and refetch event stay canonical.
- Added presentation-only HTTP/JSON/envelope/row validation before reads or
  mutations adopt state or report success. Failed reads retain rows, failed
  writes retain forms, and unknown server/network prose never leaks into UI.
  Picker stale response/error suppression and pending cleanup are retained.
- Fixed the category page's early empty-state return hiding its creation sheet
  and confirmation host; the first-category action can now open the same form.
  Page deletion checks HTTP status and success envelope. Drawer missing-org
  guard precedes its busy flag. Confirmation reflects existing item/child unlink
  behavior and retained free-text category.
- Existing four category MCP tools already match the unchanged REST routes and
  direct Drizzle services. No new operation, REST/MCP/service/schema/migration,
  accounting, money/FX, currency flag or Stripe change.
- Refreshed generated money inventory only for changed source hashes/line
  references and two new scanned TypeScript files; MONEY_COLUMNS has no semantic
  diff. See [scope/exceptions](../registries/INVENTORY_CATEGORY_CATALOGS.md).

## Verification actually completed

| Check | Result |
|---|---|
| `node --import tsx --test tests/inventory-category-catalogs.test.ts` | 11/11 pass, repeated after final JSX formatting |
| `node --import tsx --test --test-concurrency=4 tests/*.test.ts` | 1,041/1,041 pass; no skips/failures |
| Inventory-master migrated PostgreSQL suite below | 1/1 pass; real REST/MCP/category graph/authorization/audit and independent SQL checks |
| `pnpm typecheck` | Passed; no full Next build |
| `pnpm i18n:check` | Passed; 6,373 matching keys per locale |
| Changed-file ESLint below | Zero errors/warnings |
| `pnpm lint` | Zero errors, 68 existing warnings |
| Generated inventory write/verify and exact inventory loader below | Passed; 417 columns, 1,753 consumer hashes |
| Legacy money guard | Nine regression checks passed |
| Controller validation / `git diff --check` | Passed; repeated at disposition |

```text
node --import tsx --test tests/inventory-category-catalogs.test.ts
node --import tsx --test --test-concurrency=4 tests/*.test.ts
node --import tsx --test --test-concurrency=1 tests/integration/inventory-master.test.ts
pnpm typecheck
pnpm i18n:check
node node_modules/eslint/bin/eslint.js "app/(dashboard)/inventory/categories/page.tsx" "app/(dashboard)/inventory/layout.tsx" components/dashboard/category-picker.tsx components/dashboard/create-drawer.tsx i18n/inventory-category-presentation.ts tests/inventory-category-catalogs.test.ts
pnpm lint
python .agentic/scripts/money_inventory.py --write
python .agentic/scripts/money_inventory.py
node --import tsx .agentic/scripts/verify_money_inventory.mjs
node .agentic/scripts/verify_legacy_money.mjs
python .agentic/agent.py validate
git diff --check
```

Integration used a fresh OS-temp PostgreSQL 18 cluster bound to 127.0.0.1:6327,
explicit process-scoped TEST_DATABASE_URL and PG_BIN, trust auth only for this
loopback test cluster, and max_locks_per_transaction=256. The fixture created,
migrated and dropped its random database. Independent admin SQL confirmed zero
remaining dubbl_ci_* databases; pg_ctl stopped the cluster in finally. Stopped
cluster files and sanitized test logs remain in OS temp. No application DB or
provider/external service was used.

Focused tests use actual production JSX, real next-intl/PresentationProvider,
controls and DrawerFooter, with controlled hooks/portals and IO. They execute
authored callbacks for canonical create/edit/delete/read payloads and failure
branches; validate escaping, parent options, count plurals, pending states,
selection toggle/clear, stale request handling, source copy inventory and Persian
script. The separate DB suite verifies real transports and persistence.

Initial focused failures found a missed document-title replacement; fixed with
UTF-8-safe patching. Test harness corrections share the real BrandLoader module
identity and constrain callback extraction to CategoryDrawer (the shared file
contains several handleSubmit functions). All final assertions pass. Read-only
exploration tried an incorrect app group/path and an invalid Windows rg glob;
corrected paths without unrelated edits. Parent planning's initial scheduler
order was adjusted explicitly with priorities before starting LOC-072.

## Review and limits

[Codex self-review](LOC-072-review-1.md) is not peer/human, native linguistic,
statutory accounting or browser approval. SSR leaves effects/portals controlled;
mounted keyboard and full RTL/date/numeral qualification remain open. Category
deletion has server-side graph semantics; this task preserves those services.
LOC-066/008/002 remain independent integration parents; remaining operations,
public/email/PDF authored templates and native terminology retain later owners.

No full build, dev server, Docker, deployment, hosted CI or dedicated Stripe work
ran. User authorized push through the request. Complete controller disposition,
commit owned files, push origin/master, confirm remote SHA and clean tree, report
next task and stop. Commit/push success is reported only after it occurs.
