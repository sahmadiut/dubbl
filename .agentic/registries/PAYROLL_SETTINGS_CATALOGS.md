# Payroll settings catalogs

LOC-092 owns `app/(dashboard)/payroll/settings/page.tsx` and 124 paired
`PayrollSettings` messages. They cover eight sections, five creation drawers,
labels/options, empty states, list summaries, active status, approval step plurals,
portal link, placeholders, confirmation copy and finite load/save/create/delete
feedback. Both locales have 8,053 compatible keys.

## Preserved contracts and explicit exceptions

- Settings fields, account codes, currency selection, auto-approval flag, HTTP
  methods, organization header, endpoint paths, JSON fields, optional omission,
  defaults and form reset behavior remain. No REST/service/auth/MCP API changes.
- Tax rates remain integer basis points. Monetary fields remain canonical safe
  integer cents with matching `*Minor` strings; inputs use existing fixed-two
  payroll-cent parsers even for JPY/KWD. Existing dollar input prefixes and
  deduction/bracket displays remain dollar-denominated. Band display uses its
  saved currency. Locale never changes currency or rescales stored amounts.
- Shift types, deduction categories, jurisdiction levels, leave types and accrual
  methods remain machine values. Finite labels translate only at presentation;
  unknown saved enum text gets the translated unknown label. Federal/state/local
  terminology describes existing configuration; this introduces no Iranian
  payroll/tax compliance, new rates, filing identifiers or statutory rules.
- Names, descriptions, levels, jurisdiction strings, IDs, references and account
  codes remain escaped saved data. Clock input remains HH:mm, including overnight
  shifts. Percent premiums, overtime factors, hours and accrual balances retain
  binary32/physical units; they never pass through monetary scaling. The existing
  optional zero-cap/premium visibility condition is retained.
- Shared BrandLoader, CurrencySelect, CurrencyInput, controls, confirmation
  cancel copy, icons, styles, punctuation, symbols and numeric defaults retain
  existing ownership. Mounted browser/keyboard and complete RTL qualification
  remain separate; no full build or dev server is required for this slice.

`payrollSettingsJson` rejects failed HTTP, malformed JSON/envelopes, missing
display fields, invalid quantities/rates/clocks, duplicate list IDs, unsupported
currencies and missing/conflicting exact-money aliases. Bands reuse the checked
compensation reader. All seven reads validate before atomic adoption. Failures
release loading and hide the screen behind translated feedback. A successful
refresh clears that feedback. Missing organization or inaccessible storage also
exits loading. A generation guard ignores superseded/unmounted read outcomes.

Save/create feedback and drawer reset require checked success. Failed create
retains editor values. Delete confirmation remains mandatory, and failed delete
now receives translated feedback without a false refresh. Raw server/network/
parser/money diagnostics never enter visible text. Existing configuration,
payroll-time and compensation MCP tools retain their contracts. The pre-existing
approval-chain summary REST read is unchanged; this slice adds no operation or
new MCP surface and does not accept broader parity by implication.

## Verification and handoff

Production JSX renders through real next-intl and PresentationProvider in both
locales with controlled hooks/IO and inline portal wrappers. Actual callbacks
verify all five creation payloads, settings save, both confirmed deletes, failure
retention, missing storage/org, atomic reads and obsolete replies. These are
rendering/behavior checks, not mounted browser qualification. Migrated fixtures
exercise actual REST/linked MCP reader compatibility and independent SQL,
authorization and preserved legacy contracts; approval-chain read has a real
REST scope and SQL step-count check.

Persian wording remains provisional pending native terminology review.
LOC-067/008/002 retain independent combined acceptance. Complete RTL,
calendar/numeral, hosted CI, deployment and production qualification remain
separate. No schema, migration, provider, IRR flag or Stripe source change.
See [attempt evidence](../evidence/LOC-092-attempt-1.md) and
[Codex self-review](../evidence/LOC-092-review-1.md).
