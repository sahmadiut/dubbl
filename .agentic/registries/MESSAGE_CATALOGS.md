# Message catalog foundation

LOC-098 project members, team assignments and notes use 94 paired messages in
`ProjectMembers` and `ProjectNotes` (8,551 compatible keys per locale). See
[scope and exceptions](PROJECT_COLLABORATION_CATALOGS.md) for checked feedback,
role/count/time presentation and preserved cents/REST/MCP contracts. Persian
wording remains provisional; LOC-068/008/002 and native/RTL acceptance remain
independent.

LOC-095/096/097 project tasks, time/timers and milestones/progress invoices
use 215 paired messages across `ProjectTasks`, `ProjectTime` and
`ProjectMilestones` (8,457 compatible keys per locale). See
[batch scope and exceptions](PROJECT_TASK_TIME_MILESTONE_CATALOGS.md).
Each child retains separate evidence; LOC-068/008/002, LOC-098 and native/RTL
qualification remain independent. Persian wording remains provisional.

LOC-094 project overview/navigation use 89 paired `ProjectOverview` messages
(8,242 compatible keys per locale). See [scope and exceptions](PROJECT_OVERVIEW_CATALOGS.md)
for shared header/charts/calendar, checked reads/invoicing and preserved exact
cents, dates and REST/MCP contracts. Persian wording remains provisional;
LOC-068/008/002 and native/RTL qualification retain independent acceptance.

LOC-067 independently accepts the combined payroll catalog slice after
LOC-079..092: 27 route components, two creation drawers and 1,043 paired messages
across 14 namespaces (8,053 compatible keys per locale). See
[combined ownership, output/error exceptions and behavior](PAYROLL_CATALOG_ACCEPTANCE.md).
LOC-008/002 and native terminology, full RTL/calendar/numerals, output and release
qualification remain independent. Persian wording is provisional.

LOC-092 payroll settings use 124 paired `PayrollSettings` messages (8,053
compatible keys per locale). See [scope and exceptions](PAYROLL_SETTINGS_CATALOGS.md)
for the eight sections/five drawers, checked feedback and preserved configuration,
exact cents, hours and REST/MCP contracts. Persian wording is provisional;
LOC-067/008/002 and native/RTL qualification remain independent.

LOC-091 payroll tax liabilities use 52 paired `PayrollTaxLiabilities` messages
(7,929 compatible keys per locale). See
[scope and exceptions](PAYROLL_TAX_LIABILITY_CATALOGS.md) for checked liability,
history and posting feedback, preserved exact cents/idempotency/statutory and
REST/MCP contracts, and provisional Persian terminology. LOC-067/008/002 and
native/RTL qualification remain independent.

LOC-089 compensation list and review detail use 82 paired
`PayrollCompensation` messages (7,813 keys per locale). See
[scope and exceptions](PAYROLL_COMPENSATION_CATALOGS.md) for checked read/create
feedback, provisional Persian and preserved band/review/equity, exact cents and
REST/MCP contracts. LOC-067/008/002 and native terminology/RTL remain independent.

LOC-088 payroll self-service uses 42 paired `PayrollSelfService` messages
(7,731 keys per locale). See [scope and exceptions](PAYROLL_SELF_SERVICE_CATALOGS.md)
for checked profile/history/save feedback, provisional Persian and preserved
employee identity, physical hours, exact cents and REST/MCP contracts.
LOC-067/008/002 and native terminology/RTL qualification remain independent.

LOC-087 payroll leave and timesheet list/detail routes use 95 paired
`PayrollTimeDetail` messages (7,689 keys per locale). See
[scope and exceptions](PAYROLL_TIME_DETAIL_CATALOGS.md) for checked detail,
creation, entry and lifecycle feedback, provisional Persian and preserved
canonical dates, physical hours, exact money and REST/MCP contracts.
LOC-067/008/002 and native terminology/RTL qualification remain independent.

