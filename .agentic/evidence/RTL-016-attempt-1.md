# RTL-016 inventory bidi and resilient controls

## Selection and boundary

Initial master HEAD was db03f35bdc707ae7b6d4f9a4bbf6a65636e9e476. Initial unrelated drawer edits and their money hash were preserved. A concurrent onboarding-wizard edit appeared during this run and is likewise excluded, together with its generated record. No unrelated source is staged or reverted.

Live selection was RTL-014 (31 sources, distinct ledger, journal, budgets/loans/accruals, asset and statutory tax contracts). Exhaustive split RTL-030..034 retained equal priority one and all original parent criteria unchecked. Controller then selected RTL-015 (36 sources, distinct document/payment/recurrence/procurement contracts). Exhaustive split RTL-035..042 likewise retained equal priority and parent acceptance. Live next selected RTL-016, started and implemented as its full existing 18-source task. No child priority was changed to force selection. Neither split counts as completed implementation. All 417 original census paths are present once, and all other/frozen owners are unchanged.

## Assigned-source audit

- inventory/layout and loading: audited shared TabLayout/loading boundaries and canonical five-tab routes; no source edit needed. Shared foundations and skeletons retain their own qualification.
- inventory/page: isolated caller names/categories and ordered item codes/SKUs, exact sale/cost/value displays and grouped monetary values; logical search/clear controls and icon spacing; explicit names for search, sort and chart-period fields; growing filters/actions. Existing horizontal stock-movement chronology is explicitly LTR; input chart data, axes, gradients and money computations stay unchanged.
- [id]/layout: isolated item name/code/SKU/category and exact money/margin displays; logical action spacing and mirrored back navigation, wrapping actions/header. Adjustment and write-off fields gain associated labels and native direction. Existing sheet validations, whole units and write-down aliases remain unchanged.
- [id]/page: ordered code/SKU and native numeric fields, auto-direction caller name/description/revalue reason, accessible currency/revalue fields, isolated warehouse identifiers and exact book values, logical alignment and growing actions. Existing barcode canvas, print builder and machine value are preserved; physical barcode/print behavior is not newly qualified.
- [id]/history: caller reason/actor grouped in isolation; signed quantity and previous-to-new transition have explicit numeric order. Movement/status/date contracts remain unchanged.
- [id]/suppliers: isolated supplier names/fallback IDs and metadata, associated supplier-code/lead-time/price labels, ordered code/count drafts, wrapping labels/actions. Canonical supplier identity/lead-day/exact-price and unlink callbacks stay intact.
- [id]/variants: isolated variant/options and metadata, associated name/SKU/pricing/quantity labels, explicit auto/LTR native drafts and growing actions. Signed historical quantities and canonical create input remain unchanged.
- alerts: isolated item/supplier/summary data, signed suggested quantities are one ordered group, wrapping text/action labels and logical gaps. Canonical suggestions, critical status and create-PO semantics unchanged.
- assembly: isolated order/recipe strings and wrapping action rows, logical instruction borders/indentation. Start/complete lifecycle, units and exact costs unchanged.
- bom list/detail: isolated caller recipe/component names/codes, exact breakdown costs and summaries; logical help-card borders/indentation and wrapping actions. Physical quantities, wastage and component callbacks unchanged.
- categories: caller names/descriptions isolated and allowed to wrap, tree indentation uses paddingInlineStart and chevrons follow direction. Native name/description directions and associated labels remain intact; existing native parent select retains canonical IDs. Edit/delete callbacks retain category object identity.
- stock-takes list/detail: isolated stock/warehouse/item names/codes and notes, ordered discrepancies, logical search/counters and growing filters/actions. Numeric segmented counter deliberately stays LTR with physical corner geometry; native numeric entry and +/-/blur callbacks retain exact whole-unit behavior. Status, blind count, count validation and adjusted flags unchanged.
- transfers: isolated from/to warehouse/item identifiers and notes, directional flow arrow mirrors, logical search/filters and wrapping controls. Source/destination semantics, units, receipt and complete/cancel payloads unchanged.
- valuation: isolated item/category/code and exact monetary fields, logical column/search alignment. Sorting, bigint ratios, CSV bytes, headers, quoting and UTC filename unchanged.
- warehouses: isolated name/code/address/default metadata, logical search/actions, growing filters/actions and associated name/code/address labels with native direction. Flag truthiness, address search and sort/ID semantics unchanged.

