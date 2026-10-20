# LOC-077 attempt 1 - inventory assembly catalogs

## Identity and scope

2026-10-20 (Asia/Tehran), coding-assistant/Codex, `D:/Projects/dubbl`, master.
Entry HEAD `50dce0109453045fe13529396319799890646393`. Controller
validate/status/next selected LOC-077 for resume. Entry tree already contained
the in-progress LOC-077 task, three route edits, paired catalogs, presentation
reader, integration/source-test edits and a task editing script. Reviewed and
completed those task-owned changes; removed the temporary editing script.
User authorized completing and pushing the next task. Fresh origin fetch showed
zero ahead/zero behind. No subagents used. The memory controller-task skill
guided the workflow, checked against current repository instructions/state.

## Acceptance mapping and implementation

1. Added 84 paired `InventoryAssembly` messages, 6,964 compatible keys per
   locale. Extracted authored display across BOM list/detail and assembly orders,
   including examples, plural summaries, cost/quantity/wastage prose, document
   titles, status labels, actions, confirmation cancel overrides, accessible
   action labels and finite read/write feedback. [Scope and exceptions](../registries/INVENTORY_ASSEMBLY_CATALOGS.md)
   inventories the three routes and independent parent/native/RTL handoff.
2. Eleven focused tests execute production JSX/callback/effect bodies with
   real next-intl and PresentationProvider and controlled hooks/portal/network
   boundaries. They cover both locales, empty/saved/detail/loading/error states,
   USD/JPY/KWD exact low digits, plural summaries, caller escaping, finite
   statuses, canonical requests, cancellation, malformed HTTP/JSON/envelopes,
   failed-write retention, missing organization, disposed reads, Persian script
   and authored-source audits. The migrated fixture feeds real authenticated
   REST and registered MCP payloads through the new readers. Independent SQL
   text checks verify whole stock quantities, carrying values and journal sums;
   existing org/permission/cost-flow/audit/atomic rollback checks remain.
3. Scope/catalog registries, task handoff and honest self-review retain
   provisional Persian and independent LOC-066/008/002/native/RTL acceptance.

The shared presentation reader validates status/JSON/envelopes and displayed
fields before adoption/success, reusing all three existing exact-money BOM,
detail and assembly validators. Money, numeric/Minor agreement, physical
decimal aliases, currency scales and saved estimate checks are retained.

PATCH and completion responses contain headers without nested BOMs. Verified
header fields merge into the existing displayed order without overwriting its
recipe. Failed mutations preserve rows and use finite localized feedback,
never raw server/parser/network text. Deletes require `success: true`.
Verified removal is not reported as failed when the follow-up GET fails;
stale detail data clears and localized read feedback appears. Missing
organization prevents requests/ends loading, and read cleanup ignores disposed
results. Existing routes, methods, organization headers, IDs/query parameters,
status codes, whole-unit order payloads and exact saved decimals are unchanged.

Source inspection found no BOM/assembly creation forms in these routes or
creation drawers in the shared surface. Existing org-scoped REST/MCP tools
already cover every operation. No production REST/MCP/service/auth/schema/
migration, ledger/stock-posting, currency/FX/IRR or Stripe source changed.

Money inventory refresh adds two scanned paths and changes/adds nine owned
consumer records. All 417 schema-column records remain identical; MONEY_COLUMNS
has no semantic diff. The source guard follows the presentation reader to its
unchanged exact-money validators.

## Verification

Commands ran from `D:/Projects/dubbl` with installed dependencies.

| Check | Observed result | Limit |
|---|---|---|
| Focused assembly catalog/render/behavior plus money/wire suites | 22/22 passed, including 11 new focused tests; 2.126 seconds | Controlled hooks/IO, not mounted browser |
| Full unit/static suite, concurrency 1 | 1,106/1,106 passed, no skips; 1,341.564 seconds | Local, not hosted CI |
| Migrated assembly REST/MCP/SQL suite | 1/1 passed, no skips; 37.794 seconds | Disposable synthetic PostgreSQL |
| `pnpm typecheck` and final `pnpm exec tsc --noEmit` | Both passed, exit 0 | No full build |
| `pnpm i18n:check` | Passed, 6,964 keys per locale | Not native approval |
| Owned TypeScript ESLint, seven files | Passed, zero errors/warnings after unused test variable removal | Owned sources/tests |
| Full `pnpm lint` | Passed, zero errors, 60 remaining warnings; none in owned files | Repository lint |
| Money inventory write/check and exact loader | Passed, 417 columns, 1,763 consumers | Conservative lexical inventory |
| Legacy money guard | Nine regression checks passed | Existing guard scope |
| Controller validate and `git diff --check` | Passed; repeat after controller completion | Structural validation only |

```text
node --import tsx --test tests/inventory-assembly-catalogs.test.ts tests/inventory-ui-money.test.ts tests/inventory-assembly-wire.test.ts
node --import tsx --test --test-concurrency=1 tests/*.test.ts
node --import tsx --test --test-concurrency=1 tests/integration/inventory-assembly.test.ts
pnpm typecheck
pnpm exec tsc --noEmit
pnpm i18n:check
node node_modules/eslint/bin/eslint.js "app/(dashboard)/inventory/bom/page.tsx" "app/(dashboard)/inventory/bom/[id]/page.tsx" "app/(dashboard)/inventory/assembly/page.tsx" i18n/inventory-assembly-presentation.ts tests/inventory-assembly-catalogs.test.ts tests/inventory-ui-money.test.ts tests/integration/inventory-assembly-worker.ts
pnpm lint
python .agentic/scripts/money_inventory.py --write
python .agentic/scripts/money_inventory.py
node --import tsx .agentic/scripts/verify_money_inventory.mjs
node .agentic/scripts/verify_legacy_money.mjs
python .agentic/agent.py validate
git diff --check
```

Integration used a fresh OS-temp PostgreSQL 18 cluster bound only to
127.0.0.1:6332 with explicit process-scoped TEST_DATABASE_URL/PG_BIN, loopback
trust authentication and max_locks_per_transaction=256. Each fixture created,
migrated and dropped its randomized database. Admin SQL confirmed zero remaining
`dubbl_ci_*` databases and pg_ctl stopped the cluster in finally after each run.
Sanitized logs/stopped cluster artifacts remain in OS temp. No application DB
was used.

Initial focused tests exposed test-harness assumptions about button whitespace,
the shared loader's module context and the interpolation-only Persian orderName
exception. Those checks were corrected without weakening production behavior.
The first integration run caught an assertion expecting padded recipe quantity
`1.00000000`; the actual saved/wire decimal is `1.0`, which the reader preserves.
The assertion was corrected, and the rerun passed. An owned lint warning for an
unused test variable was removed and owned lint rerun clean. A four-worker full
suite was terminated under host memory pressure, then restarted with one worker;
that interrupted attempt is not counted as a pass.

## Review and handoff

See [Codex self-review](LOC-077-review-1.md). Persian wording
remains provisional. LOC-066/008/002, native financial terminology, full
RTL/date/numeral/input, mounted browser/keyboard, output, hosted CI/deployment
and production qualification remain independent. No full build, unrequested dev
server, application DB/provider, deployment or dedicated Stripe work ran.
All checks above passed. Record self-review and controller acceptance,
commit task-owned files, push origin/master, verify remote SHA and clean tree,
report live next task and stop. Commit/push outcomes are reported only after
they occur.