LOC-086 payroll time and leave uses 75 paired `PayrollTimeLeave` messages
(7,594 keys per locale). See [scope and exceptions](PAYROLL_TIME_LEAVE_CATALOGS.md)
for checked list/choice/create/approval feedback, provisional Persian and
preserved physical hours, canonical dates, exact money and REST/MCP contracts.
LOC-067/008/002 and native terminology/RTL qualification remain independent.

LOC-085 payslip and tax form list/detail use 83 paired `PayrollOutputs`
messages (7,519 keys per locale). See [scope and output ownership](PAYROLL_OUTPUT_CATALOGS.md)
for checked reads/view/generation/download feedback, statutory/metadata labels,
adjacent generated JSON ownership and preserved exact cents/REST/MCP contracts.
LOC-067/008/002 and native terminology/RTL qualification remain independent.

LOC-084 payroll run detail uses 99 paired `PayrollRunDetail` messages (7,436
keys per locale). See [scope and exceptions](PAYROLL_RUN_DETAIL_CATALOGS.md)
for checked detail/lifecycle/bonus/generation feedback and preserved exact
cents, approval, calculation, posting and REST/MCP contracts.
LOC-067/008/002 and native terminology/RTL qualification remain independent.

LOC-083 payroll run list and regular/off-cycle creation use 71 paired
`PayrollRuns` messages (7,337 keys per locale). See
[scope and exceptions](PAYROLL_RUN_CATALOGS.md) for checked choice/read/create
feedback and preserved lifecycle, signed cents, PTO and REST/MCP contracts.
LOC-067/008/002 and native terminology/RTL qualification remain independent.

LOC-082 contractor list/detail and ContractorDrawer use 74 paired
`PayrollContractors` messages (7,266 keys per locale). See
[scope and exceptions](PAYROLL_CONTRACTOR_CATALOGS.md) for checked read/mutation
feedback and preserved cents, payment status and REST/MCP contracts.
LOC-067/008/002 and native terminology/RTL qualification remain independent.

LOC-081 employee detail uses 92 paired `PayrollEmployeeDetail` messages (7,192
keys per locale). See [scope and exceptions](PAYROLL_EMPLOYEE_DETAIL_CATALOGS.md)
for profile, compensation, deductions, tax, leave and deletion presentation,
checked response envelopes and preserved exact money/statutory machine values.
LOC-067/008/002 and native terminology/RTL qualification remain independent.

LOC-080 employee list and EmployeeDrawer use 46 paired `PayrollEmployees`
messages (7,100 keys per locale). See [scope and exceptions](PAYROLL_EMPLOYEE_CATALOGS.md)
for safe read/create feedback and preserved cents, basis points, dates and
employee identifiers. LOC-067/008/002 and native terminology/RTL qualification
remain independent.

LOC-066 independently accepts combined inventory coverage in
[inventory catalog acceptance](INVENTORY_CATALOG_ACCEPTANCE.md): all 18 route
files, five creation drawers and three shared pickers, with eight namespaces
and 682 paired messages. Complete catalogs retain 7,010 compatible keys per
locale. Earlier child entries below record their acceptance boundaries at the
time; LOC-008/002, native terminology and full RTL qualification remain open.

LOC-078 valuation and alerts use 46 paired `InventoryReports` messages (7,010
keys per locale). See [scope and exceptions](INVENTORY_REPORT_CATALOGS.md) for
exact valuation, canonical CSV, saved reorder/supplier display and finite read
feedback. The existing shared inventory loader is verified in both locales.
LOC-066/008/002 and native terminology/RTL qualification remain independent.

LOC-075 warehouse management, WarehouseDrawer and WarehousePicker use 77 paired
`Warehouses` messages (6,712 keys per locale). See
[scope and exceptions](WAREHOUSE_CATALOGS.md) for location/default contracts,
nullable history, safe feedback and picker selection. LOC-066/008/002 and native
terminology/RTL qualification remain independent.

