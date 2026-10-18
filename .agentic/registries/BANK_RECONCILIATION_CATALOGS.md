# Bank reconciliation catalogs

LOC-032 adds 93 paired `BankReconciliation` messages in English and provisional
Persian, bringing both catalogs to 3,466 compatible keys. Preexisting namespaces
are unchanged. LOC-023/007/002 retain independent integration acceptance.

## Authored presentation covered

- `app/(dashboard)/accounting/banking/[id]/reconcile/page.tsx`: document title,
  unavailable state, accessible return action, heading/guidance, statement-check
  actions/tooltips, account/remaining/selected summaries, selected-line actions,
  search/selection, uncategorized warnings, empty state, statement history/status,
  date/balance sheet fields, starting state and operation notifications.
- `_components.tsx`: `ReconciliationReport` and `RecLineList`, including statement
  and GL balances, difference and currency/no-ledger guidance, matched/unmatched
  groups/empty states, adjustment dialog/preview/guidance, posting state and
  notifications. RecLineList's text is caller data or a translated empty prop.
- `i18n/bank-reconciliation-presentation.ts`: finite typed mappings for 17 known
  reconciliation failures, shared authentication/authorization/validation/range
  fallbacks from `BankAccountErrors`, specific local decimal-balance failures,
  and translated operation fallbacks for unknown/HTML/network/parser failures.
  Response cloning permits error inspection without consuming the shared reader.
  Canonical REST/MCP messages and codes remain unchanged.

ICU supplies singular/plural result counts and pronoun guidance. Bulk operations
now use an error for zero successful updates and a warning with both counts for
partial updates; full success retains Matched/Ignored wording. Request order,
endpoints, payloads, selection reset and refresh remain unchanged.

## Explicit exceptions and contracts

Account names, descriptions, references, ledger labels and dates remain caller
data escaped by React. The saved default `Reconciliation adjustment` description
is preserved in both locales as historical accounting data; the user can still
provide a trimmed description. Currency codes, IDs, statuses, action codes,
comparison reason `different_currency_units`, org headers, routes/query strings,
request field names, CSS and punctuation/signs remain canonical. The `0.00`
placeholder is an existing technical decimal example. Financial/date/numeral
presentation continues through existing adapters; no policy or scale changed.

No schema, migration, financial service, REST, MCP or Stripe implementation
changed. No new user operation was added. Existing org-scoped registered tools
still cover listing/creating/completing statements, reconciliation reports,
posting adjustments and reconciling/excluding statement lines. Bigint sums and
canonical signed Minor strings, date filters, selected-ID omission behavior,
completion/adjustment guards and saved journal text remain intact.

## Verification and handoff

`tests/bank-reconciliation-catalogs.test.ts` renders actual production templates
through React, next-intl and PresentationProvider in both locales. State and
navigation are controlled; sheet/dialog portals render inline. Tests execute
actual callback syntax at controlled network/state boundaries for fetch,
create, complete, adjust, selection and bulk operations. They cover exact low
digits, signed USD/KWD inputs, canonical dates/headers/payloads, unchanged saved
default text, guards, partial/zero results, malformed/HTML/HTTP/network failures,
safe unknown errors and escaped caller content. An AST audit rejects authored
English JSX/visible literal attributes; Persian-character checks protect new
catalog leaves against encoding loss. These are template/callback checks, not
browser event automation or DB transaction qualification.

Persian terminology is provisional pending native review. Full RTL/font/layout,
browser interactions, database integration, hosted CI, providers, deployment
and production IRR gates remain independent. No application database was used.
See [evidence](../evidence/LOC-032-attempt-1.md) and
[honest self-review](../evidence/LOC-032-review-1.md).
