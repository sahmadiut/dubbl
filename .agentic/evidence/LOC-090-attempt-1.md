# LOC-090 attempt 1 - payroll analytics, forecasting and reports catalogs

## Identity and scope

2026-10-21 (Asia/Tehran), Codex, `D:/Projects/dubbl`, master.
Entry HEAD `40fa242feb992ca4b008d850194515d21dc8d759`; clean entry tree.
Live controller validate/status/next selected LOC-090. Started exactly that
child with owner codex. Origin fetch confirmed zero ahead/zero behind.
User authorized completion and push. No subagents. The memory controller-task
skill guided workflow; current controller, instructions and source governed
scope and acceptance.

Read root rules, START_HERE, frontend role, controller/project/repository map,
selected task and parent boundary, catalog contract, referenced locale/source
sections and dependency review. Inspected all four owned routes, payrollJson,
cent input/display adapters, authenticated CSV helper, report/forecast service
and wire schemas, route fixtures and registered MCP operations.

A concurrent, unrelated one-line `font-mono` edit appeared in
`app/(dashboard)/settings/members/page.tsx` after the clean entry inspection.
It is preserved and excluded from the task commit. The scoped money inventory
retains that file's committed baseline hash, so its local change is not silently
published through generated metadata. Final index verification checks consumer
hashes against the actual staged/committed source snapshot.

## Acceptance mapping

1. Extracted all authored copy from analytics, forecasting, report list and
   report detail into 64 paired `PayrollAnalytics` messages. Catalogs contain
   7,877 compatible keys per locale. Every Persian message includes Persian
   letters; employee counts use ICU plural handling. Explicit exceptions and
   output ownership are in the [scope registry](../registries/PAYROLL_ANALYTICS_CATALOGS.md).
2. Real production templates render with actual next-intl/PresentationProvider
   in both locales. Controlled hooks/IO invoke production read/filter/scenario/
   navigation/export callbacks. Checks cover low/high/signed exact cents, ICU
   counts, escaping, four report kinds, empty/busy/error states, HTTP/JSON/
   envelope/money failures, missing org/storage and obsolete reads. Real migrated
   REST and linked MCP envelopes pass the reader alongside independent SQL
   and authorization assertions in the existing fixtures.
3. Task handoff, scope registry, catalog index and honest Codex self-review
   record provisional Persian wording and independent parent/native/RTL gates.

## Resulting behavior and preserved boundaries

The new reader checks HTTP success, envelope/row shape, canonical exact aliases,
currencies, counts, months and scenario differences before state adoption.
Analytics adopts summary and projection atomically. All reads use a cancellable
asynchronous lifecycle; obsolete fulfillment/rejection cannot update state.
Missing organization or unavailable storage releases loading with translated
feedback. Report filters remain available after a failed request; previous data
is hidden until a successful checked read. Scenario failures retain form fields,
clear previous results and release busy state. Raw network, backend, parser,
money-adapter and CSV diagnostics no longer render as product copy.

Report summary headings use a finite field-to-message list. Known summary
fields remain displayed with their original counts/money distinction. Machine
report types, URLs, methods, header, Gregorian query values, scenario payload
fields/defaults and 12-month horizon remain. Currency codes and fixed-two legacy
payroll cents do not infer ISO scaling or currency from language. Labor costs
retain separate department/currency groups. Numeric counts/percentages remain
separate from money. Server aggregation/rounding and all CSV bytes/filename/
formula protection remain unchanged. Saved employee/department names are escaped
data; the service's ambiguous Unassigned fallback is documented explicitly.

Existing REST/MCP operations already cover every operation in this slice.
No new tool or user operation, backend/service/auth change, schema/migration,
stored-money change, statutory extension, provider request, IRR flag or Stripe
change was made. The integration-worker changes only apply the reader to actual
success envelopes before existing assertions.

## Actual verification

All commands ran from `D:/Projects/dubbl`.