LOC-074 variant/supplier item routes use 54 paired `InventoryCatalogs` messages
(6,635 keys per locale). See [scope and exceptions](INVENTORY_VARIANT_SUPPLIER_CATALOGS.md)
for exact price/count/lead-time preservation, nullable history and safe feedback.
LOC-066/008/002 and native terminology/RTL qualification remain independent.

LOC-073 item list/workspace/details/history, InventoryDrawer and item picker use
208 paired `InventoryItems` messages (6,581 keys per locale). See
[inventory item scope and exceptions](INVENTORY_ITEM_CATALOGS.md) for canonical
CSV/money/REST/MCP preservation, safe response validation and barcode escaping.
LOC-066/008/002 and native terminology/RTL qualification remain independent.

LOC-007 independently accepts the combined accounting, sales, purchasing,
contacts and tax catalogs in [combined acceptance](ACCOUNTING_SALES_PURCHASING_CATALOG_ACCEPTANCE.md):
all 87 route files and owned shared forms, 53 namespaces and 4,142 paired messages.
Complete catalogs retain 6,328 compatible keys per locale. Earlier entries below
record child acceptance boundaries at the time; LOC-007 is now independently
accepted. LOC-002, native terminology and full RTL qualification remain open.

LOC-027 independently accepts combined contacts coverage in
[contacts catalog acceptance](CONTACT_CATALOG_ACCEPTANCE.md): all nine route
files, the picker and creation drawer, with 295 paired contacts messages.
LOC-007/002, native terminology and complete RTL qualification remain independent.

LOC-026 independently accepts combined purchasing coverage in
[purchasing catalog acceptance](PURCHASING_CATALOG_ACCEPTANCE.md): all 18 route
files, four creation drawers and shared controls, with 863 purchasing messages
and 38 reused DocumentForms messages. LOC-007/002, native terminology and
complete RTL qualification remain independent.

LOC-056 purchasing navigation uses the paired `PurchasingNavigation` namespace.
Shared purchasing form/preview/loading ownership is reconciled without duplicate
extraction in [scope and exceptions](SHARED_PURCHASING_CATALOGS.md).
LOC-026/007/002 and native/RTL acceptance remain independent.

LOC-055 landed cost list/detail and inline creation/allocation feedback use the
paired `LandedCosts` namespace. See [scope and exceptions](LANDED_COST_CATALOGS.md).
LOC-026/007/002 and native/RTL acceptance remain independent.

LOC-005 is the validation/preference slice of LOC-002. The parent remains open
for full extraction and independent integration acceptance. Current coverage is
`LocalePreferences`, LOC-010 authentication/onboarding/invitation namespaces and
LOC-011 shared shell/UI, LOC-014 core settings, LOC-015 settings automation,
LOC-016 settings access/audit, LOC-018 billing/Stripe, LOC-019 document templates,
LOC-020 import/export, backups and trash
and LOC-013 teams/admin/notification
namespaces in `messages/en-US.json` and `messages/fa-IR.json`
(see [auth scope](AUTH_CATALOGS.md), [shell scope](SHELL_CATALOGS.md),
[settings scope](SETTINGS_CATALOGS.md), [automation scope](SETTINGS_AUTOMATION_CATALOGS.md),
[access scope](SETTINGS_ACCESS_CATALOGS.md)
and [workspace scope](WORKSPACE_CATALOGS.md), [provider scope](SETTINGS_PROVIDER_CATALOGS.md),
[document settings scope](SETTINGS_DOCUMENT_CATALOGS.md),
[data settings scope](SETTINGS_DATA_CATALOGS.md));
passing key parity does not mean that the rest of the product is localized.

LOC-017 combined provider/document/data acceptance and integration repairs are
recorded in [combined settings acceptance](SETTINGS_PROVIDER_DATA_ACCEPTANCE.md).
The wider LOC-006/002 integration and native/RTL gates remain independent.

