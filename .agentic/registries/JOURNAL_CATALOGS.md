# Journal and opening-balance catalog extraction

LOC-022 adds 269 paired keys in `Journals` (251), `JournalErrors` (15) and
`JournalActivity` (3), bringing each catalog to 2,603 keys. Existing namespaces
remain unchanged. LOC-007/002 retain independent integration acceptance.

## Authored presentation covered

- `app/(dashboard)/accounting/page.tsx`: manual-entry title, empty examples,
  onboarding steps, statistics, table headings/status labels, search/date/sort
  controls, empty/request states and ICU result counts.
- `accounting/[id]/page.tsx`: entry title, status/source labels, actions/tooltips,
  delete/cancel confirmations, reason prompt, amounts/metadata headings, audit
  count summary and draft-edit sheet labels, validation and result notifications.
- `accounting/recurring-journals/page.tsx`: title, example schedule/calendar
  weekday labels, frequency/status labels, statistics, filters, sorting,
  pagination counts and request errors.
- `accounting/recurring-journals/[id]/page.tsx`: details, frequency/status,
  pause/resume/run/delete actions and confirmations, ICU posting results,
  metadata/line/total headings, empty and invalid-money/request states.
- `accounting/opening-balances/page.tsx`: explanation, loading/empty/request
  states, replace/create action and starting-date label.
- `components/dashboard/entry-form.tsx`, `opening-balance-form.tsx` and
  `opening-balance-money-details.tsx`: labels, placeholders, line instructions,
  accessible row/remove labels, exact preview validation, imbalance text,
  saving/cancel actions and saved-balance headings/errors.
- `EntryDrawer`, `OpeningBalanceDrawer` and `RecurringJournalDrawer` in
  `create-drawer.tsx`: titles, fields/options/help, account-read failures,
  create/save actions and notifications. All 35 other drawer/provider/helper
  functions are unchanged after LF normalization.
- `activity-feed.tsx`: three sidebar labels and reuse of existing SettingsAudit
  action/entity/date/relative-time helpers. The same audit route, codes and caller
  data remain intact; date grouping uses the existing presentation/timezone policy.

## Explicit exceptions and preserved contracts

Caller/persisted account names/codes, descriptions, references, reasons, notes,
template names, IDs, audit user names and historical generated descriptions are
data, not renamed records. Known status, source and frequency codes translate for
display; unknown future values remain inspectable codes with guarded own-property
lookups. Canonical action/status/source/frequency/currency codes, API paths,
organization headers, dates, event names, filters/sort keys, payload fields and
FX/allocation metadata remain unchanged. REST/MCP/schema/service code is unchanged;
the existing entries, recurring-journals and opening-balances tools supply the
same operations. No new operation needs a new MCP tool.

`JE-`, `REF-RENT`, reference/code examples, `$0.00`, sample counts, infinity,
punctuation, empty-value dashes and developer invariant errors are intentional
technical/sample exceptions. Runtime date/month names and financial/numeral
formatters retain existing contracts; the fixed sample date is translated copy.
The timestamp connector is a paired message. Full calendar/numeral/RTL formatting
qualification remains separate. Opening balances still use the explicit legacy
USD numeric-minor bridge; journals retain canonical Minor strings and saved
currency/FX metadata. No stored amount is rescaled or financial gate enabled.

`i18n/journal-presentation.ts` maps approved existing HTTP/validation messages and
authorization statuses to catalogs. Unknown server, network, parser, HTML and
JSON prose uses a translated operation fallback. Failed deletions reject so the
existing confirmation hook stays open. Failed recurring reads show an alert,
and malformed exact saved values fail closed. Successful HTTP operations retain
their existing mutation/navigation behavior. The sidebar uses approved existing
audit helpers rather than translating persisted codes in storage.

## Verification and remaining acceptance

`tests/journal-catalogs.test.ts` renders real production templates through React,
next-intl and PresentationProvider with controlled state/navigation/network
boundaries. Sheets/dialogs render inline for inspection. Callback tests execute
actual production functions, not copied implementations. Tests cover both locales,
escaping, counts, field/status/frequency values, exact large sums, request payloads,
metadata, operation paths, failures and confirmation semantics. The older journal
component fixture now supplies the established presentation provider; its original
financial assertions remain unchanged.

Persian financial wording is provisional pending native terminology review.
These checks do not establish live browser interaction/layout, complete RTL,
live REST/MCP/database acceptance, hosted CI or production IRR readiness. Stripe
files/functionality remain preserved under DEC-008. LOC-023 through LOC-028 cover
the remaining sibling slices. See [evidence](../evidence/LOC-022-attempt-1.md) and
[honest self-review](../evidence/LOC-022-review-1.md).
