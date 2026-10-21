# Payroll compensation catalogs - LOC-089

82 paired flat `PayrollCompensation` messages; 7,813 compatible keys per locale.
Persian wording is provisional. LOC-067/008/002 retain independent combined
acceptance, followed by native terminology and full RTL qualification.

## Owned presentation

`app/(dashboard)/payroll/compensation/page.tsx` and
`compensation/reviews/[id]/page.tsx` own their document titles, statistics,
headings, descriptions, search/clear controls, sort labels, finite review
statuses, band/review sheets, labels/placeholders, busy/actions, empty/missing
states, money/date/count connectors and finite read/create feedback.
The existing shared `BrandLoader`, `CurrencyInput` and `CurrencySelect` retain
their shared catalog ownership. Existing layout and controls are preserved.

`i18n/payroll-compensation-presentation.ts` checks HTTP/JSON/envelopes, displayed
fields, unique IDs, finite statuses, canonical Gregorian effective dates,
supported currency, exact cents aliases, ordered band ranges, nullable budget,
entry counts, stored binary32 adjustment percentages and detail identity.
Detail totals are checked independently against bigint entry sums/difference.
Money validation delegates to the existing payrollJson adapter.

List reads adopt bands, reviews and base currency together after validation.
Effect cleanup invalidates obsolete fulfillment and rejection. Missing
organization/unavailable storage release loading with finite translated copy.
Detail 404 preserves the missing-review state and clears a prior read error;
other failed reads display finite translated errors. Raw server, parser, network
and storage prose is never shown. Creation retains form fields on failure and
releases busy in finally. Success requires a valid band/review response, closes
and resets the corresponding form, then refreshes. A failed refresh does not
turn a completed create into a failed create.

## Exceptions and preserved contracts

- Saved band/review/employee names, employee numbers, band levels and adjustment
  reasons remain escaped data. Currency codes, routes, IDs, headers, request
  fields, status/filter/sort values and canonical Gregorian dates are unchanged.
- The range hyphen and level middle dot retain their existing separators.
  `adjustment` is an explicit symbol/interpolation-only catalog exception:
  English `+{percent}%` and Persian `+{percent}٪` contain no authored prose.
  Counts use explicit decimal strings without changing existing plural behavior.
  Complete numeral, calendar and RTL layout/input qualification remain separate.
- Payroll keeps fixed-two cents for every currency and canonical `*Minor`
  strings. Band-width averages retain bigint half-away-from-zero rounding;
  mixed currencies display a label instead of a combined monetary statistic.
  Review totals remain server-derived and exact. Informational percentages
  retain the existing one-decimal display, including the existing `+` prefix;
  they neither compute salaries nor change saved employee pay.
- Band create preserves name, optional level, currency and three Minor salary
  strings, including empty salary defaults to zero. Review create preserves
  name, Gregorian effectiveDate and optional totalBudgetMinor; it does not send
  currency. The service owns the review currency. Blank optional fields remain
  omitted, and successful form resets preserve their existing currency defaults.
- Existing org-scoped list/create/get compensation tools already cover these
  operations through the shared service. Real migrated REST and linked MCP
  responses pass the reader in the compensation fixture alongside independent
  SQL, permission, membership, isolation, rollback and audit assertions.
  Equity analysis and forecasting REST/MCP operations are preserved and remain
  exercised by that fixture; no new UI, equity contract or duplicate tool is added.
- No backend, authorization, schema/migration, financial calculation, statutory
  identifier, provider, IRR flag or Stripe change.

Real production JSX renders through next-intl/PresentationProvider in both
locales; controlled hooks and IO exercise production read/create callbacks.
These checks do not constitute mounted-browser/keyboard, native Persian,
complete RTL, parent integration, hosted CI, deployment or production acceptance.
No full build or dev server ran.
