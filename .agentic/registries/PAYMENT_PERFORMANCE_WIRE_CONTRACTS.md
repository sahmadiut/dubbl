# MON-113 payment-performance contracts

Verified 2026-10-08 with actual API-key REST handlers, registered MCP clients,
and migrated disposable PostgreSQL. Technical self-review only. MON-102 and
MON-029 retain their combined integration acceptance.

| REST | MCP | Money fields and exact aliases |
|---|---|---|
| GET /api/v1/reports/payment-performance | payment_performance (new) | receivables[].totalCollected/totalCollectedMinor; payables[].totalPaid/totalPaidMinor |

## Inputs, outputs and units

Both readers accept optional startDate, endDate and currencyCode. Dates are real,
inclusive Gregorian YYYY-MM-DD in years 0001..9999, selected by document issueDate.
Independent defaults are current UTC year January 1 and UTC today. Reversed
ranges reject. Currency is a supported uppercase ISO code; a filter includes only
matching invoice and bill currencies. Without a filter, all included documents
across both arrays must share a currency. Empty reports carry the filter or the
organization default (USD if unset). No implicit FX conversion, rescaling,
input money, exact-only negotiation or new format parameter is supported.

Money retains the legacy integer cents/minor-unit values, with numeric safe
integers and additive canonical signed integer Minor strings in every response.
USD/IRR/JPY/KWD 1250 stays 1250. Both legacy and exact consumers receive both
aliases. Each consumed source amount and exposed contact total must fit
+/-9007199254740991. Bigint aggregation permits intermediate cancellation
outside that range. There is no cross-contact or cross-side money total.

Existing root startDate/endDate, avgDaysToCollect/avgDaysToPay and contact arrays
remain; currencyCode is additive. Names/IDs retain their meaning. invoiceCount,
billCount and lateCount are safe numeric counts. avgDays and avgTermDays are
integer calendar-day averages, rounded with exact Math.round semantics (negative
ties toward positive infinity). onTimeRate is a whole numeric percentage in
0..100, computed from document counts; these non-money fields have no Minor
aliases. Each root day summary intentionally preserves the existing count-weighted
average of rounded contact means, rounded again; it is not a global raw mean or
a money-weighted mean. Empty sides return day summary 0 and an empty array.

## Selection and safety

getPaymentPerformance is the direct-Drizzle shared service, using one repeatable-read
read-only transaction. Both routes require view:data, including the formerly
unguarded REST reader. API-key authentication enforces organization context even
with a conflicting organization header. Invalid keys yield 401; denied custom
permissions yield 403; a missing organization yields 404. MCP receives
AuthContext at registration and uses wrapTool, with no HTTP self-calls.

Only status=paid, non-deleted documents with non-null paidAt and issueDate inside
the period qualify. Payment dates can fall outside the selected issue period.
Day differences retain the saved timestamp-without-time-zone paidAt::date
semantics; time of day is ignored. dueDate minus issueDate measures term days.
Late means paidAt::date > dueDate, so payment on the due date is on time. Signed
historical totals, negative days and negative terms are retained. This reports
stored payment timing and gross document total, not allocation timing, settlement
FX, credit applications or new jurisdiction-specific accounting policy.

Contacts are joined with organization and non-deleted scope. Historical foreign
or deleted contact references retain their ID and contribution with name Unknown;
their names cannot leak. No foreign-organization document enters the result.
Contact ordering compares unrounded rational average payment days descending,
then contact ID. This replaces the previously unbound SQL ordering alias.

SQL text money projections avoid narrowing through the transitional Number ORM.
Checked date fields reject unsupported saved dates (including infinity and year
10000). Guarded SQL differences let these dates reach the classified validator
instead of causing a database arithmetic failure. Invalid/unknown/duplicate REST
parameters, empty dates/currency, reversed ranges and unsupported currency filters
yield 400. MCP schema and shared validation reject invalid known inputs; the shared
service is strict about unknown fields. Mixed currencies, unsupported stored
currency/date/amount or unsafe contact totals yield 422 LEGACY_NUMERIC_RANGE.
No bigint reaches an unguarded JSON serializer; reads/errors preserve financial
and audit state. API-key lastUsedAt bookkeeping is outside that snapshot.

## Dashboard and limits

The existing dashboard now offers a document-currency filter and clear action,
shows report errors, and renders money from exact aliases using currency metadata
and exact decimal conversion. CSV retains timing columns and additionally exports
counts, currency and exact collected/paid strings; stale/loading/error data cannot
be exported. This report remains a JSON REST/MCP reader with client-side CSV,
without new PDF/XLSX operations.

Fixtures assert empty/default reports, inclusive issue-date bounds independent of
payment year, due-date/time-of-day and negative-half rounding, count-weighted
summary semantics, late percentage, scoped labels, legacy/exact alias consumption,
three currency scales, cross-side mixed currencies, safe signed edges, exact
cancellation, unsafe source/group totals, invalid saved dates, authentication,
permissions and unchanged domain/audit snapshots.

No schema/migration/history rewrite, application database access, full-int64
business-path qualification, IRR enablement, build, dev server or deployment.
Selected rows are aggregated in memory; high-volume performance remains unqualified.
Browser interaction was inspected in source; no live browser session was run.
