# Auxiliary and public consumer cutover acceptance (MON-008)

2026-10-16, Asia/Tehran. Independent final acceptance of MON-153..160,
including the report and background integration descendants. This current entry
supersedes older MON-008-pending wording in linked mappings and generated owner
labels. Completed task evidence remains historical and unchanged. The actual
shared services and consumer adapters already compose; no new public operation,
MCP tool, schema, migration, saved unit or production flag change is needed.

## Complete manifest disposition

[MONEY_BOUNDARIES](MONEY_BOUNDARIES.json) is a conservative lexical inventory,
including nonmoney matches, tests and infrastructure. Its paths/hashes/occurrence
lines are verified against current source and actual Drizzle columns. It is not
transitive dataflow proof. The following complete family mapping joins every
monetary consumer to its exact domain and UI contracts; a generic historical
MON-008 owner label is not an unimplemented feature.

| Consumer family / inventory paths | Adopted contracts and consumer disposition |
|---|---|
| Core sales, purchases, payments, bank, ledger, opening, tax/configuration pages and shared editor sections; their app/api and lib/mcp operations | [MON-007 combined acceptance](CORE_ACCOUNTING_CUTOVER_ACCEPTANCE.md), [core UI mapping](CORE_UI_MONEY_CUTOVER.md), [core backend mapping](CORE_ACCOUNTING_INTEGRATION_CONTRACTS.md). Core ownership stays intact. |
| app/(dashboard)/inventory; catalog input, inventory picker and detail/UI helpers; inventory API/MCP, stock-to-GL costing | [Detail/write-down](INVENTORY_DETAIL_UI_CUTOVER.md), [remaining inventory UI](INVENTORY_UI_CUTOVER.md), [inventory domains](INVENTORY_INTEGRATION_CONTRACTS.md). MON-153/154 own all monetary sections; category/warehouse/alert configuration contains counts, IDs and physical quantities. |
| app/(dashboard)/payroll and payroll helpers/drawer sections; payroll API/MCP and service calculations | [Payroll UI](PAYROLL_UI_MONEY_CUTOVER.md), [payroll domains](PAYROLL_INTEGRATION_CONTRACTS.md). MON-155 owns employee/contractor/settings/compensation/forecast/run/payment/report/payslip/tax/self-service consumers. |
| Fixed-assets, asset-categories and loans pages/helpers; domain API/MCP and posting | [Asset/loan UI](ASSET_LOAN_UI_MONEY_CUTOVER.md), [domain integration](ASSET_LOAN_INTEGRATION_CONTRACTS.md). MON-156 owns all monetary forms, saved state, totals and previews. |
| Budgets, projects and CRM pages; budget progress, project/deal/budget/accrual drawer sections; accrual detail/list | [Budget/project/CRM UI](BUDGET_PROJECT_CRM_UI_CUTOVER.md), [project/CRM/pricing domains](PROJECT_CRM_PRICING_INTEGRATION.md), [auxiliary integration](AUXILIARY_REPORT_INTEGRATION_CONTRACTS.md), [accruals](ACCRUAL_WIRE_CONTRACTS.md). MON-157 covers exact input, state, signed totals, time billing and previews. |
| All reports pages, contact screens, dashboard/widgets, shared report/display/export helpers | [MON-158 combined acceptance](REPORT_CONTACT_CUTOVER_ACCEPTANCE.md), [auxiliary report acceptance](AUXILIARY_REPORT_UI_ACCEPTANCE.md). These map every statement/result page, navigation/configuration/download page and shared section to adopted contracts. |
| trigger and scheduled service delegates; bookkeeping, depreciation/loan/revenue, recurrence/reversal/FX, alert/report/payment/payroll/accrual/costing boundaries | [MON-159 combined acceptance](BACKGROUND_CUTOVER_ACCEPTANCE.md), [bookkeeping](BACKGROUND_BOOKKEEPING_CUTOVER.md), [remaining composition](BACKGROUND_COMPOSITION_CUTOVER.md). Reuse exact domain writers; no new autonomous payroll/accrual/costing workers. Provider/digest/webhook/backup/purge delegates retain MON-160 ownership. |
| Payment/portal/signing pages, documents/PDF/email/templates, import/export/backup/opaque, Stripe/billing settings and providers | [MON-160 mapping](PUBLIC_RENDER_EXPORT_UI_CUTOVER.md), [public combined domains](PUBLIC_BOUNDARY_INTEGRATION_CONTRACTS.md), [opaque/public domains](OPAQUE_PUBLIC_INTEGRATION_CONTRACTS.md). All monetary output validates saved aliases and currency before adoption/rendering. |
| Remaining admin/auth/landing/docs/layout/navigation/member/team/invite/notification/audit/trash/role/tag/picker/upload and generic UI paths | Lexical IDs, dates, counts, bytes, statuses, animation geometry and percentage matches are nonmoney. Landing/pricing/dashboard samples are static display examples. Admin email samples use explicit sample currency. These are retained UI, not financial writers; real shared editor/money sections are owned above. Locale/RTL work remains LOC/RTL scope. |
| lib/money, lib/currency, lib/db, API serialization/auth/metadata infrastructure; tests/scripts | [Exact money documentation](../../lib/money/README.md), [wire compatibility](SERIALIZATION_COMPATIBILITY_CONTRACTS.md), [exact API boundaries](EXACT_API_BOUNDARY_CONTRACTS.md), [column appendix](MONEY_COLUMNS.md). Exact primitives, guarded storage/wire bridges and domain-owned calculations remain adopted; tests are synthetic qualification consumers. Counts/quantities/FX/percentages/opaque JSON retain their separately declared units. |

