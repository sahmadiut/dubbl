# Fixed asset catalogs - LOC-035

LOC-035 owns the fixed-asset list and detail routes and FixedAssetDrawer in
`components/dashboard/create-drawer.tsx`. Asset-category management belongs to
LOC-034. LOC-024/007/002 retain independent combined acceptance.

## Extracted copy

176 paired messages in `FixedAssets` cover document titles, empty-state lifecycle
guidance, preview labels, table columns, statuses, depreciation methods, search,
filters and counts; creation fields, examples, account choices and footer;
depreciation, rollback, disposal, revaluation, impairment, capitalization and
construction-cost actions, tooltips, dialogs, confirmations, history, success
messages and errors. Counts and useful-life months use ICU plurals. Compound
summaries use full messages with interpolated exact formatted amounts.

Persian wording is provisional pending native financial terminology review and
RTL workflow qualification. Catalog parity and server rendering do not close
those gates.

## Contracts and explicit exceptions

- Canonical statuses/methods, select values, routes, IDs, account codes and caller
  names/descriptions/notes remain data. Unknown status/method codes remain visible
  verbatim; mappings use own-property checks. React escapes caller content.
- Existing fixed two-decimal cents, dollar prefix/preview `$0.00`, exact-money
  adapters and bigint aggregates remain unchanged. Numeric input samples
  `10000.00`, `500.00`, `60`, identifier example `FA-001`, percent/sign punctuation,
  journal `#` labels and missing-value dashes remain literal. Currency, numeral,
  calendar and date formatting qualification belongs to later L10N work.
- The existing list date formatter remains en-US; stored dates and history dates
  remain canonical. Lifecycle step numbers 1/2/3 remain presentation markers.
- Successful responses still pass through `assetLoanJson`; presentation guards
  check expected collections/assets before adoption. Invalid aliases and malformed
  JSON/HTML/response shapes use localized operation fallbacks. HTTP 401/403,
  400/422 and `LEGACY_NUMERIC_RANGE` receive reviewed messages. Known local cents
  and useful-life input errors translate; unknown server/network/parser prose
  never reaches the UI. CWIP read failures now surface instead of looking empty.
- Loaders ignore cancelled work; failed operations keep dialogs open and clear
  saving flags. Creation without an organization does not begin saving. Existing
  payload keys, nulls, optional fields, org headers, methods, confirmation choices
  and redirects remain unchanged. Partial disposal data still merges with the
  prior depreciation history.
- No REST/MCP, service, money adapter, DB schema or migration change. Existing
  asset-master, depreciation, valuation and CWIP tools supply these operations.
  Stripe is unchanged under DEC-008.

## Verification and handoff

[Production rendering/callback tests](../../tests/fixed-asset-catalogs.test.ts)
use the real presentation provider, translations, tables, fields and money with
controlled hook state and inline dialog/select portals. This is server rendering
and direct production callback execution, not mounted browser acceptance.
[Existing exact-money checks](../../tests/asset-loan-ui-money.test.ts) follow the
presentation helper to its unchanged validator; financial assertions are retained.

See [implementation evidence](../evidence/LOC-035-attempt-1.md) and
[self-review](../evidence/LOC-035-review-1.md). Native Persian, RTL, browser,
hosted CI, production data and independent parent acceptance remain open.
