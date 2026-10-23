# Combined operations and reporting catalog acceptance

LOC-008 independently accepts the current combined operations presentation after
LOC-066..071. It does not complete LOC-002 or qualify native Persian wording,
RTL, calendars/numerals, authored outputs or production release.

## Reconciled ownership

| Child | Route TSX files | Namespaces / paired messages | Detailed inventory and exceptions |
|---|---:|---:|---|
| LOC-066 inventory | 18 | 8 / 682 | [Inventory](INVENTORY_CATALOG_ACCEPTANCE.md), five creation drawers and three pickers |
| LOC-067 payroll | 27 | 14 / 1,043 | [Payroll](PAYROLL_CATALOG_ACCEPTANCE.md), employee/contractor drawers |
| LOC-068 projects | 11 | 7 / 498 | [Projects](PROJECT_CATALOG_ACCEPTANCE.md), ProjectDrawer |
| LOC-069 CRM | 7 | 4 / 224 | [CRM](CRM_CATALOG_ACCEPTANCE.md), DealDrawer |
| LOC-070 reports | 34 | 14 / 654 | [Reports](REPORT_CATALOG_ACCEPTANCE.md), report navigation and controls |
| LOC-071 dashboard/documents | 4 | 9 / 341 | [Dashboard/documents](DASHBOARD_DOCUMENT_CATALOG_ACCEPTANCE.md), eleven shared surfaces |

The combined inventory is 101 route components and 56 distinct namespaces with
3,442 paired messages. Counts include reused shared keys within their namespace;
they are not counts of new strings. Full catalogs contain 9,660 compatible keys
per locale. The six combined child tests pin exact route filenames, catalog
ownership, copy exceptions and behavior; LOC-008 adds a cross-module inventory
and residual shared-control audit. Historical completed evidence is preserved.

## Residual shared-control audit

All direct dashboard-component imports from the 101 routes reconcile to these
17 sources. No additional extraction was necessary:

| Shared source group | Ownership and accepted presentation |
|---|---|
| activity-feed, cash-flow-widget, brand-loader, error-state, data-table, stat-card | LOC-071; finite catalog errors, known audit labels, loaders and caller-provided display values |
| category-picker | LOC-066; InventoryCategories. Nested warehouse/item pickers retain LOC-066 coverage |
| contact-picker | Existing ContactPicker catalog and LOC-007 shared/contact acceptance; saved names/IDs remain data |
| create-drawer | Five inventory, two payroll, project and CRM drawer bodies accepted by their domain parents; shared footer/section chrome uses DocumentForms. Other drawers retain their existing domain ownership |
| topbar | Existing shell catalog acceptance; contextual entity titles and caller children remain data |
| date-range-filter | DateRange; six translated presets and start/end labels; existing Gregorian ISO date calculations and callbacks retained |
| export-button | SharedUI action and finite export error; canonical columns, CSV bytes, filenames, MIME and date suffix retained |
| empty-state, page-header, section | No authored display prose; translated caller title/description and children flow through and are escaped by React |
| tab-layout | No authored display prose; caller-translated labels/titles, saved badges, exact hrefs and detail navigation suppression retained |
| budget-progress-bar | AnalyticalReports actual/budget interpolation, escaped caller label, fixed-two exact cents and existing percentage geometry |

Direct UI imports are primitives (button/input/table/badge/label, dialog/sheet,
popover/command/select, tabs/checkbox/switch/tooltip), visual wrappers
(blur/content reveal), and calendar/date/currency/search controls. They retain
existing SharedUI/DateRange and caller catalog ownership; no new operations
prose was found. Numeric input examples such as 0.00, Gregorian date data,
calendar/runtime month labels, currency codes and visual geometry retain their
documented formatting boundary. Full calendar/numeral/RTL qualification is open.

## Exceptions and preserved contracts

- Saved names, identifiers, notes, descriptions, stages, account/category labels,
  file names, audit technical codes and other caller data are not translated.
  Unknown technical values retain the explicit child fallbacks. Example item,
  warehouse, SKU, file and email identifiers remain technical examples.
- Statutory labels/forms, backend-generated notes, project invoice descriptions,
  email subjects, template fallback names and opaque calendar fallback titles
  retain the detailed child output/data ownership. LOC-009 owns authored public,
  email and PDF output; CSV/workbook machine tokens, order and values are stable.
- The send dialog's five existing English Stripe fragments and all associated
  payment behavior retain DEC-008. Stripe files/functionality remain preserved;
  provider qualification does not block this acceptance.
- Fixed-two payroll/project/budget values remain cents even for a KWD label;
  currency-aware report/dashboard/inventory paths retain their own scales.
  Canonical Minor strings, bigint calculations, historical values, physical
  quantities/hours and FX snapshots are not reinterpreted or combined across
  currencies. This acceptance does not enable IRR.
- HTTP methods, org headers, URLs, query/filter keys, enums, callbacks, request
  payloads, authorization and existing response-adoption/cancellation behavior
  remain intact. Child-documented timer-save retry, list-management and output
  limitations remain explicit rather than being claimed repaired here.
- No REST operation or UI feature changes. Existing org-scoped direct-DB MCP
  registrations and wrapTool/services remain in place. Existing parity limitations
  (including the separate approval-chain summary read) are not newly qualified.

## Current verification and limits

The parent source inventory checks route counts and the complete direct shared
dashboard import set. Residual AST checks reject literal display prose and
resolve literal translation keys in both catalogs. Real production shared
components render together under PresentationProvider in both locales, checking
translated actions/presets, escaped caller data and distinct exact budget cents.
The six existing combined compositions and current child catalog suites verify
navigation, payloads, finite errors, invalid/stale reads, drawers and chart data.

Selected migrated PostgreSQL suites cover all six module groups through actual
authenticated REST handlers, linked registered MCP calls and SQL assertions.
See [actual commands and outcomes](../evidence/LOC-008-attempt-1.md) and
[honest self-review](../evidence/LOC-008-review-1.md). They complement UI tests;
they do not establish complete backend operation parity or whole-product
financial qualification. No new product/catalog extraction or backend change
was needed. Controlled hooks, portals, charts and IO do not establish mounted
browser/keyboard/RTL behavior or live SMTP/S3/provider delivery. Persian remains
provisional. LOC-002, LOC-009, native terminology and later release gates remain
independent; no build, dev server, hosted-CI or deployment acceptance is claimed.
