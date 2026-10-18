# Loan catalogs - LOC-036

LOC-036 owns `accounting/loans/page.tsx`, `accounting/loans/[id]/page.tsx`
and LoanDrawer in `components/dashboard/create-drawer.tsx`. LOC-024/007/002
retain independent combined acceptance.

## Extracted copy

94 paired `Loans` messages cover the document title, empty-state explanation and
examples, use cases, statistics, columns, statuses, filters, search, counts,
detail/schedule headings, term summaries, payment confirmation and exact amount
preview, creation fields, placeholders, account guidance, success and errors.
Counts and loan terms use ICU plurals; payment summaries are whole sentences.
Persian wording is provisional pending native financial terminology review and
RTL workflow qualification.

## Contracts and explicit exceptions

- IDs, routes, organization headers, canonical status/filter values, account
  types, dates, request keys and caller names remain data. Unknown status values
  remain verbatim with an own-property lookup; caller content is React-escaped.
- Existing fixed two-decimal cents, USD display/prefix, exact Minor strings and
  bigint aggregates are preserved. `$10,000.00`, `-$880.00`, `$0.00` remain the
  existing illustrative money samples. `%`, `#`, middle-dot separators, missing
  value dashes and numerical input constraints remain literal. Loan/account
  dates and currency codes remain canonical; numeral/calendar/currency
  presentation qualification belongs to later L10N work.
- Successful DTOs still pass through unchanged `assetLoanJson`, then expected
  loan/schedule/bank shapes are checked before adoption. Unknown server, network,
  parser and money-validation prose receives localized operation fallbacks.
  HTTP 401/403, 400/422 and `LEGACY_NUMERIC_RANGE` use reviewed messages. Known
  local amount, term and rate validation errors translate without changing input
  contracts. Loan rate wording correctly describes interest rather than the
  shared parser's depreciation terminology.
- Payment confirmation still uses `onConfirm`; cancellation never submits.
  Failed writes clear saving/posting flags and do not close, navigate or reload.
  Bank read failures now surface and stale bank/list effects are ignored.
- Existing optional bank-account omission, schedule-entry ID, organization scope,
  methods, exact inputs and navigation are preserved. No REST/MCP/service/schema
  or migration changes; existing loan tools cover the unchanged operations.
  Stripe remains unchanged under DEC-008.

## Verification and handoff

[Production rendering/callback tests](../../tests/loan-catalogs.test.ts) use real
next-intl/PresentationProvider, tables, fields and money, controlled hooks and
inline portals. They execute actual creation/payment/read callbacks, including
errors, malformed DTOs, conflicting exact-money aliases and cancelled effects.
This is server rendering/direct callback execution, not mounted browser testing.
[Existing money tests](../../tests/asset-loan-ui-money.test.ts) follow the
presentation helper to the same exact validator; financial assertions remain.

See [evidence](../evidence/LOC-036-attempt-1.md) and
[self-review](../evidence/LOC-036-review-1.md). Native Persian, RTL, browser,
hosted CI, production qualification and independent parent acceptance remain open.