| Check | Actual result | Boundary |
|---|---|---|
| Final focused catalog/rendering/callback, money and wire checks | 32/32 pass; zero skips; 15.875 seconds | Production JSX/next-intl; controlled hooks/IO |
| Migrated compensation and output fixtures | 3/3 pass; zero skips; 165.935 seconds | Real REST/linked MCP plus SQL and migration preservation |
| Final typecheck | Exit 0 | fumadocs-mdx and tsc --noEmit |
| Final catalog validation | Exit 0; 7,877 compatible keys per locale | No native linguistic qualification |
| Final owned-file ESLint | Exit 0; zero errors/warnings | Four routes, reader, focused/source-guard tests and two workers |
| Final full lint | Exit 0; zero errors, 27 existing warnings elsewhere | Full source lint with OS-temp cache |
| Money inventory/source and legacy gates | Exit 0; 417 columns, 2,399 scanned paths, 1,790 consumer hashes; nine legacy checks | Source/contract guards |
| Staged snapshot verification | All 1,790 consumer hashes match index blobs; schema columns unchanged | Separate from the preserved local settings edit |
| Controller validation and diff check | Pass during implementation | Repeat after closure |

```text
node --import tsx --test tests/payroll-analytics-catalogs.test.ts tests/payroll-ui-money.test.ts tests/payroll-output-wire.test.ts tests/payroll-compensation-wire.test.ts tests/message-catalogs.test.ts
node --import tsx --test --test-concurrency=1 tests/integration/payroll-compensation.test.ts tests/integration/payroll-outputs.test.ts
pnpm typecheck
pnpm i18n:check
node node_modules/eslint/bin/eslint.js "app/(dashboard)/payroll/analytics/page.tsx" "app/(dashboard)/payroll/forecasting/page.tsx" "app/(dashboard)/payroll/reports/page.tsx" "app/(dashboard)/payroll/reports/[type]/page.tsx" i18n/payroll-analytics-presentation.ts tests/payroll-analytics-catalogs.test.ts tests/payroll-ui-money.test.ts tests/integration/payroll-outputs-worker.ts tests/integration/payroll-compensation-worker.ts
pnpm lint --cache --cache-location <OS-temp>/dubbl-loc090-eslint.cache
python .agentic/scripts/money_inventory.py --write
python .agentic/scripts/money_inventory.py
node --import tsx .agentic/scripts/verify_money_inventory.mjs
node .agentic/scripts/verify_legacy_money.mjs
python .agentic/agent.py validate
git diff --check
```

PostgreSQL 18 ran from an OS-temp cluster, listening only on 127.0.0.1:6456
with trust authentication and max_locks_per_transaction=256. Process-scoped
TEST_DATABASE_URL/PG_BIN targeted it; fixtures created/dropped randomized
databases. Final admin query found zero `dubbl_ci_*` databases. pg_ctl stopped
the isolated server successfully. No application database/credentials used.

Parsed catalog comparison confirms only PayrollAnalytics changed in each locale.
The inventory retains all schema columns/classifications, units and declarations;
only scanned paths and owned source/test/catalog consumer hashes/references
change in the scoped commit. The unrelated settings hash remains at baseline.

Intermediate checks caught an accidentally removed cn import and hook-harness
serialization/control lookup problems; those were corrected. Final production
read lifecycle satisfies ESLint without rule suppression. Cleanup tests wait
until requests are in flight before proving obsolete replies are ignored.
Final typecheck, focused checks and owned lint cover the resulting source.
The first full lint inspected intermediate callbacks and reported two synchronous
effect-state errors. The final lifecycle corrected them; final full lint passes
with zero errors and 27 existing warnings outside this task. No suppression added.

Index verification decoded staged MONEY_BOUNDARIES.json, read all consumer blobs
with git ls-files --stage and git cat-file --batch, and compared LF-normalized
SHA-256 values for all 1,790 paths. Every hash matches. Schema columns are equal
to HEAD, only PayrollAnalytics changed in either catalog, and all 11 changed
consumer entries belong to this task. Both the index settings source and its
inventory entry match HEAD, while the unrelated working source edit is preserved.
The full working-source inventory gates passed before excluding that unrelated
hash; rerunning them against the dirty local settings source would appropriately
report its uncommitted drift.

## Review and handoff

See [Codex self-review](LOC-090-review-1.md). This is self-review, not independent
peer, human, native or accounting approval. LOC-067/008/002 combined acceptance,
native Persian terminology, complete RTL/calendar/numerals, mounted browser/
keyboard, hosted CI, deployment and production qualification remain separate.
No full build, dev-server start, Docker, deployment or dedicated Stripe work ran.
Full unit-suite and full payroll integration-parent qualification were not run;
focused checks were selected for this four-route catalog slice.

Controller closure, scoped commit and authorized push follow verified checks;
report remote synchronization only after checking the actual remote SHA.
