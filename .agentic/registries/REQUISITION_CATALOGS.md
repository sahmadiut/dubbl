# Purchase requisition catalogs - LOC-053

This is one bounded child of LOC-026. LOC-026/007/002 retain independent
integration acceptance. Persian wording remains provisional pending native
financial terminology review and complete RTL qualification. Stripe remains
unchanged under DEC-008.

## Owned sources

| Source | Extracted copy |
|---|---|
| `app/(dashboard)/purchases/requisitions/page.tsx` | Document title, columns, status labels, empty pipeline and skeleton labels, guidance, filters/sorts/count, read errors, creation sheet fields, validation and outcomes |
| `app/(dashboard)/purchases/requisitions/[id]/page.tsx` | Document title, loading/not-found/errors, supplier/date captions, lifecycle actions/outcomes, rejection form, converted-order guidance, reference/notes labels |
| `components/dashboard/requisition-line-editor.tsx` | Line fields, interpolated accessible names, add/remove actions, no-tax guidance, safe validation and preview total |
| `i18n/requisition-presentation.ts` | Finite typed status mapping with own-property checks |

Added 88 paired Requisitions messages (5,596 compatible keys per locale).
Existing namespaces are unchanged. Read failures store finite message keys and
translate during rendering; fetch dependencies do not include the translator.
Unknown/prototype-like statuses remain escaped caller data. Network, JSON,
HTTP, malformed-envelope and exact-money parser failures use reviewed fallbacks.

## Behavior and exact-money preservation

List reads retain organization headers, page size, query names and canonical
status/search/sort/date values. Existing loaded-row search, date filtering and
currency-grouped amount sorting remain unchanged and are described explicitly.
Cancellation and pagination generation guards remain intact. Pagination now
checks HTTP status before parsing and retains loaded rows on failure, with
localized inline feedback. Malformed list envelopes and money aliases fail
before row adoption.

Creation retains USD/reset defaults, optional supplier, nullable required date,
reference/notes, Gregorian request date and exact `unitPriceExact` line payloads.
No tax is calculated. Existing safe numeric range, saved quantity hundredths,
18-place exact prices and extended-price rounding stay unchanged. Failed creates
retain the sheet and fields and restore the saving state. Success requires a
nonempty saved ID before reset/close/navigation.

Submit remains PUT `{status:"submitted"}`; approve/convert remain bodyless POSTs;
reject remains POST with optional `{reason}`. Org-scoped URLs, methods and
workflow codes are unchanged. Lifecycle requests restore acting state and keep
failed rejection fields intact. Returned submit/approval/rejection status and
converted-order identity are checked before success. Existing busy flags guard
reentry. No service, REST/MCP route, schema, migration or financial helper changed.

## Explicit exceptions and independent scope

- Supplier/contact names, references, notes, rejection reasons, line descriptions,
  account names/codes, document numbers, currency codes and canonical saved dates
  remain escaped caller data. Unknown status values stay unchanged.
- URLs, headers, JSON fields, IDs, status/filter/sort codes, CSS, icons, empty
  defaults and punctuation are technical/data constants. Pipeline step indices
  remain numbers. Hidden internal exception text is diagnostic, never rendered.
- Existing money/date/quantity presentation helpers and ASCII exact-decimal entry
  remain unchanged. Full numeral/calendar adoption is separate.
- Shared ProcurementMoneyDetails retains LOC-048's existing catalogs. Date,
  table, sheet and other shared primitives retain their own catalogs.
- ContactPicker internals remain LOC-058; shared purchasing navigation/forms
  remain LOC-056. Purchase orders, sibling tasks and integration parents are
  independently accepted. No Stripe, FX, worker or IRR rollout change.

## Existing MCP coverage

`lib/mcp/tools/purchase-requisitions.ts` already registers list/get/create/update/
delete/submit/approve/reject/convert operations through direct DB services,
org-scoped AuthContext, described schemas and wrapTool. This presentation
extraction adds no user operation and requires no new MCP tool or contract change.

## Verification and limits

`tests/requisition-catalogs.test.ts` runs production components through real
React/next-intl/PresentationProvider, line editor, table, date controls and shared
money details. State, navigation, portals/select and out-of-slice pickers use
controlled boundaries. Callback tests execute original production syntax with
injected dependencies and assert requests and failure retention. These checks
do not represent mounted browser, font or visual RTL acceptance.

Existing migrated disposable PostgreSQL tests separately exercise actual REST,
registered MCP and independent SQL assertions for procurement and the full
requisition lifecycle. See [attempt evidence](../evidence/LOC-053-attempt-1.md)
and [honest self-review](../evidence/LOC-053-review-1.md) for executed results.
Native Persian terminology, complete RTL/browser, hosted CI, deployment and
production IRR qualification remain independent. No full build or dev server ran.
