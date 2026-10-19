# Tax period catalogs - LOC-063

Bounded child of LOC-028. The period list/detail routes and shared settlement
preview use 93 paired `TaxPeriods` messages (6,195 keys per locale).
LOC-028/007/002 retain independent combined acceptance. Persian terminology is
provisional pending native review; this is not full RTL/browser qualification.

## Authored copy inventory

| Surface | Extracted copy |
|---|---|
| `app/(dashboard)/tax/periods/page.tsx` | Document/page title and description; empty state; KPI/table headings; progress plural; create fields/placeholders/options/busy button; submit confirmation/help/reference; delete accessible name; success/failure notifications; submitted date, overdue/due-soon/open labels and day plurals |
| `app/(dashboard)/tax/periods/[id]/page.tsx` | Loading/not-found/back/error; known status/type labels and unknown fallbacks; submitted/reference metadata; settlement callout/help; box headers/empty state/net explanation; notes; payment/refund fields, actions, busy controls and notifications |
| `components/dashboard/tax-settlement-preview.tsx` | Settlement sentence with exact formatted amount; blank/invalid amount feedback |
| `lib/i18n/tax-period-presentation.ts` | Finite type/status to message-key mappings, including safe unknown fallbacks |

Day and submitted-count sentences use actual ICU plural categories in both
locales. Ordinary next-intl interpolation escapes caller names and references.
Unknown type/status values receive reviewed labels rather than catalog-key
construction. Existing list filing-urgency semantics are preserved: filed takes
precedence, otherwise endDate determines overdue, 0-14 days due soon, or open.
This is the existing heuristic, not a new statutory filing-deadline calculation.

List HTTP/JSON/array failures retain existing rows, release loading and show a
localized fallback. Detail failures clear invalid data and show a localized
fallback; aborted reads remain ignored. Both reads release loading with no org.
Mutation failures preserve editable input and show localized feedback without
exposing arbitrary server, network or parser prose. Settlement response amount
or currency mismatches retain the existing rejection and have localized copy;
malformed currency/alias responses use the generic settlement failure.

## Explicit data and formatting exceptions

- User/persisted names, notes, references, box labels and source descriptions are
  data, escaped without translation. Frozen statutory box numbers, IDs and sort
  order are preserved; this task does not reinterpret or translate filed history.
- Routes, org headers, request field names, status/type/direction values,
  `mode: "settle"`, account filters, `isRefund`, canonical `amountMinor`, date
  input values and stored Gregorian/UTC dates remain machine contracts.
- Existing currency-aware exact-money formatting and decimal parser are
  unchanged. JPY/IRR/USD/KWD scales, safe-range/alias checks, negative-net refund
  selection, zero-settlement policy and prefill remain intact. `0.00` is the
  retained numeric input example; currency codes are data.
- Existing en-US/host date displays, raw KPI counts/progress and `%`, date-range
  punctuation and missing-date dash remain formatting exceptions for later L10N.
  No new calendar, accounting rule, FX conversion or IRR enablement is introduced.
- Shared picker/loader/select/sheet copy remains owned by the existing shared
  namespaces. Select values remain `monthly/quarterly/annual` and `pay/refund`;
  real SSR triggers and actual portal-option element trees are separately tested.
- Internal thrown diagnostic strings are not displayed. They are not catalogs.

## REST/MCP and scope boundary

Existing org-scoped REST tax-period list/detail/create/delete/file routes and
the settlement mode are unchanged. Existing `list_tax_periods`,
`get_tax_period`, `create_tax_period`, `update_tax_period`, `delete_tax_period`,
`file_tax_period` and `record_vat_settlement` provide the corresponding MCP
operations through shared services/direct DB access. No new operation or API
contract requires an MCP change. No service, schema, migration, financial helper,
production flag or Stripe source changed (DEC-008).

Other tax filing pages belong to LOC-064/065. Complete native terminology,
RTL/keyboard/portal accessibility, browser and statutory/release qualification
remain separate from this bounded catalog task.

## Verification

`tests/tax-period-catalogs.test.ts` has 12 groups for real bilingual rendering,
escaped user data, known/unknown labels, filing thresholds/plurals, sheet/busy
states and actual option values, exact previews, real authored mutation/read
callbacks with controlled IO, org guards, canonical payloads and read/response
validation. AST inventory guards remaining authored copy and Persian script.
Existing tax money/wire tests also pass, with preview rendering supplied the
same PresentationProvider the application uses. See the task attempt and
self-review for complete command results and limits.
