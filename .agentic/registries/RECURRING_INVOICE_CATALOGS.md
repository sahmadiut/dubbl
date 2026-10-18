# Recurring invoice catalogs

LOC-045 is a bounded child of LOC-025. Independent LOC-025/007/002 acceptance
remains open. Added 108 paired `RecurringInvoices` messages (4,863 compatible
keys per locale). Persian terminology is provisional pending native and RTL review.

## Ownership and behavior

- `app/(dashboard)/sales/recurring/page.tsx`: page title, table headings,
  status/frequency labels, empty guidance and illustration, weekday labels,
  summary/upcoming headings, tabs, search/frequency/sort controls, clear action,
  filtered-empty copy, safe read failures and ICU pagination counts.
- `app/(dashboard)/sales/recurring/[id]/page.tsx`: title, loading/not-found,
  contact and schedule descriptions, status/frequency display, pause/resume,
  deletion confirmation/outcomes, occurrence/next-run cards and notes heading.
- `RecurringDrawer` in `components/dashboard/create-drawer.tsx`: creation
  instructions, labels/placeholders, currency/default guidance, frequency choices,
  auto-email explanation, owned line/notes headings, validation and outcomes.
- `components/dashboard/recurring-invoice-money-details.tsx`: line headings,
  unit-price currency interpolation, discount label, gross totals and explanation.
- `i18n/recurring-invoice-presentation.ts`: typed status/frequency labels with
  own-key checks. Unknown/prototype-like codes remain escaped caller data.

Columns respond to locale changes. Reads store finite message codes and render
through the current catalog without translation-triggered network effects.
HTTP/network/JSON/parser failures display reviewed operation fallbacks rather
than raw server prose. Malformed lists cannot replace existing rows. Creation
requires a nonempty saved identity before success/close/navigation. Status changes
require the same returned identity and requested status; unreadable successful
updates clear the detail and request a reload. Valid updates preserve already
validated money lines and change only the requested status.

## Exceptions and preserved contracts

Names, contact/account descriptions, account codes, notes, references, unknown
status/frequency codes, currency codes, saved canonical dates and numeric data
remain caller data. The empty-state Gregorian month grid retains its existing
en-US month/year formatter, Sunday-first geometry and numeric days. The static
USD amount `$299.00`, `12 / infinity`, missing-value dashes and punctuation remain
illustrations. Calendar/date/numeral adapters and complete RTL qualification are
separate tasks. Example company/name/date and authored weekdays are cataloged.
English status display uses conventional capitalized labels.

REST routes, org headers, invoice type, canonical statuses/frequencies/sort keys,
page size 50, preview cap of five active templates with three dates each,
drawer identifier and navigation are preserved. Existing cancellation, org/context
and stale-pagination guards remain. Search still matches caller name/contact.

Creation retains explicit template currency with USD default, nullable end date,
reference and notes, `autoSend`, exact `unitPriceExact` and quantity inputs.
Money display retains saved-currency bigint prices/gross totals, quantity
hundredths, discount basis points and the existing before-discount/tax meaning.
No currency inference, financial rounding or storage change is introduced.

Shared LineItemsEditor, document forms, DrawerFooter internals, navigation and
shared pickers retain their existing owners (including LOC-047/058). Other
drawers, earlier namespaces and Stripe remain unchanged under DEC-008. No schema,
migration, service, REST/MCP, FX or production-IRR flag change is made.

## Existing MCP coverage

`list_recurring_templates` (invoice type), `get_recurring_template`,
`create_recurring_template`, `update_recurring_template`,
`pause_recurring_template`, `delete_recurring_invoice`,
`preview_recurring_invoice` and `get_recurring_template_summary` retain
org-scoped AuthContext, direct Drizzle
services and described schemas with wrapped errors. This task adds presentation
copy rather than an operation, so no tool/transport contract change is needed.

## Verification and limits

`tests/recurring-invoice-catalogs.test.ts` renders actual production function
syntax with React, next-intl, PresentationProvider, DataTable, DatePicker and
money helpers/cards. State, navigation, portals and out-of-slice pickers/forms
use controlled boundaries. Callback checks exercise creation, pause/resume,
deletion, initial/detail/preview reads and pagination, including canonical
payloads, HTTP/network/JSON/shape/money-alias failures, cancellation, generation
guards and independent valid previews. Both locales, hostile interpolation,
unknown labels, Persian script, ICU counts and authored JSX/attributes are checked.

Existing wire/UI-money and migrated disposable REST/MCP/SQL suites verify
financial contracts and tenant isolation. Controlled rendering does not establish
mounted browser/RTL or native terminology acceptance. Parent integration,
date/numeral adapters, hosted CI, deployment/providers and production IRR remain
independent. No full build or dev server was started; no application DB was used.

See [attempt evidence](../evidence/LOC-045-attempt-1.md) and
[self-review](../evidence/LOC-045-review-1.md).
