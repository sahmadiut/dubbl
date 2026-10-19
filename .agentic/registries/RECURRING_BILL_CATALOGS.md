# Recurring bill catalogs - LOC-050

LOC-050 is the bounded recurring-bill child of LOC-026. LOC-026/007/002 retain
independent combined acceptance. Persian wording is provisional pending native
financial terminology and RTL qualification. DEC-008 preserves Stripe unchanged.

## Source ownership

| Source | Extracted copy |
|---|---|
| `app/(dashboard)/purchases/bills/recurring/page.tsx` | Document/page title, schedule guidance, creation CTA, table headers, statuses/frequencies, loading/empty/error states, creation drawer labels/placeholders, frequency choices and submit/busy text |
| `i18n/recurring-bill-presentation.ts` | Finite typed status/frequency labels, display error keys and reviewed local input-error mapping |

Added 42 paired `RecurringBills` messages: 5,207 compatible keys per locale.
All previous catalog namespaces remain unchanged. Error state stores finite keys
and renders with the current catalog. Locale changes do not trigger network
effects. The frequency trigger explicitly renders its translated selected value;
all six canonical option values and the monthly default remain unchanged.

## Preserved money and transport behavior

The list retains GET `/api/v1/recurring?type=bill` and the creation drawer retains
POST `/api/v1/recurring`, both with the existing organization header. Missing org
context does not send a request. Abort cleanup prevents stale reads from adopting
rows, error messages or loading state. Malformed list envelopes and invalid money
aliases display the translated read failure instead of appearing empty.

Creation still uses `recurringBillEditorPayload`, explicit currency with USD
default, canonical dates, nullable end date/occurrence cap/reference, `type: bill`,
exact `unitPriceExact` strings, physical quantity controls and the original line
selection. Reviewed local validation errors receive specific translations; other
schema failures use the details fallback. Unknown HTTP/network/server prose never
becomes visible copy. Failed requests preserve form data and restore the submit
control; successful creation requires a nonempty saved template identity before
closing, resetting and refreshing the list.

Recurring payables retain their legacy fixed-two input scale in every currency:
input 1.00 stores 100 raw units regardless of selected currency. Prices and
physical quantities retain the existing rounding before extension; 0.005 times
3 becomes 3 raw units. List totals remain per-template bigint gross amounts
before discount/tax and are displayed with the saved currency. No currency
inference, aggregation across currencies, rescaling, rounding-policy change,
money-helper edit or persisted-unit change is introduced.

## Explicit exceptions and remaining ownership

- Template/supplier names, references, line descriptions, saved date strings,
  currency codes and unknown status/frequency codes remain caller data and are
  React-escaped. Technical routes, headers, IDs, JSON fields, status/frequency
  values, CSS, icons and missing-value dashes remain code constants.
- The shared `LineItemsEditor` already uses `DocumentForms` for recurring bill
  scale guidance, fixed-two price headers, totals, purchase tax hints and preview
  failures. Those catalogs/components and their financial helpers are unchanged.
- Shared CurrencySelect uses SharedUI; its existing behavior remains intact.
  Shared ContactPicker's internal menus and supplier badges remain LOC-058;
  this task owns its bill-specific translated placeholder. Generic purchasing
  forms/navigation remain LOC-056. Other purchasing children remain independent.
- Dates, amounts, percentages and quantity displays retain existing adapters.
  Complete numeral/calendar adoption and RTL remain separate tasks.
- No recurring-bill detail/edit/manual-generation screen exists in this slice;
  no new workflow, operation or screen was added. Existing REST/MCP capabilities
  remain available through their existing contracts.

## Existing MCP coverage

`list_recurring_templates` with bill type and `create_recurring_template` with
bill type already provide these operations through organization-scoped
AuthContext and direct DB services. Described schemas, permission checks and
wrapped errors remain unchanged. No REST, MCP, service, schema, migration, FX,
generation-worker or IRR rollout change is part of this task.

## Verification and limits

`tests/recurring-bill-catalogs.test.ts` executes the production workspace with
real React/next-intl/PresentationProvider, table, selector, currency picker,
shared line editor and exact-money helpers. State/effects and the sheet/contact
picker boundaries are controlled. Tests check both locales, loading/empty/error
states, escaped saved data, exact USD/JPY/KWD/IRR display, selected frequency
trigger and portal option values/callbacks, fixed-two previews, read cancellation,
malformed envelopes/aliases, org guards, exact creation payloads, schedule/input
failures, safe retry and original reset defaults. Source AST and Persian-script
checks cover authored strings and encoding.

These are controlled rendering/callback checks, not mounted browser interaction
or layout approval. Existing migrated recurring-bill/payable fixtures separately
exercise real REST, registered MCP, generation and SQL. See
[attempt evidence](../evidence/LOC-050-attempt-1.md) and
[honest self-review](../evidence/LOC-050-review-1.md) for final results. Native
Persian terminology, full RTL/font/layout, hosted CI, deployment and production
IRR qualification remain independent. No full build or dev server was run.
