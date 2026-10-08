# MON-118 recurring, calendar and duplicate reports

All three GET routes and MCP tools use the same direct-DB, organization-scoped,
repeatable-read, read-only services with `view:data`. They take no monetary inputs
and perform no financial mutations. API keys retain their own organization even
when a different `x-organization-id` is supplied.

| REST under `/api/v1/reports/` | MCP | Inputs | Outputs and units |
|---|---|---|---|
| `recurring-transactions` | `recurring_transactions` | Optional live owned `bankAccountId`, including inactive history; `minOccurrences` integer 2-10000, default 2 | Existing `patterns`, at most 50. Each has `currencyCode`; numeric integer `avgAmount`, `minAmount`, `maxAmount` plus matching `*Minor` strings. Last five `transactions` have `amount`/`amountMinor`. Counts/interval days are ordinary integers. |
| `financial-calendar` | `financial_calendar` | Inclusive Gregorian `startDate`/`endDate`, UTC today/start plus 60 days by default; optional supported uppercase `currencyCode` filter | Existing `startDate,endDate,events`. Each event adds `currencyCode` and `amountMinor` to numeric integer `amount`. Due documents use their saved currency/amountDue; recurring estimates use saved template currency; budget periods inherit organization base currency. |
| `duplicate-detection` | `duplicate_detection` | Empty strict object; no REST query parameters | Existing `duplicateGroups,totalGroups`. Each group adds `currencyCode` and canonical `amountMinor` to integer `amount`; items retain id/number/date/status. |

All source and final displayed money is supported within +/-9007199254740991,
with unchanged stored integer units. USD 1250 remains 1250 cents; IRR/JPY/KWD
1250 stays 1250 without rescaling. SQL text projections avoid transitional ORM
precision loss. Bigint intermediates may exceed that range: recurring averages
can safely sum large rows and calendar prices multiply hundredth quantities
before rounding. Source amounts, per-line extended amounts and final subtotals
must fit the numeric contract. Numeric and exact clients receive both aliases;
there is no full-int64 or representation-negotiation mode. Unsupported saved
money/currency/schedules return `LEGACY_NUMERIC_RANGE` (REST 422/MCP error), never
rounded numbers or JSON bigint exceptions. Empty valid reports remain empty.

Strict schemas reject unknown/repeated REST parameters, malformed UUIDs, partial
numeric parsing, noninteger/out-of-range occurrence thresholds, impossible dates,
reversed ranges and unsupported currencies (REST 400). Default end-date overflow
past year 9999 is a 400 requiring explicit endDate. Missing/foreign/deleted bank
IDs return the same 404 before any movements are selected; authentication and
permissions remain 401/403. Bank movements are joined only to live owned accounts;
excluded movements are omitted. A non-null movement currency must agree with its
bank currency; null inherits bank currency.

Recurring patterns retain the existing English-only description normalization:
lowercase/trim, strip digits and non-ASCII letters, collapse whitespace. Groups
now include currency, so movements in different currencies never enter one
average. Same-currency owned banks can share a pattern. Transactions order by date
then UUID; patterns sort by count descending, normalized description and currency.
Average money uses exact Math.round semantics, including negative ties toward
positive infinity. Interval days, heuristic frequency buckets, sign direction and
last-five behavior are retained. Zero or mixed signs produce mixed direction.

Calendar invoice/bill due dates are inclusive and omit draft/void/paid/deleted
documents. Contact labels independently require the same org and a live contact;
otherwise they fall back to Customer/Supplier or an empty recurring counterparty.
All active live templates are projected through the requested horizon, replacing
the previous silent five-occurrence truncation. Saved end/max/generated limits
apply, including consuming overdue occurrence slots. A 10000 traversed-occurrence
bound rejects unsupported backlogs instead of returning an incomplete calendar.
Saved UTC month overflow is preserved (January 31 can advance into March).
Estimates retain sum(round(quantity/100 * unitPrice)), with ties toward positive
infinity and no tax/discount/FX calculation. Journal-template debit/credit legs
are not included in this legacy estimate; ordinary journal templates therefore
show zero and this calendar is not a posted ledger or generation preview.
Active live budget periods are selected through scoped parents. Events retain
individual currencies; no combined money total is invented. Date/type/id or title
ties are ordered deterministically.

Duplicates retain the existing heuristic: whole groups must have identical
contact, total and a maximum-minus-minimum issue-date span <=7 days. They now also
require equal currency and a live owned contact; void/deleted documents and
foreign/deleted contacts are excluded. Draft and paid carriers remain eligible.
An eight-day group produces no result, even if some pairs are close together;
this is not pairwise rolling-window deduplication. A single ordered JSON aggregate
keeps item fields aligned; item order is issue date then UUID. No records are
deleted or merged.

Calendar and duplicate pages show server/network errors, currency codes and exact
currency-scaled formatting of safe numeric aliases. Calendar requests construct
canonical local month dates without converting local midnight through UTC and
shifting the visible month. No report server-side export was present or added.

Verification: `tests/operational-wire.test.ts` and actual migrated PostgreSQL,
API-key routes and MCP SDK fixtures in `tests/integration/operational-reports*.ts`.
Fixtures exercise numeric/Minor document writers, recursive alias agreement,
strict validation, denied permissions, foreign/deleted bank IDs and contact
labels, currency groups/filtering, top-50/last-five limits, UTC month overflow,
more than five projected weekly dates, signed safe edges, exact average/product
rounding, source/line/subtotal overflow, backlog bounds and unchanged financial
snapshots. No schema/migration/history/IRR flag change. MON-104/MON-029 retain
combined acceptance; full-range, independent accounting, performance and
production qualification remain separate.
