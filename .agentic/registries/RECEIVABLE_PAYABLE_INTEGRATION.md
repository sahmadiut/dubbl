# Combined aging, contact statement and payment-performance contracts (MON-102)

Verified 2026-10-08, Asia/Tehran. This parent independently integrates MON-111,
MON-112 and MON-113. Their detailed maps and original evidence remain intact.

| REST boundary under /api/v1/ | MCP operation | Inputs | Output and exact aliases | Detailed contract |
|---|---|---|---|---|
| GET reports/aged-receivables | aged_receivables | asAt, currencyCode | Numeric item amountDue, bucket total, grandTotal with matching Minor strings | [Aging](AGING_REPORT_WIRE_CONTRACTS.md) |
| GET reports/aged-payables | aged_payables | Same | Same, with bills in buckets | [Aging](AGING_REPORT_WIRE_CONTRACTS.md) |
| Both aging routes, format=pdf/xlsx | export_financial_statement, statement=aged_receivables/aged_payables | asAt, currencyCode, format; existing from/to ignored for aging | REST attachment; MCP filename/MIME/base64 envelope; same scoped statement | [Aging](AGING_REPORT_WIRE_CONTRACTS.md) |
| GET reports/payment-performance | payment_performance | startDate, endDate, currencyCode | Per-contact totalCollected/totalPaid and Minor strings; counts, days, percentages keep their units | [Performance](PAYMENT_PERFORMANCE_WIRE_CONTRACTS.md) |
| GET contacts/[id]/statement | get_contact_statement | contact UUID, startDate, endDate, currencyCode | Opening/closing balances, debit/credit/period totals and matching Minor strings | [Contact](CONTACT_STATEMENT_WIRE_CONTRACTS.md) |
| GET contacts/[id]/supplier-statement | get_purchasing_supplier_statement | Same, supplier/both contact | Positive AP balance; totalBilled/totalPaidOrCredited and Minor strings; MCP retains {statement} | [Contact](CONTACT_STATEMENT_WIRE_CONTRACTS.md) |
| GET contacts/[id]/activity | get_contact_activity | UUID, optional dates, limit 1-100, cursor, type | {activity,nextCursor,hasMore}; per-item amount/amountMinor/currencyCode | [Contact](CONTACT_STATEMENT_WIRE_CONTRACTS.md) |
| GET contacts/[id]/statement/pdf | export_contact_statement | Statement inputs; REST retains orgId selection | Existing printable HTML; MCP {html,mimeType}, escaped text and exact money display | [Contact](CONTACT_STATEMENT_WIRE_CONTRACTS.md) |
| POST contacts/[id]/statement/email | email_contact_statement | Statement inputs, saved contact recipient/organization SMTP | {success:true}; full permission/date/currency/money preflight before delivery | [Contact](CONTACT_STATEMENT_WIRE_CONTRACTS.md) |

No report money inputs. Source and every emitted money value must fit
[-9007199254740991,9007199254740991]. Numeric integer units retain the existing
contract (USD cents); corresponding canonical integer strings carry the same
value. No FX or historical rescaling. Single-currency totals reject mixed data
without a supported uppercase ISO filter; activity retains per-item currencies.
Print/email/XLSX scale by currency metadata (USD 1250 -> 12.50, IRR/JPY 1250 ->
1250, KWD 1250 -> 1.250). Gregorian date-only years 0001-9999 are inclusive;
default dates and live/history modes remain as documented in the child maps.

All reads require view:data; email additionally requires manage:contacts. API
keys stay bound to their organization despite conflicting headers. Contact
boundaries require an owned undeleted UUID. Invalid/duplicate/unknown REST
parameters and unknown email body fields reject. Registered MCP contact and
financial-export tools now use complete strict Zod objects, preventing SDK
stripping of unknown fields before shared validation. Known inputs, tool names,
descriptions and output envelopes are preserved. Export strictness applies to
the shared tool's other statement selections as well; no financial computation
in those branches changes.

Invalid keys return 401, denied permissions 403, foreign contacts 404, invalid
inputs 400/schema errors. Unsupported stored/output money and mixed currencies
return 422 LEGACY_NUMERIC_RANGE. Bigint stays internal; JSON numeric and exact
aliases agree. Read/error snapshots preserve documents, allocations, journals,
audit and email configuration. API-key lastUsedAt bookkeeping is excluded.

## Combined fixture and accounting interpretation

tests/integration/receivable-payable-integration.test.ts/worker creates invoices
through actual legacy/exact REST writers, bills through registered MCP writers,
recognizes them with existing services and settles through actual REST/MCP cash
operations. PaidAt uses settlement wall-clock time in the application; the
fixture separately pins retained timing dates for deterministic performance
assertions. It does not claim cash date and paidAt are the same field.

At February cutoff, AR 2147484448 minus AP 1500 equals the general closing
statement 2147482948; AP-only statement equals aged payables. Opening statement
300 follows prior invoices/bills less prior cash. A March payment reduces live
AR to 800, but explicit February aging and statement exclude that future cash.
Performance deliberately measures gross paid documents issued in February,
including the March-paid document: totalCollected 2147484898 is not a cutoff
cash-flow or outstanding-balance total. Credit/debit-note carriers and drafts
retain the selection differences independently asserted by the child suites.

The parent asserts full REST/MCP payload parity, every numeric/Minor alias,
owned/foreign organizations, invalid keys, denied and permitted custom readers,
unknown/invalid input, real USD XLSX totals and foreign-export isolation,
IRR/JPY/KWD filtered values/display scales, activity mixed currencies, stored
int64 rejection and unchanged domain/audit snapshots. Statement print/email
agree through recorded SMTP, including no delivery on preflight errors. Child
suites retain signed safe-edge/cancellation/overflow, allocation/currency/date,
pagination, escaping and PDF signature checks.

Public portal/token statement routes retain their existing owner and output;
this integration does not edit their calculations or authentication. Historical
aging is not event-sourced reconstruction of later voids/writeoffs/edits.
Timestamp-only activity cursor ties, full-int64 clients, high-volume performance,
browser/session authentication, visual PDF/print fit, real SMTP/provider behavior,
independent accounting and production IRR qualification remain separate gates.
No schema/migration/history/production flag change. MON-029 retains broader
report integration acceptance.
