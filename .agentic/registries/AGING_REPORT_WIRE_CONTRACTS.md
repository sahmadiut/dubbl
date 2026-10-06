# MON-111 aging report contracts

Verified 2026-10-07 from the implemented REST/MCP services and actual migrated
PostgreSQL fixtures. Technical self-review only; MON-102 retains contact statement,
payment-performance and integration acceptance. MON-029 retains report integration.

| REST boundary | MCP operation | Result |
|---|---|---|
| GET /api/v1/reports/aged-receivables | aged_receivables | asAt, currencyCode, buckets with invoices, grandTotal and grandTotalMinor |
| GET /api/v1/reports/aged-payables | aged_payables | asAt, currencyCode, buckets with bills, grandTotal and grandTotalMinor |
| Both routes with format=pdf or xlsx | export_financial_statement with statement=aged_receivables or aged_payables | Same shared statement; REST attachment, MCP filename/MIME/base64 envelope |

All operations use `getAgingReport`, direct Drizzle and organization-scoped
AuthContext. They require view:data, including aged branches of the existing
multi-statement export tool. The shared service takes one read-only repeatable-read
snapshot of the organization, documents, contact projection and payment allocations.
No report/audit/ledger writes; ordinary API-key authentication can update lastUsedAt.

## Inputs, modes and dates

- Optional asAt is a real Gregorian YYYY-MM-DD, years 0001-9999, inclusive.
  Explicit asAt activates historical reconstruction, includes currently paid
  documents issued on/before the date, and subtracts non-deleted payments dated
  on/before it. Nonpositive reconstructed balances are omitted. Credit/debit-note
  carrier allocations to the actual invoice/bill count once as settlement.
- Omitted asAt retains the existing live mode: stored amountDue on non-paid
  documents, including zero/negative balances and future issue dates. The returned
  asAt and aging day difference use UTC today. Current and explicit-today reports
  intentionally differ in their source of open balances and selection.
- Draft, void and soft-deleted documents are excluded in both modes. Historical
  mode uses current document status/total and allocation history; it is not a
  complete event-sourced reconstruction of voids, writeoffs or edits after cutoff.
  Historical writeoff/status semantics remain independent financial qualification.
- Optional currencyCode is an uppercase supported ISO code. It filters saved
  document currency without FX conversion. Without a filter, included items must
  share one currency or the report rejects. Root currencyCode comes from those
  items, or the explicit filter, or current organization default for empty output.
  It is not an assumed base currency for document sums. USD/IRR/JPY/KWD integers
  are not rescaled. Empty filtered reports retain that currency and zero aliases.
- REST format defaults to json; json/pdf/xlsx accept any casing. Unknown or
  duplicate parameters, empty values, unsupported formats/currencies and invalid
  dates reject with 400. REST accepts only asAt/currencyCode/format. MCP aging
  input is strict asAt/currencyCode. Every field describes its units and mode.
- MCP export adds optional asAt/currencyCode only for aged statements. Existing
  from/to remain ignored for aging. Other statement branches reject the new
  aging-only fields and retain their independently owned contracts. The export
  tool's existing envelope and statement/format names are preserved.

## Outputs, units and compatibility

JSON retains safe integer numeric cents (the legacy fixed unit) and adds canonical
integer-string aliases simultaneously, with no version header or client opt-in:

- Each invoice/bill item: amountDue and amountDueMinor, plus document currencyCode.
  Existing id, invoiceNumber/billNumber, contactName, dueDate and daysOverdue remain.
- Each bucket: total and totalMinor, label, count and the invoices/bills array.
- Root: grandTotal and grandTotalMinor, asAt and currencyCode.

Saved inputs and every emitted item, bucket and root money value must fit
[-9007199254740991, 9007199254740991]. Transitional money-column ORM rejects
unsupported bigint history; aliases cannot recover rounded Numbers. Derived
allocation sums, subtraction, bucket and root sums use bigint, so safe final
values survive intermediate sums outside Number precision. Unsupported final
fields fail even when another bucket cancels the root. Full-int64 business/client
support remains MON-007/008 and parent qualification.

Bucket boundaries are Current (<=0 days), 1-30, 31-60, 61-90 and 90+ (>90);
daysOverdue is clamped to zero for current/future items. Counts are document counts,
dates are dates, and neither gets money aliases. Document ordering is deterministic
by issueDate then UUID within buckets. Scoped undeleted contact projection returns
Unknown for unavailable/foreign legacy contact references, never a foreign name.

Historical allocations join payment.organizationId to the authenticated organization;
foreign/deleted/future payments cannot reduce balances. Included local allocations
must have positive safe amounts, matching document contact/currency and received
(AR) or made (AP) type; inconsistent history rejects. No FX is repeated.

Exports use the same guarded sums and the existing currency-scaled renderer: 1250
displays 12.50 USD, 1250 IRR/JPY or 1.250 KWD. This preserves export display scale
while JSON fixed integers stay unchanged. PDF formats exact integers. XLSX numeric
cells additionally require decimal round-trip and Excel's 15-digit precision,
otherwise 422; JSON-safe amounts need not be spreadsheet-safe. Existing text/formula
escaping remains in the shared renderer. No new layout/localization qualification.

## Errors and evidence

Bad API keys return 401; denied read permission 403; missing organization 404.
REST malformed input returns 400; registered MCP validates its schema and returns
an error. Unsupported saved dates/currencies/allocation references, mixed currencies,
unsafe inputs/results or lossy XLSX cells return 422 LEGACY_NUMERIC_RANGE on both
transports. No partial report, bigint crash or mutation on failure.

`tests/aging-wire.test.ts` exercises strict inputs, Gregorian/UTC bucket boundaries
and signed bounds. `tests/integration/aging.test.ts` invokes real API-key handlers,
registered MCP SDK clients, legacy/exact document writers and both binary renderers
on disposable migrated PostgreSQL. It checks tenant/payment/contact scope, custom
role denial, live/history/carrier/future/deleted selection, currency filters/scales,
intermediate cancellation, signed safe edges, stored/result overflow and unchanged
financial/audit snapshots. No application DB, provider/email call, schema/migration,
build/dev server or IRR production flag change is involved. High-volume performance,
independent accounting, full-range and combined report acceptance remain open.
