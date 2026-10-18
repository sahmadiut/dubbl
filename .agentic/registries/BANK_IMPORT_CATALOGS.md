# Bank statement import catalogs

LOC-031 adds 37 paired `BankImports` messages in English and provisional Persian,
bringing each catalog to 3,373 compatible keys. Existing namespaces are unchanged.
LOC-023/007/002 retain independent integration acceptance.

## Presentation covered

- `app/(dashboard)/accounting/banking/[id]/(detail)/imports/page.tsx`: document
  title, import action and empty history guidance.
- Shared `_components.tsx` `ImportRow`: complete statement-period messages and
  ICU row/duplicate counts, including singular English. File names remain data.
- `ImportSheet`: title/guidance, upload/drop/browse/paste labels, placeholder,
  file size/removal, automatic format detection, preview summary headings and
  period, warnings, transaction table headings, cancel/preview/import actions
  and busy states. File, paste, format and removal controls have catalog labels.
- `i18n/bank-import-presentation.ts`: all six warnings emitted by the current
  statement parser map to finite typed translation keys; unknown warnings use a
  translated review reminder. Warning payloads/storage are unchanged. Technical
  format labels retain their established spelling; only Auto Detect is prose.
- Existing layout callbacks already reuse `BankWorkspace` import success and
  failure messages and `BankAccountErrors` validation/authentication/range errors.
  Unknown server/network/HTML/JSON failures use translated safe fallbacks. These
  callbacks are verified directly by this task; their implementation is unchanged.

## Explicit exceptions and boundaries

The actual repository has a history page and `ImportRow`, rather than a separate
`ImportHistoryTab`. It has no mapping or saved-profile editor in this slice.
Mapping/profile capabilities remain available through their existing REST/MCP
contracts; this extraction does not add a new editor or user operation.

Caller file names, transaction descriptions/references, account identifiers,
canonical date strings, punctuation and existing date/money/numeral adapters
retain their behavior. Caller text is escaped by React. File extensions, accept
filters, CSV headers, technical format codes/labels (CSV/TSV/QIF/OFX/QFX/QBO,
CAMT.052/.053/.054, MT940/942, BAI2), IDs, modes, routes, headers, HTTP methods,
format detection, parser syntax, mapping fields, profiles and payloads remain
canonical. Machine/API/parser error prose remains English; UI errors reuse the
existing finite presentation boundary. No schema, migration, parser, financial
service, REST or MCP implementation changed. Stripe is preserved under DEC-008.

Preview and commit still call the existing org-scoped statement-import route,
backed by `preview_bank_statement_import`/`import_bank_statement` and shared
services. Bulk-import and get/save/delete-profile tools are unchanged. Bigint
preview adaptation and raw bank minor-unit/Minor-string semantics are unchanged.

## Verification and handoff

`tests/bank-import-catalogs.test.ts` renders real page/row/sheet templates through
React, next-intl and PresentationProvider in both locales. Network, context and
portal/select boundaries are controlled. Tests execute actual layout callback
syntax for file/paste reading, preview/commit success, exact low digits, auto/
explicit formats, org headers, reset/refresh behavior and validation/auth/HTTP/
network/HTML/malformed response failures. They cover empty/populated history,
plural counts, escaped data, all format options, warning mapping/fallback,
selected-file/busy/disabled/no-period/no-warning branches and authored JSX audit.
Persian leaves are checked for actual Persian characters to catch encoding loss.

These checks are template/callback tests, not browser event automation or database
integration. No database was accessed. Native terminology, full RTL/font/layout,
hosted CI, provider/deployment and production IRR qualification remain independent.
No full build or dev server was run. See [evidence](../evidence/LOC-031-attempt-1.md)
and [honest self-review](../evidence/LOC-031-review-1.md).