No remaining scoped monetary family is silently deferred. Known independent
accounting defects, production/migration and full-int64 business expansion are
qualification limits below, rather than claims of fixed defects.

## Independent combined regression

[Parent fixture](../../tests/integration/auxiliary-public-cutover-acceptance.test.ts)
and [worker](../../tests/integration/auxiliary-public-cutover-acceptance-worker.ts)
create separate USD, JPY, KWD and synthetic IRR organizations. A real authenticated
REST invoice for 4000000003 is recognized through linked registered MCP. A saved
907-unit recurring cost posts through the actual background maintenance delegate.
SQL-text literal oracles verify invoice/AR 4000000003, expense 907, net 3999999096
and balanced journals. REST/registered MCP PnL and its UI adapter reconcile those
same values. Public payment and portal statement REST/MCP consumers retain the
same invoice and currency, as do actual HTML rendering and CSV export. Email
amount labels share the validated saved currency. Formatting changes only display
scale; raw storage and CSV Minor values are never rescaled.

A separate locked occurrence posts no journal and is consumed under the retained
recurrence policy. Repeated worker/read calls preserve complete SQL JSON-text
financial, template, numbering and audit snapshots. Portal view activity and
API-key usage metadata are intentionally excluded from financial snapshots.
Denied MCP/unauthorized REST, foreign scoped token/render calls, missing tokens,
corrupt alias adoption and persisted unsafe due values reject. Failed public and
render reads preserve the complete corrupted snapshot; fixture repair restores
the original response without changing other history.

The joint financial regression command independently reruns every child family,
both intermediate acceptance fixtures and their domain cases. These retain
inventory write-down/layers/movements/valuation, payroll compensation/payments/
outputs, asset/loan lifecycle, budget/project/CRM/accrual, report/contact/history,
background FX/replay/concurrency and public signing/provider/import/export/backup
negative cases. Parent completion uses these current runs and source review,
rather than inferring financial correctness from controller child status.

## Reviewed exceptions and guard coverage

- Saved canonical Minor aliases agree with required safe numeric or fixed-two
  decimal aliases. bigint/rational intermediates retain low digits; business
  operations still reject values outside their documented safe numeric limits.
- Inventory catalog USD/cents, payroll/asset/loan/project/CRM fixed cents and
  budget/accrual compatibility inputs retain their adopted semantics independent
  of ISO display scale. Never rescale stored values based on magnitude or tag.
- Source document units, organization-base carrying values and tagged raw GL
  units remain distinct. Saved FX recognition/reversal is immutable; later
  reference-rate edits never reprice it. Current-base/raw-history restrictions,
  historical remediation and existing rounding policies remain documented.
- Physical quantities/minutes/hundredths, basis points, FX decimals, ratios,
  counts, chart geometry and bytes are nonmoney. Tooltips/CSV use original exact
  integers; numeric XLSX retains its existing precision gate.
- CSV fixed-two prices, opaque literal text, byte-preserving backups, static USD
  subscription examples and provider native scale/range restrictions remain
  the MON-160 reviewed exceptions. No live provider policy is expanded.
- ESLint's no-new-legacy rule rejects new deprecated imports/references, namespace,
  dynamic/require and re-export bypasses under per-file reference ceilings.
  verify_legacy_money has nine negative/allowance regressions. Domain source tests
  reject raw/failed response adoption, float monetary input/math and obsolete
  formatting in their owned consumers. Inventory regeneration/drift and Drizzle
  verification bind the reviewed source paths and hashes. Together these guards
  detect new assumptions; the lexical scanner alone does not prove correctness.

## Independent limits

This is local integration/self-review evidence. Existing trial-balance natural-sign
and other accounting qualification defects remain PAR-008/QA-001 work. Production
IRR, migration/rollback, full-int64 business operation support, localization/RTL,
native-language/accounting/security review and release qualification remain
separate. No live browser, physical printer, hosted CI, provider delivery,
deployment, Docker or production qualification is inferred. See
[attempt evidence](../evidence/MON-008-attempt-1.md) and
[honest self-review](../evidence/MON-008-review-1.md) for commands and results.