Three paired sortField messages supply accurate accessible names (English Sort by, Persian script asserted). No old catalog wording/key changed. Inventory namespace pin updated from 682 to 685; full catalogs contain 10,705 keys each. Two existing assertions now target unlink labels and isolated visible card codes rather than total aria-label count/unisolated markup. No new REST/MCP operation exists, so no MCP tool was added. No service, schema, migration, DB write, issued snapshot or Stripe file changed.

## Verification

Final combined command passes 97/97 tests (exit 0):

`node --import tsx --test --test-concurrency=1 tests/rtl-inventory.test.ts tests/inventory-item-catalogs.test.ts tests/inventory-category-catalogs.test.ts tests/inventory-variant-supplier-catalogs.test.ts tests/inventory-movement-catalogs.test.ts tests/inventory-assembly-catalogs.test.ts tests/inventory-report-catalogs.test.ts tests/warehouse-catalogs.test.ts tests/inventory-catalog-integration.test.ts`

New five-test suite executes actual JSX, next-intl/PresentationProvider, native input/Button controls, category and counter callbacks, exact large money/drafts and list destinations across en-US/fa-IR with latn/arabext. Installed Tailwind declarations verify logical alignment/insets/padding/margins, wrapping, directional arrows and select height/value clamp overrides. Controlled state/navigation, chart/widget/portal boundaries make this source/SSR/callback/CSS evidence, not mounted visual qualification. Existing suites execute actual response/action/form/bulk/count/transfer/assembly/valuation callbacks and failure handling. Shared drawer/picker composition ran against the current tree; excluded concurrent drawer/onboarding work is not qualified by this task and is not part of the commit.

Independent AST token comparison strips JSX/new bidi imports and normalizes CSS tokens only; all 18 non-JSX control/data trees and every JSX event-attribute body are identical to HEAD. Initial checker whitespace mismatch was corrected by token comparison. Initial new tests exposed fixture aliases, attribute casing and broad callback targeting in the harness; these were corrected without changing production contracts. The first typecheck caught nonexistent new sort label keys; explicit paired keys corrected that. Signed suggestion grouping was repaired after an older rendered-text assertion caught separation of the plus sign from its quantity. Final tests pass.

- pnpm typecheck: exit 0.
- Scoped ESLint over inventory sources and all changed tests: exit 0, no diagnostics.
- pnpm lint: exit 0, zero errors and 20 existing warnings outside owned inventory changes.
- pnpm i18n:check: exit 0, 10,705 keys per locale; Persian new-message script asserted with UTF-8-safe writes.
- Legacy money gate: all nine regression checks pass.
- Money generator and Drizzle/source verifier: 417 columns, 1,875 consumers; verified hashes and occurrence lines. A first verifier run caught ongoing concurrent onboarding source drift; refresh after that write verified successfully. Staging excludes concurrent drawer/onboarding consumer records and incidental pre-existing schema-declaration encoding normalization; schema/classification records are unchanged in the commit.
- Ownership: 417 original paths, complete disjoint 31/36-source splits, all other/frozen owners unchanged.
- Controller structural validation and whitespace/scope checks pass before local commit.

## Qualification and handoff

No mounted browser/caret/selection/keyboard/focus/AT, pixel clipping/zoom/text spacing, native Persian/accounting, PDF/print/barcode/email, hosted CI or deployment qualification is claimed. Native date formatting, select behavior and shared widget boundaries retain existing contracts and separate qualification. No full build/dev server, application/disposable DB access, IRR enablement or Stripe work occurred. RTL-010/008/002 and split RTL-014/015 retain independent combined acceptance. Supervisor owns the paired push; the next task is selected from the live controller after local completion.
