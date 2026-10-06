# MON-114 spend and sales analytics contracts

Verified 2026-10-07 using actual API-key REST handlers, registered MCP clients,
and migrated disposable PostgreSQL. Technical self-review. MON-104 retains all
operational report integration criteria and MON-029 combined report acceptance.

| REST GET under /api/v1/reports | MCP tool | Money outputs and matching exact strings |
|---|---|---|
| vendor-spend | vendor_spend (new) | root totalSpend/totalSpendMinor; vendors[].totalSpend/totalSpendMinor and avgBillAmount/avgBillAmountMinor; monthlyTrend[].total/totalMinor |
| sales-by-customer | sales_by_customer | customers[] and totals: net/netMinor, tax/taxMinor, gross/grossMinor |
| sales-by-item | sales_by_item | items[] and totals: net/netMinor, tax/taxMinor, gross/grossMinor |

## Inputs and units

All three accept optional startDate, endDate and currencyCode. Dates are real
Gregorian YYYY-MM-DD, years 0001..9999, inclusive and ordered. Omitted dates
default independently to current UTC year January 1 / UTC today. Currency is a
supported uppercase ISO code; omitted currency selects the single included
document currency, or organization default for empty results. Explicit currency
filters include only matching documents; an empty filtered result carries that
currency. No input amounts, implicit FX conversion or new exact-only mode.

Both sales REST routes additionally accept format=json (default), pdf or xlsx,
case-insensitive, with the existing filenames. Vendor spend remains JSON only.
Unknown or duplicate REST parameters, empty dates/currency/format, unsupported
formats/currencies and reversed ranges reject with 400. MCP fields have explicit
descriptions and typed schemas, with the same service validating known fields,
dates and ordering. No custom header negotiates an output representation.

Money retains existing integer cents: USD/IRR/JPY/KWD 1250 stays integer 1250.
Every exposed amount has a numeric field plus an additive canonical signed
integer string named by appending Minor. Both clients receive both fields.
Aliases for average bills describe the existing rounded average, not a fractional
mean. IDs, names, item codes, dates and counts keep their existing meaning.
Item quantity is a numeric integer in hundredths (100 = 1.00 physical unit);
counts, vendor percentage and quantities do not get money aliases. Percentages
remain numeric percent rounded to two places; nonpositive denominator gives 0.
The rounded integer hundredths of each percentage must fit the safe numeric range.
Average and percentage rounding use exact rational Math.round semantics,
including negative ties toward positive infinity.

## Selection, scope and computation

getDocumentAnalytics is one direct-Drizzle service in a repeatable-read read-only
transaction, shared by REST and MCP. Every report requires view:data, including
the formerly unguarded vendor route. Actual authentication rejects invalid keys
with 401; denied built-in/custom permissions return 403; missing organization
returns 404. MCP uses AuthContext and wrapTool, with no HTTP self-calls.

Documents exclude draft, void and soft-deleted rows, preserving the existing
other-status selection (including pending_approval/rejected). No new status
accounting qualification is claimed. Vendor spend consumes bill.total; sales
consume invoice_line.amount and tax_amount, independent of header total, saved
unit price or FX. Sales reports count distinct invoices per customer and physical
lines per item; null item references remain Uncategorized. Item counts never
replace distinct-customer invoice counts. Signed returns/refunds remain signed.

Owned, non-deleted contacts/items supply labels. Malformed historical foreign or
deleted references cannot disclose their names/codes: document reference IDs are
retained with Unknown/Unknown item and null code. Vendor bills retain spend even
when their contact label is unavailable. Neither unrelated tenant rows nor their
labels enter the totals. Sorting compares bigint totals descending, with stable
reference-ID ties. Vendor monthly trends include only the top five vendors,
ordered by month then contact ID. The previous unbound SQL total_spend ordering
and array interpolation are replaced by the same scoped snapshot calculation.

SQL text projections preserve each consumed money integer before the transitional
Number ORM. Each source amount and exposed amount must fit signed safe numeric
range +/-9007199254740991; bigint sums/products allow intermediate cancellation
above that range without rounding. Unsupported saved amounts/currencies/dates,
mixed included currencies without a filter, unsafe group/month/root/gross totals
or numeric physical/count totals fail with 422 LEGACY_NUMERIC_RANGE. Bigint never
reaches unguarded JSON. There is no promotion to full-int64 output or magnitude
dependent type/scale change. A currency filter can isolate supported documents
from other historical currencies; no history is repaired or rescaled.

## Exports and verification limits

Sales PDF/XLSX consume the checked statement from the same snapshot as JSON.
Existing exporters apply selected currency display metadata (USD two places,
JPY/IRR zero, KWD three) to fixed input integers. PDF formats exact integers;
numeric XLSX cells must satisfy decimal round-trip and Excel 15-digit precision,
otherwise 422. Export values cannot silently round to satisfy compatibility.
No new binary MCP operation is added; existing sales tools remain JSON readers.

Fixtures cover both actual legacy/exact document-writer inputs, empty/default
reports, filters/status/date boundaries, multiple lines on one invoice, null and
foreign labels, distinct counts, top-five ranking, averages/percentages, signed
safe edges, exact cancellation, unsafe stored inputs/root/gross totals, both sales
exporters, currency units, authentication/permissions and financial/audit snapshots.
Authentication lastUsedAt bookkeeping is outside the read-only financial snapshot.

No schema/migration changes, application database access, production IRR enablement,
deployment or financial-history correction. This implementation aggregates narrow
selected source rows in memory; high-volume/performance qualification and full
signed-int64 business paths remain later gates. MON-115..118 retain the remaining
ledger/KPI, forecast/FX, banking and recurring/calendar/duplicate surfaces.
