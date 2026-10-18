# Asset-category catalog extraction

LOC-034 adds 68 paired messages: `AssetCategories` (57) and
`AssetCategoryErrors` (11). The catalog total is 2,784 per locale after including
the owner's concurrent 13 font-preference messages. LOC-024/007/002 retain
independent combined acceptance. Persian wording remains provisional.

## Authored presentation covered

- `app/(dashboard)/accounting/asset-categories/page.tsx`: document title, heading,
  description, empty states, table headers, short depreciation methods, months,
  active/inactive badges, accessible edit action, create/edit dialog title,
  explanatory guidance, fields, examples, all method/convention choices, account
  picker placeholders, status toggle, cancel/save/create actions and errors.
- `i18n/asset-category-presentation.ts`: finite typed method/convention choices
  preserve canonical values. Short method labels use own-property guards; future
  unknown codes remain caller data. Approved service/status/local input errors
  translate. Unknown network, JSON/parser and service prose uses translated
  operation fallbacks. Successful responses still use `assetLoanJson`, preserving
  recursive validation of exact saved-money aliases before UI adoption.

Read failures render an alert rather than an empty success state. A valid reload
clears a stale read error. Failed saves retain the dialog and never reload; the
returned category identifier and all present money aliases validate before
closing. Missing organization scope returns before entering the saving state.

## Exceptions and preserved contracts

Caller category names, account names and IDs remain untouched and escaped by
React. Unknown future method codes remain data. Method/convention values, field
names, DOM IDs, type filters, API paths, POST/PATCH methods, pagination, organization
headers, null/default handling, active boolean, payload keys and route behavior
remain machine contracts. `0.00`, numeric input bounds/steps and em dashes remain
technical samples/punctuation. The abbreviated month message is an interpolated
unit label; it does not select an English singular/plural branch.

Residual values retain fixed two-decimal cents and canonical string
`defaultResidualValueMinor`. Useful life remains integer months, rates basis
points, and existing asset USD-format presentation stays unchanged. These are
explicit historical asset contracts, independent of locale and ISO scales.
No money helper, asset service, REST, MCP or schema change belongs to LOC-034.
Existing `list_asset_categories`, `get_asset_category`, `create_asset_category`,
`update_asset_category` and `delete_asset_category` tools already provide the
corresponding operations. No new user operation was added.

## Verification boundaries and owner changes

`tests/asset-category-catalogs.test.ts` renders the actual production template
through React, next-intl and PresentationProvider. State/network boundaries are
controlled; Dialog/Select portals render inline to inspect all choices. Fields,
account picker, table, translations and money display remain real. Tests execute
production loader/save/edit-initialization syntax and assert org scope, exact low
digits, canonical payloads/nulls, invalid inputs/aliases/response shapes, saving
flags, failure retention, error recovery and escaped caller content. Existing
asset/loan UI and wire regressions retain their financial checks; the source guard
now follows the category presentation helper into `assetLoanJson`.

The owner explicitly requested committing all files including concurrent font
and settings changes. These are included separately from LOC-034 acceptance:
five local font assets and font-face classes, six choices including existing
Vazirmatn, persisted nullable `users.font_family`, locale resolution/schema/UI,
REST/MCP preference exposure, paired messages and settings styling. Estedad was
copied from the owner's specified Desktop file. Migration 0014 and its generated
snapshot/journal were already supplied with the owner's edits; Drizzle generation
reports no further schema changes. Locale and migration fixtures now explicitly
cover font preference persistence, strict input, null clearing, malformed saved
fallbacks and historical nullable-column preservation without weakening original
field checksums. Application databases are not used for verification.

Native Persian, RTL/font/layout, browser interaction, hosted CI, deployment,
physical printing and production IRR qualification remain independent. No full
build or dev server runs. Stripe files/functionality remain unchanged under
DEC-008. Fixed assets, loans, budgets and accruals remain owned by LOC-035..038.

See [evidence](../evidence/LOC-034-attempt-1.md) and
[honest self-review](../evidence/LOC-034-review-1.md).
