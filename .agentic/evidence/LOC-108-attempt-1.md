# LOC-108 attempt 1 - Analytical and comparison report catalogs

2026-10-22, Codex, D:/Projects/dubbl, master at 07006fe4 with a clean tree after
the owner's first requested task commit. Controller next selected LOC-108 and
it was started with owner codex. The owner explicitly requested two sequential
tasks and local commits; no push is authorized or performed. No subagents,
build or dev server were used. Stripe is unchanged under DEC-008.

## Acceptance mapping and implementation

1. Added 100 paired AnalyticalReports messages across six pages: tracking,
   budget-vs-actual, expense-analytics, profitability, pnl-comparison and
   financial-ratios. This includes the shared BudgetProgressBar's complete
   amount messages needed by budget comparisons. All authored page JSX copy,
   known tracking headings/sections, selections, totals, empty states, counts,
   chart names, ratio explanations/day units and failures are catalogued.
   Existing namespaces compare structurally equal to HEAD; every new Persian
   message contains Persian script. Explicit data/date/number/export exceptions
   and shared ownership are in ANALYTICAL_REPORT_CATALOGS.md.
2. Nine focused tests render production JSX/readers with real next-intl and
   PresentationProvider/shared controls, controlling page hooks, IO and animation.
   Both locales cover complete tracking help/sections/unassigned labels,
   caller escaping, exact amounts, canonical drilldown/XLSX queries, selections,
   fixed budget cents and progress, expense counts/trends, signed profitability,
   exact chart tooltips under translated names, all ratios/explanations/units,
   null ratios, date callbacks, empty/loading/failure states, missing organization,
   HTTP/JSON/money/network failures before adoption and cancelled effects.
   Existing migrated REST/MCP/SQL suites cover the underlying data operations.
3. Task handoff, registry, this evidence and honest self-review preserve
   independent LOC-070/008/002, native terminology and full RTL qualification.

The comparison chart chooses its exact tooltip carrier by canonical dataKey,
independently of translated legend names. No floating-point monetary calculations
are added. Existing chart geometry remains approximate while tooltip carriers,
tables, totals and stored units stay exact. Budget progress assertions now render
through the production presentation provider, preserving their financial checks.
The old source guard requiring English Revenue was updated to require dataKey;
new callback tests independently assert both carriers in both languages.

Queries, route/export paths, organization headers, tracking dimension/mode/basis,
none sentinel, account hash IDs, budget IDs, comparison/period values, service
money readers, budget fixed cents, ratio values/colors and cleanup guards remain.
All six workflows already have registered direct scoped MCP operations; no new
operation, REST/MCP/auth/schema/migration/money/FX/IRR flag change is introduced.

## Actual verification

All commands ran at repository root.

| Command | Result |
|---|---|
| node --import tsx --test tests/analytical-report-catalogs.test.ts | 9/9 pass, zero skips |
| node --import tsx --test --test-concurrency=1 tests/analytical-report-catalogs.test.ts tests/aging-vendor-report-catalogs.test.ts tests/analytical-report-ui.test.ts tests/report-result-ui.test.ts tests/financial-statement-ui.test.ts tests/budget-project-crm-ui.test.ts tests/message-catalogs.test.ts | Final 57/57 pass, zero skips, 117.095 seconds |
| pnpm typecheck | Final pass, including new test fixture callback annotation; fumadocs-mdx and tsc --noEmit |
| pnpm i18n:check | Pass, 9,140 compatible keys per locale |
| Explicit loopback TEST_DATABASE_URL and PG_BIN; node --import tsx --test --test-concurrency=1 tests/integration/compound.test.ts tests/integration/kpi-analytics.test.ts tests/integration/financial-statement-ui.test.ts tests/integration/budget-project-crm-ui.test.ts | 4/4 pass, zero skips; actual REST/registered MCP/SQL |
| pnpm exec eslint on six pages, BudgetProgressBar, focused tests and report-page helper | Pass, no findings |
| pnpm lint | Final pass, zero errors and 24 pre-existing warnings outside owned files |
| python .agentic/scripts/money_inventory.py --write; node --import tsx .agentic/scripts/verify_money_inventory.mjs | Final pass, 417 columns and 1,827 consumers; generated hashes/occurrence lines consistent |
| node .agentic/scripts/verify_legacy_money.mjs | Nine regression checks pass |
| Structured catalog/inventory comparison | 100 added keys per locale; existing namespaces and schema classifications unchanged; owned consumer changes only, including the updated financial-statement source guard |
| python .agentic/agent.py validate; git diff --check | Pass, 347 structurally valid tasks; whitespace check passes |

PostgreSQL 18 used the unique OS-temp cluster from LOC-107 on 127.0.0.1:6487,
trust auth and max_locks_per_transaction=256. Suites migrated and dropped random
disposable databases. Final admin SQL found zero dubbl_ci_* databases; pg_ctl
stopped the cluster. Neither task used application DB credentials or data.

Initial broad regression: 56/57 passed; the sole failure was the obsolete English
legend source assertion described above. An overlapping full lint run was
deliberately stopped when the 16 GB host had only 106 MB physical memory free;
it did not report a lint failure. Final bounded regression/static results are recorded above. A final typecheck also identified one implicit-any callback in the new budget test fixture; an explicit fixture row type corrected it without runtime changes.

## Review and handoff

See LOC-108-review-1.md for actual self-review. Persian terminology is provisional.
Full suite, mounted browser/keyboard/layout, full RTL/calendar/numerals, native
linguistic, adjacent PDF/XLSX content, hosted CI, deployment and production
qualification are not claimed. No human gate is waived. LOC-070/008/002 remain
independent; next bounded task is LOC-109. Local commit SHA is reported after
controller closure.