LOC-012's independent combined settings acceptance is now recorded in
[settings catalog acceptance](SETTINGS_CATALOG_ACCEPTANCE.md), including the
owner-authorized Stripe exclusion, eight additional paired error keys and the
2,160-key catalog total. LOC-006/002 and native/RTL gates remain independent.

LOC-006's independent shell/auth/settings/workspace acceptance is recorded in
[combined catalog acceptance](SHELL_AUTH_SETTINGS_ACCEPTANCE.md). It adds the
paired sign-in request-failure message (2,161 keys per locale), composed rendering,
production callback checks and migrated REST/MCP/SQL integration. LOC-002 and
native/RTL qualification remain open. DEC-008 preserves Stripe unchanged.

## Catalog and authoring contract

- English is the compile-time key schema (`i18n/types.d.ts`). `useTranslations`
  and `getTranslations` reject unknown namespaces and keys during typecheck.
  Use literal keys or finite typed unions; do not erase key types with casts.
- Both JSON files use module namespaces. Add matching keys in both locales;
  adding further module namespaces is owned by LOC-006 through LOC-009. The
  existing request loader/provider still supplies the selected catalog only.
- `pnpm i18n:check` parses every message with the pinned FormatJS ICU parser,
  checks nonempty tree/string leaves, safe identifier keys, exact key parity,
  argument kinds/formats, rich tags, select choices, exact plural cases and
  offsets. All runtime plural categories must exist; irrelevant categories fail.
  Locale-specific plural category differences are allowed (notably ordinals).
- The parser is a development dependency, imported only by validation tooling
  and tests. No application import loads it or adds it to the client provider.
- The gate is an explicit CI test-job step, alongside the full unit suite.
  Typecheck and ESLint separately enforce typed production keys and safe API use.
  JSON files are reviewed source assets, not remotely editable content.

## Rendering and plural rules

Use ordinary `t(key, values)` for text and `t.rich(key, {...richTextTags, ...values})`
with `i18n/rich-text.tsx` for structured emphasis/code. Only `strong`, `em` and
`code` tags are approved. Catalog HTML attributes, unknown tags, comments and
ICU-quoted HTML are rejected. URLs and attributes belong in reviewed application
code; adding a new structural tag requires validator/renderer/test review.

The ESLint guard rejects raw/markup access, catalog-access imports and HTML sinks
in modules importing next-intl/use-intl. The root layout alone may import
`getMessages` for provider transport; it retains the HTML/raw restrictions. This
is a developer guard, not a sandbox against adversarial JavaScript, computed
indirection or deliberately bypassed types. Review remains required.

Tests use real next-intl/React rendering and adversarial interpolation. They
exercise cardinal 0/1/2 and fractions, ordinal branches and explicit `=0` cases.
Persian cardinal 0 and 1 select `one`, 2 selects `other`; Persian ordinals select
`other`. English cardinal zero selects `other`. Counts use runtime ICU; no
English `count === 1` branching is introduced. Money/date presentation adapters
remain separate tasks; count formatting here does not format financial amounts.

Official sources checked 2026-10-17:

