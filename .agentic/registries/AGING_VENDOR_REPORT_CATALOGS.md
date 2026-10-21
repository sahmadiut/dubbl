# Aging, payment and vendor report catalogs

LOC-107 owns 59 paired AgingVendorReports messages across aged receivables,
aged payables, payment performance, vendor spend and duplicate detection.
Titles, descriptions, table/stat labels, empty states, counts, day units,
known aging bucket labels and finite read failures are localized. Duplicate
document types use this namespace; known invoice/bill statuses reuse
SalesInvoices/SupplierBills through their existing finite helpers.

Explicit exceptions: caller contact names, document numbers, unknown status
codes, raw Gregorian due dates, existing English short-month document dates,
currency codes, numeric percentages/counts, symbolic percent/dash and tooltip
name/percentage formatting retain existing presentation. Full calendar/numerals
and RTL qualification remain separate. Persian wording is provisional.

Back links, loaders, date controls, currency select, data table, error state and
export control retain their shared catalog ownership. Service bucket labels
remain canonical in CSV; only display labels are mapped. Export column keys,
filenames, document types, exact Minor values, currency scales and bigint
arithmetic are unchanged. Request paths, Gregorian queries, organization headers,
currency filter and cleanup guards are preserved. Boolean error state prevents
raw network/server/validation prose from reaching the page.

Existing aged_receivables, aged_payables, payment_performance, vendor_spend and
duplicate_detection MCP operations and REST readers retain their scoped shared
services and permissions. No new operation, REST/MCP/schema/migration/money/FX/
IRR flag or Stripe change is introduced. LOC-070/008/002 retain independent
combined acceptance; native terminology and full RTL/browser/output/release
qualification remain open. See [evidence](../evidence/LOC-107-attempt-1.md).
