# LOC-131 implementation and validation

## Scope and invariants

Selected live controller next LOC-131 from clean master after LOC-130/LOC-133.
Active PresentationProvider locale/numerals now reach normal inventory, project,
CRM, budget and payroll amounts, badges, input/example units, summaries and chart
units. See the exhaustive [caller/exception inventory](../registries/CURRENCY_UNIT_PRESENTATION.md#loc-131-inventory-projects-crm-budgets-and-payroll).

Payroll/project/budget helper signatures accept optional presentation; their
English default and fixed-two exact cents remain. Negative subunits and bigint
magnitudes are formatted from exact decimals, never Number. No saved scale,
request/response/ISO/header/filter/ID, API/MCP/DB/schema or financial operation was
changed. No new business operation requires a new MCP tool; existing tools stay
canonical. Existing output/download/issued snapshot and technical identifier
contracts stay unchanged. DEC-008 Stripe freeze is preserved.

## Commands and completed results

Working directory D:/Projects/dubbl. All test commands use
`node --import tsx --test --test-concurrency=1` followed by the named files below.

1. Initial scoped baseline/exploration group: 84 tests, 79 pass / 5 fail. Failures
   were Persian assertions still expecting English currency output in budget,
   CRM analytics/pipeline and valuation. Initial typecheck also identified an
   inventory formatter closure placed in its shell rather than workspace; fixed.
   These initial checks are NOT reported as passing.
2. Final focused command (exit 0), files:
   `tests/currency-operations-presentation.test.ts`,
   `tests/crm-analytics-catalogs.test.ts`,
   `tests/payroll-compensation-catalogs.test.ts`,
   `tests/budget-catalogs.test.ts`,
   `tests/inventory-report-catalogs.test.ts`,
   `tests/inventory-item-catalogs.test.ts`.
   **48/48 pass**, 20.1 seconds. Real production JSX through provider/next-intl
   asserts literal Persian ریال, exact signed/fixed-two compensation, budget
   tooltip/axis, inventory report scales, canonical IRR selector/query/org scope,
   escaping, English behavior and numeric callbacks. Helper cases independently
   cover en-US/fa-IR x latn/arabext and IRR/JPY/KWD/USD with zero, -1 and
   18014398509481983 fixed cents; no float round trip or unlike-unit sum.
3. Affected catalog/semantic regression command: files
   `tests/crm-activity-catalogs.test.ts`, `tests/crm-detail-catalogs.test.ts`,
   `tests/crm-pipeline-catalogs.test.ts`,
   `tests/inventory-variant-supplier-catalogs.test.ts`,
   `tests/payroll-analytics-catalogs.test.ts`,
   `tests/payroll-contractor-catalogs.test.ts`,
   `tests/payroll-employee-catalogs.test.ts`,
   `tests/payroll-employee-detail-catalogs.test.ts`,
   `tests/payroll-output-catalogs.test.ts`,
   `tests/payroll-overview-catalogs.test.ts`,
   `tests/payroll-run-catalogs.test.ts`,
   `tests/payroll-run-detail-catalogs.test.ts`,
   `tests/payroll-self-service-catalogs.test.ts`,
   `tests/payroll-settings-catalogs.test.ts`,
   `tests/payroll-tax-liability-catalogs.test.ts`,
   `tests/project-catalogs.test.ts`,
   `tests/project-collaboration-catalogs.test.ts`,
   `tests/project-milestone-catalogs.test.ts`,
   `tests/project-overview-catalogs.test.ts`,
   `tests/project-time-catalogs.test.ts`, `tests/payroll-ui-money.test.ts`,
   `tests/budget-project-crm-ui.test.ts`.
   Completed **170/173 pass**, three stale fixtures for grouped payroll display
   and employee/contractor raw placeholder/ISO text. These were updated to active
   numeral text and captured canonical CurrencySelect values. All mutation/wire
   assertions passed. This run is NOT claimed fully green.
4. Narrow corrected command with employee, contractor, payroll overview and
   project overview catalogs: 41/43 pass, two remaining drawer placeholder
   expectations. Payroll grouped output and project overview pass, including a
   new actual IRR overview test retaining project fixed-two units. Final narrow
   command `tests/payroll-employee-catalogs.test.ts tests/payroll-contractor-catalogs.test.ts`
   completes **23/23 pass**, exit 0, 10.0 seconds. All previously failing scoped
   cases therefore have passing rerun evidence; no monolithic/full-suite pass is
   claimed. An external whole-suite process was observed and left untouched;
   its results are not used as this task's evidence.
5. `pnpm typecheck`: final exit 0 (fumadocs-mdx + tsc --noEmit). Earlier test-only
   temporary currencyCode scope error was corrected before the final check.
6. Owned ESLint API lintFiles over the 76 changed/new TS/TSX files: **0 errors,
   0 warnings**. Initially found missing presentation memo dependency; fixed.
   A first shell invocation grouped the file paths into a single pattern and
   did not run; API-based lint checked each real path. Git CRLF notices on stderr
   affected its PowerShell status, so the structured lint result is the evidence.
7. `pnpm lint`: exit 0, **20 pre-existing warnings**, no errors; owned files clean.
8. `pnpm i18n:check`: exit 0, **10,702 paired keys** per locale.
9. `python .agentic/scripts/money_inventory.py --write` and
   `node --import tsx .agentic/scripts/verify_money_inventory.mjs`: pass,
   **417 columns / 1,860 consumer hashes**. JSON comparison with HEAD proves all
   417 `schema_columns` classification records unchanged; consumer locations and
   hashes refresh for edited source and the new unit test.
10. `node .agentic/scripts/verify_legacy_money.mjs`: all **nine** checks pass.
11. Controller structural validation, diff whitespace and UTF-8/no replacement
    character/Stripe-path checks pass. Structural validity alone is not evidence
    of implementation; actual source/render/callback results above supply it.

## Limits and handoff

No build, dev server, database operation, schema migration or application DB write
was performed. Existing user server/external processes were left untouched.
Prior session browser inventory was unavailable; this task does not claim browser
mount/hydration, RTL, native Persian, issued-output, hosted-CI or production money
qualification. Provisional names and existing IRR activation gates remain as-is.

LOC-132 remains the remaining reports/settings/public task; LOC-115 independently
accepts whole-website integration. This child does not close either. Parent
supervisor handles push after the next fresh agent task commit. Review is honest
self-review, not peer/native/owner acceptance.