- [next-intl translation and rich text APIs](https://next-intl.dev/docs/usage/translations)
- [next-intl message typing](https://next-intl.dev/docs/workflows/typescript)
- [FormatJS ICU parser](https://formatjs.github.io/docs/icu-messageformat-parser/)
- [Unicode CLDR 48 plural rules](https://www.unicode.org/cldr/charts/48/supplemental/language_plural_rules.html#fa)

## Preference scope and remaining extraction

The existing preference title/description/labels/error/actions and all language,
numeral and calendar option labels now come from catalogs, including the
organization language selector. `UTC` remains a technical IANA placeholder.
Language autonyms and numeral samples intentionally remain identical across
locales. Persian calendar labels are provisional, not a native terminology approval.
Existing en-US labels, select values, request bodies, reload behavior, URLs and
organization permissions are preserved. No new user operation or REST route was
introduced; existing `get_locale_preferences`/`update_locale_preferences` and
organization tools still provide the same operations via their shared services.

Extraction ownership:

| Task | Scope |
|---|---|
| LOC-005 | Validation foundation and complete locale preference labels |
| LOC-006 | Shared shell, auth/onboarding, settings, teams, admin, notifications |
| LOC-010 | LOC-006 child: authentication/onboarding/invitations and MCP consent |
| LOC-011 | LOC-006 child: shared shell and UI primitives |
| LOC-012 | LOC-006 child: settings configuration |
| LOC-013 | LOC-006 child: teams, administration and notifications |
| LOC-014 | LOC-012 child: navigation, general, procurement, cost centers and tags |
| LOC-015 | LOC-012 child: settings automation and notification preferences |
| LOC-016 | LOC-012 child: settings access and audit |
| LOC-017 | LOC-012 child: settings providers, documents and data management |
| LOC-018 | LOC-017 child: billing and Stripe settings |
| LOC-019 | LOC-017 child: document template settings |
| LOC-020 | LOC-017 child: import/export, backups and trash |
| LOC-007 | Accounting, sales, purchasing, contacts, tax and associated shared UI/errors |
| LOC-021 | LOC-007 child: chart of accounts, account picker/drawer and accounting navigation; see [scope](ACCOUNT_CATALOGS.md) |
| LOC-022 | LOC-007 child: journals and opening balances; see [scope](JOURNAL_CATALOGS.md) |
| LOC-023 | LOC-007 child: banking; see [combined acceptance](BANKING_CATALOG_ACCEPTANCE.md) |
| LOC-029 | LOC-023 child: bank-account list, creation and settings; see [scope](BANK_ACCOUNT_CATALOGS.md) |
| LOC-030 | LOC-023 child: transaction workspace and shared matching/categorization sheets; see [scope](BANK_WORKSPACE_CATALOGS.md) |
| LOC-031 | LOC-023 child: imports and shared import presentation; see [scope](BANK_IMPORT_CATALOGS.md) |
| LOC-032 | LOC-023 child: reconciliation; see [scope](BANK_RECONCILIATION_CATALOGS.md) |
| LOC-033 | LOC-023 child: scheduled payments, batches and bank-transfer drawer; see [scope](BANK_PAYMENT_CATALOGS.md) |
| LOC-024 | LOC-007 child: assets, loans, budgets and accruals; see [combined acceptance](ASSET_LOAN_BUDGET_ACCRUAL_ACCEPTANCE.md) |
| LOC-034 | LOC-024 child: asset-category management; see [scope](ASSET_CATEGORY_CATALOGS.md) |
| LOC-035 | LOC-024 child: fixed-asset list/detail and creation drawer; see [scope](FIXED_ASSET_CATALOGS.md) |
| LOC-036 | LOC-024 child: loan list/detail and creation drawer; see [scope](LOAN_CATALOGS.md) |
| LOC-037 | LOC-024 child: budget routes and creation drawer; see [scope](BUDGET_CATALOGS.md) |
| LOC-038 | LOC-024 child: accrual list/detail and creation drawer; see [scope](ACCRUAL_CATALOGS.md) |
| LOC-025 | LOC-007 child: sales and shared document forms; see [combined acceptance](SALES_CATALOG_ACCEPTANCE.md) |
| LOC-039 | LOC-025 child: payment list/detail; see [scope](SALES_PAYMENT_CATALOGS.md) |
| LOC-040 | LOC-025 child: invoices and payment-recording dialogs; see [scope](SALES_INVOICE_CATALOGS.md) |
| LOC-041 | LOC-025 child: quotes; see [scope](SALES_QUOTE_CATALOGS.md) |
| LOC-042 | LOC-025 child: cash sales/receipts and shared receipt attachments; see [scope](SALES_RECEIPT_CATALOGS.md) |
| LOC-043 | LOC-025 child: credit notes; see [scope](CREDIT_NOTE_CATALOGS.md) |
| LOC-044 | LOC-025 child: customer prepayments; see [scope](CUSTOMER_PREPAYMENT_CATALOGS.md) |
| LOC-045 | LOC-025 child: recurring invoices; see [scope](RECURRING_INVOICE_CATALOGS.md) |
| LOC-046 | LOC-025 child: revenue schedules; see [scope](REVENUE_SCHEDULE_CATALOGS.md) |
| LOC-047 | LOC-025 child: sales navigation and shared document/line forms; see [scope](SHARED_DOCUMENT_CATALOGS.md) |
| LOC-026 | LOC-007 child: purchasing; see [combined acceptance](PURCHASING_CATALOG_ACCEPTANCE.md) |
| LOC-048 | LOC-026 child: goods receipt list/detail and shared procurement line details; see [scope](GOODS_RECEIPT_CATALOGS.md) |
| LOC-049 | LOC-026 child: supplier bills; see [scope](SUPPLIER_BILL_CATALOGS.md) |
| LOC-050 | LOC-026 child: recurring bills; see [scope](RECURRING_BILL_CATALOGS.md) |
| LOC-051 | LOC-026 child: expenses and recurring expenses; see [scope](EXPENSE_CATALOGS.md) |
| LOC-052 | LOC-026 child: supplier debit notes; see [scope](DEBIT_NOTE_CATALOGS.md) |
| LOC-053 | LOC-026 child: purchase requisitions; see [scope](REQUISITION_CATALOGS.md) |
| LOC-054 | LOC-026 child: purchase orders and receiving forms; see [scope](PURCHASE_ORDER_CATALOGS.md) |
| LOC-055 | LOC-026 child: landed costs |
| LOC-056 | LOC-026 child: shared purchasing navigation/forms; see [scope](SHARED_PURCHASING_CATALOGS.md) |
| LOC-027 | LOC-007 child: contacts; see [combined acceptance](CONTACT_CATALOG_ACCEPTANCE.md) |
| LOC-057 | LOC-027 child: contact people/files; see [scope](CONTACT_PEOPLE_FILES_CATALOGS.md) |
| LOC-058 | LOC-027 child: contact list/picker/creation; see [scope](CONTACT_LIST_CATALOGS.md) |
| LOC-059 | LOC-027 child: contact detail shell/overview; see [scope](CONTACT_DETAIL_CATALOGS.md) |
| LOC-060 | LOC-027 child: contact financial tabs; see [scope](CONTACT_FINANCIAL_CATALOGS.md) |
| LOC-028 | LOC-007 child: tax; see [combined acceptance](TAX_CATALOG_ACCEPTANCE.md) |
| LOC-061 | LOC-028 child: tax rate and navigation; see [scope](TAX_RATE_CATALOGS.md) |
| LOC-062 | LOC-028 child: currency workspace; see [scope](CURRENCY_WORKSPACE_CATALOGS.md) |
| LOC-063 | LOC-028 child: tax period; see [scope](TAX_PERIOD_CATALOGS.md) |
| LOC-064 | LOC-028 child: VAT filing; see [scope](VAT_RETURN_CATALOGS.md) |
| LOC-065 | LOC-028 child: remaining tax filing; see [scope](TAX_FILING_CATALOGS.md) |
| LOC-008 | Inventory, payroll, projects, CRM, reports, dashboard and documents |
| LOC-066 | LOC-008 child: independent inventory combined acceptance; see [scope](INVENTORY_CATALOG_ACCEPTANCE.md) |
| LOC-072 | LOC-066 child: inventory categories, picker, creation drawer and navigation; see [scope](INVENTORY_CATEGORY_CATALOGS.md) |
| LOC-073 | LOC-066 child: inventory item list/detail/history, creation and item picker |
| LOC-074 | LOC-066 child: inventory variants and suppliers; see [scope](INVENTORY_VARIANT_SUPPLIER_CATALOGS.md) |
| LOC-075 | LOC-066 child: warehouse management, creation and picker; see [scope](WAREHOUSE_CATALOGS.md) |
| LOC-076 | LOC-066 child: stock-takes, transfers and movement creation; see [scope](INVENTORY_MOVEMENT_CATALOGS.md) |
| LOC-077 | LOC-066 child: BOM and assembly; see [scope](INVENTORY_ASSEMBLY_CATALOGS.md) |
| LOC-078 | LOC-066 child: valuation, alerts, loading and residual inventory strings |
| LOC-067 | LOC-008 child: payroll routes, creation and shared controls |
| LOC-068 | LOC-008 child: projects and shared controls |
| LOC-093 | LOC-068 child: project list, creation and settings; [scope and exceptions](PROJECT_LIST_CATALOGS.md) |
| LOC-094 | LOC-068 child: project overview and navigation; [scope and exceptions](PROJECT_OVERVIEW_CATALOGS.md) |
| LOC-095 | LOC-068 child: project tasks |
| LOC-096 | LOC-068 child: project time and billing |
| LOC-097 | LOC-068 child: project milestones |
| LOC-098 | LOC-068 child: project team and notes |
| LOC-069 | LOC-008 child: CRM and shared controls |
| LOC-070 | LOC-008 child: reporting and shared controls |
| LOC-071 | LOC-008 child: dashboard, documents and residual operations shared components |
| LOC-009 | Public surfaces, landing/help, email/PDF and user-visible background content; remaining source audit |
| LOC-079 | LOC-067 child: payroll overview/navigation; [scope and exceptions](PAYROLL_OVERVIEW_CATALOGS.md) |
| LOC-080 | LOC-067 child: employee list and EmployeeDrawer; [scope and exceptions](PAYROLL_EMPLOYEE_CATALOGS.md) |
| LOC-081 | LOC-067 child: employee detail; [scope and exceptions](PAYROLL_EMPLOYEE_DETAIL_CATALOGS.md) |
| LOC-082 | LOC-067 child: contractor list/detail and ContractorDrawer; [scope and exceptions](PAYROLL_CONTRACTOR_CATALOGS.md) |
| LOC-083 | LOC-067 child: run list and regular/off-cycle creation; [scope and exceptions](PAYROLL_RUN_CATALOGS.md) |
| LOC-084 | LOC-067 child: run detail, lifecycle, bonus and generation controls; [scope and exceptions](PAYROLL_RUN_DETAIL_CATALOGS.md) |
| LOC-085 | LOC-067 child: run payslips and tax form list/detail; [scope and output ownership](PAYROLL_OUTPUT_CATALOGS.md) |
| LOC-088 | LOC-067 child: payroll self-service profile and history; [scope and exceptions](PAYROLL_SELF_SERVICE_CATALOGS.md) |
| LOC-089 | LOC-067 child: compensation bands/reviews and review detail; [scope and exceptions](PAYROLL_COMPENSATION_CATALOGS.md) |
| LOC-090 | LOC-067 child: analytics, forecasting and report list/detail; [scope and exceptions](PAYROLL_ANALYTICS_CATALOGS.md) |
| LOC-091 | LOC-067 child: tax liabilities and payment recording; [scope and exceptions](PAYROLL_TAX_LIABILITY_CATALOGS.md) |
| LOC-002 | Independent combined key coverage, plural and safe rendering acceptance |

Later L10N/RTL tasks retain native-reviewed financial wording, complete Persian
workflows and layout qualification. Do not use English placeholders or parity
alone as proof of completed Persian translation.

## Verification

[Catalog tests](../../tests/message-catalogs.test.ts) cover production key parity,
negative ICU/shape/placeholder/format/tag cases, real plural and escaping behavior,
rendered preference controls, and lint rejection. Compile-time negative probes
ensure missing namespaces/keys fail typecheck. Existing
[locale tests](../../tests/locale.test.ts) cover preference precedence and provider
payload serialization. No DB/API/schema change is part of LOC-005.
