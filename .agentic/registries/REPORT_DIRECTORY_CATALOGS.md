# Report directory and shared navigation catalogs

LOC-103 owns 73 paired `ReportDirectory` messages and six paired
`ReportNavigation` messages (8,854 compatible leaves per locale). Persian wording
is provisional pending native financial terminology review and full RTL
qualification. This slice is one child of LOC-070, not complete report extraction.

## Ownership and scope

- `app/(dashboard)/reports/page.tsx`: document title, seven categories and their
  descriptions, and all 29 report cards with titles/descriptions. Typed finite
  catalog keys replace authored English; the original hrefs, icons, order and
  category membership remain unchanged. English copy is preserved exactly.
- `reports/_components.tsx`: shared BackToReports label, accounting-basis prompt,
  cash/accrual labels and explanatory tooltips. ReportHelp wraps caller-supplied
  children and introduces no authored text; React retains caller escaping.
- `reports/loading.tsx`: delegates unchanged to the shared catalogued BrandLoader.
  Link, Section, Button and tooltip primitives retain their current ownership.

The accounting-basis toggle still accepts/emits exactly `accrual` and `cash`.
Selection styling and click behavior remain unchanged. Report keys/routes and
all dates, filters, query parameters, API/tool inputs, amounts and exported
headers/data remain machine contracts. Numeric/statutory tokens such as 1099
remain explicit data exceptions; US reporting descriptions retain their US
scope. No new Iranian tax/compliance behavior is implied by translation.

This slice makes no requests or mutations and introduces no user-facing data
operation requiring a new MCP tool. Existing report tools/services retain their
operation coverage, direct scoped DB access, AuthContext and wrapTool. Current
financial statement and dashboard/report integration suites verify actual
REST/linked MCP/SQL money, basis, tenancy, authorization and rollback contracts.
No report service, wire contract, export template, schema/migration, money/FX,
authorization, currency/IRR flag or Stripe implementation changes are made.

## Reporting split and independent acceptance

Source inspection found 34 report TSX components. Every component is assigned
once across these children; later slices depend on the LOC-103 shared foundation.

| Child | Components under reports/ |
|---|---|
| LOC-103 | page, loading, _components |
| LOC-104 | profit-and-loss, income-statement, executive-summary |
| LOC-105 | balance-sheet, comparative-balance-sheet, cash-flow |
| LOC-106 | trial-balance, general-ledger |
| LOC-107 | aged-receivables, aged-payables, payment-performance, vendor-spend, duplicate-detection |
| LOC-108 | tracking, budget-vs-actual, expense-analytics, profitability, pnl-comparison, financial-ratios |
| LOC-109 | cash-flow-forecast, financial-calendar |
| LOC-110 | 1099, tax-summary, vat-return |
| LOC-111 | bank-cash-flow, bank-reconciliation-status |
| LOC-112 | saved, custom |
| LOC-113 | schedules |
| LOC-114 | consolidation, pack |

Named report directories above own their page.tsx. Broad later slices may be
subdivided after deeper inspection. LOC-070 retains independent combined coverage,
shared-filter/export/schedule/error, financial and MCP acceptance after all
children; LOC-008/002 are also independent. No parent criterion is checked here.

## Verification and handoff

Production JSX renders with real next-intl/PresentationProvider, Link, Section,
Button and tooltip controls. Tests cover both locales, every href/category/card,
document title, selection/callback values, supplied tooltip copy, caller escaping,
shared loading accessible name and source-copy/Persian-script checks. Tooltip
text is asserted at its production props because portals are closed in SSR;
these are not mounted-browser keyboard/layout checks.

See [task evidence](../evidence/LOC-103-attempt-1.md) and
[honest self-review](../evidence/LOC-103-review-1.md). LOC-104 now has its own
[income/executive catalog scope](INCOME_REPORT_CATALOGS.md). LOC-105..114 and independent
LOC-070/008/002 remain open. Native Persian/RTL/calendar/numerals, browser, output,
hosted CI, provider, deployment and production qualification remain separate.
