# Auxiliary and report integration contracts (MON-015)

Verified 2026-10-10, Asia/Tehran. This parent joins MON-023..029 after their
independent acceptance. Their operation inventories remain the detailed source
for every REST path, MCP name, field/default, output envelope, units, permission,
alias, retry/period rule and supported business range. Technical self-review
does not replace independent accounting or release qualification.

| Complete adopted boundary inventory | Inputs, outputs, units and limits | Current integration fixture |
|---|---|---|
| [Budget CRUD](BUDGET_WIRE_CONTRACTS.md) | Five CRUD pairs, signed numeric total/amount cents and agreeing Minor strings; generated/explicit periods and total precedence; 500 lines/10000 periods; authenticated scoped reads, manage:budgets writes | budget-wire; auxiliary-report-integration |
| [Inventory and costing](INVENTORY_INTEGRATION_CONTRACTS.md) | All catalog/master/movement/valuation/landed-cost/BOM/assembly operations and procurement/sales bridges; integer money aliases, physical quantities and exact quantities remain distinct; saved carrying value is authoritative | inventory-integration |
| [Payroll](PAYROLL_INTEGRATION_CONTRACTS.md) | Seven complete master/config/time/run/payment/compensation/output maps; annual salary and hourly rates are cents, hours and basis points are separate; posted/pay-slip/FX snapshots and safe signed corrections | payroll-integration |
| [Assets and loans](ASSET_LOAN_INTEGRATION_CONTRACTS.md) | 25 asset/category/depreciation/valuation/CWIP/loan pairs plus settings; safe numeric fixed cents and Minor; REST loan numeric principal is decimal major, MCP numeric principal is integer cents; months, readings and annual basis points are nonmoney | asset-loan-integration |
| [Projects, CRM and pricing](PROJECT_CRM_PRICING_INTEGRATION.md) | 81 pairs and singular project cost adapter; fixed cents, saved member/time/milestone allocations, cents per hour, physical minutes/quantities, percentages; legacy document price adapters retain their own units | project-crm-pricing |
| [Consolidation and auxiliary configuration](CONSOLIDATION_AUXILIARY_INTEGRATION_CONTRACTS.md) | 31 configuration/report/accrual/revenue/recurring pairs plus job/manual generation and settings; REST accrual/revenue numeric input is decimal major, MCP is cents; recurring prices are decimal major in both; translated reports are presentation fixed cents, exact FX remains quote_per_base | consolidation-auxiliary-integration |
| [Reports and dashboards](REPORT_DASHBOARD_INTEGRATION_CONTRACTS.md) | All six budget/financial/contact-aging/tax/operational/dashboard families, exports, saved configuration and scheduled consumers; numeric cents or fixed two-place legacy strings plus Minor siblings, distinct currency-scaled file cells, ratios/counts/dates and opaque JSON | report-dashboard-integration; dashboard-report-integration |

Fixture names refer to tests/integration/*.test.ts and their actual workers.
The linked maps cover suboperations, including CSV/export, rounding, nullable and
signed values, unsupported tracked/location workflows, posting currency and
history restrictions. Core procurement/document/journal writers and public,
provider, backup, generic import/export and opaque boundaries retain their own
owners; this parent does not duplicate those contracts.

## Compatibility and authorization

All public numeric coexistence remains bounded by +/-9007199254740991, further
restricted by each field's sign, resource, decimal and calculation limits. Exact
integer aliases are canonical ASCII strings in the same saved units; they do not
advertise full-int64 business support or a client representation selector.
SQL-text/numeric and bigint intermediates preserve exact sums/products before
guarded public conversion. Unsupported inputs/history return classified 422
LEGACY_NUMERIC_RANGE; malformed or conflicting aliases reject before writes.
Locale, currency tags, physical quantities, dates and FX never imply rescaling.
Real Gregorian date-only values and UTC instants retain their separate meanings.

Every service remains scoped by AuthContext, with actual REST authentication and
the child-specific permission policy. Budget/inventory/project/loan master reads
retain authenticated-member access; employee/asset/accrual detail requires its
documented management permission. Reports retain view:data and consolidation
membership rules. A conflicting organization header cannot retarget an API key.
Unauthorized writes and foreign root lookups reject without domain/audit changes.

MON-015 reproduced create_budget accepting an unknown organizationId and creating
a budget because raw-shape registration and non-strict schemas stripped controls.
All five CRUD MCP registrations now pass full strict objects to registerTool.
Shared create/update/line/period schemas also reject unknown REST and nested
controls. update_budget removes its routing budgetId before shared body parsing.
Valid defaults, fields, aliases, responses, permissions and units are preserved.
Both budget UI writers explicitly project these allowed line/period fields.

## Independent parent fixture

auxiliary-report-integration creates budget, inventory, employee, asset, loan,
project and accrual records in one organization through actual numeric REST and
exact full-registry MCP calls. Legacy REST 1250 cents, including loan/accrual
12.50 major inputs, and exact MCP 2147483750 cents read back across both transports
with unchanged numeric/Minor aliases. Both clients exercise unsupported int64,
conflicting aliases, denied writes and foreign detail IDs. SDK unknown organization
controls reject for every integrated create. All five budget CRUD registrations,
nested line/period controls and REST create/update controls have no-write checks;
valid SDK update/list/delete still work.

Two actual cross-transport accrual postings produce balanced journals totaling
2147485000 expense cents. A new budget matches those postings with zero variance;
REST/MCP P&L net income is -2147485000, and a same-currency consolidation member
reports that identical loss. The other unposted masters/plans invent no GL costs.
Targeted cross-transport replay creates no extra journal/audit, and functional
currency changes reject against existing history. Unsupported stored GL amounts
fail consistently through P&L, budget and consolidation with no financial writes.

Assertions capture every public database table in one query, excluding only
api_key authentication lastUsedAt bookkeeping. Read, rejection and replay checks
thus preserve all domain/reference/configuration/financial/audit rows together.
Fixtures opt into a synthetic loopback TEST_DATABASE_URL; each database is random,
migrated and dropped. No dev server, application DB or external provider is used.
Parent domain regressions qualify deeper postings, procurement/stock bridges,
payroll snapshots, asset/loan lifecycles, billing/pricing/CRM, recurring/revenue,
tax/dashboard/export/report and cross-writer races on independent fresh databases.

## Retained qualification

Separate operations keep separate database snapshots. Report equality above is
for this matching recognized dataset, not a universal economic reconciliation.
Existing trial-balance/accounting defects remain PAR-008/QA-001; heuristics,
best-effort audit/email delivery and historical bad-data remediation retain the
linked limitations. Full-int64 business/UI cutover, high-volume performance,
migration/IRR enablement, independent accounting/statutory review, session/OAuth,
Persian/RTL and production release gates remain separate. No schema, stored-unit
conversion, flag, deployment or client sunset changes here.
