# Revenue schedule catalogs

LOC-046 is a bounded child of LOC-025. Independent LOC-025/007/002 integration
acceptance remains open. Added 90 paired `RevenueSchedules` messages (4,953
compatible keys per locale). Persian financial wording is provisional pending
native terminology and RTL qualification.

## Owned presentation

- `app/(dashboard)/sales/revenue-schedules/page.tsx`: document title, table
  headings, status/method labels, empty-state guidance and examples, use cases,
  summary labels, tabs/tooltips, search, filter clearing, empty results, safe
  read/pagination failures and ICU schedule counts.
- `app/(dashboard)/sales/revenue-schedules/[id]/page.tsx`: document/loading/
  not-found titles, schedule description, status/method display, recognition
  and cancellation actions/tooltips, confirmation, outcomes, summary labels,
  period table and empty periods.
- `RevenueScheduleDrawer` in `components/dashboard/create-drawer.tsx`:
  instructions, labels/placeholders, method options, validation, invoice-load
  failure, creation outcomes and explicit translated footer overrides.
- `i18n/revenue-schedule-presentation.ts`: typed finite labels with own-key
  checks, finite read-error codes and validation before adopting renderable
  numeric-cent responses. Unknown/prototype-like codes remain escaped data.

Column memoization and method search respond to locale changes without changing
wire codes or triggering translation-dependent network effects. Failed HTTP,
network, JSON, shape or money-alias reads cannot replace rows with malformed
data. Initial reads and invoice-option reads ignore cancelled responses.
Creation requires a nonempty saved identity before success/close/navigation.
Raw server diagnostics never become visible action failures. Recognition and
cancellation await a validated detail refresh; a failed refresh clears the
actionable detail and asks for reload. This avoids offering another recognition
against an unreadable updated schedule.

## Preserved contracts and exceptions

Routes, organization headers, page size 50, drawer identifier, navigation,
canonical status/method codes and date strings are unchanged. Recognition still
posts the first unrecognized entry ID. Cancellation preserves posted periods.
Creation retains `totalAmountExact`, the existing normalized-input fingerprint
and retry key, invoice ID, start/end dates and method. Money retains the legacy
fixed two-decimal cent contract and USD presentation, exact bigint aggregate
sums, inclusive-month allocation and last-period remainder. No currency
inference, rescaling, rounding or financial service change is introduced.

Caller invoice numbers/names/IDs, canonical dates, unknown status/method codes,
money/numeric data and punctuation remain data. The static dollar amounts
`$1,200.00`/`+$100.00` and `$` input prefix retain their existing illustrative/
legacy display contract. Example invoice identifier `INV-0042` is preserved
inside translated example copy. `detailDescription` only interpolates dates
and an already localized method with punctuation, so has no authored Persian
word. Date/numeral adapters and complete RTL remain separate tasks.

Shared DataTable, DatePicker, CurrencyInput, confirmation/sheet primitives and
DrawerFooter internals retain their owners; this slice passes translated owned
copy into them. Shared sales navigation/forms remain LOC-047. Every other drawer,
earlier catalog namespace and Stripe is unchanged under DEC-008. No schema,
migration, REST/MCP, storage, FX or production-IRR flag changes.

## Existing MCP coverage

`list_revenue_schedules`, `get_revenue_schedule`, `create_revenue_schedule`,
`recognize_revenue_entry` and `cancel_revenue_schedule` already cover the owned
operations through org-scoped AuthContext, direct Drizzle-backed services,
described strict schemas and wrapped errors. Presentation extraction introduces
no operation or transport change requiring new tools.

## Verification and limits

`tests/revenue-schedule-catalogs.test.ts` renders actual production function
syntax with React, next-intl, PresentationProvider, DataTable, PageHeader,
StatCard, DatePicker, CurrencyInput and exact money display. State/navigation,
portals and select boundaries are controlled. Production callback syntax is
executed for creation, retry, recognition, cancellation, list/pagination/detail
and invoice reads. Both locales cover finite labels, hostile/unknown values,
ICU counts, Persian script, exact sums, canonical requests, confirmation cancel,
cancelled initial reads, safe errors and authored JSX/attribute extraction.

Existing revenue wire and migrated disposable REST/MCP/SQL fixtures verify
exact allocations/posting, tenant authorization, period locks, retry replay,
rollback, concurrency and retained fixed cents. Controlled rendering does not
establish mounted browser, native wording or RTL acceptance. Parent integration,
date/numeral adapters, hosted CI, deployment/providers and production IRR remain
independent. No full build or dev server was started; no application DB was used.

See [attempt evidence](../evidence/LOC-046-attempt-1.md) and
[self-review](../evidence/LOC-046-review-1.md).
