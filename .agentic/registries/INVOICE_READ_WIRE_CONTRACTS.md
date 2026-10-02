# Invoice read contracts (MON-038)

2026-10-03, Asia/Tehran. Additive safe-number contracts, implemented in shared
direct-DB `lib/api/invoice-reads.ts` and `invoice-read-wire.ts`. No public exact-mode
switch, invoice mutation, stored-unit change, schema change or IRR enablement.
MON-019 retains combined integration after MON-038 through MON-045.

## Operations and envelopes

| REST | MCP | Inputs | Response |
|---|---|---|---|
| GET `/api/v1/invoices` | `list_invoices` | Optional status/contact/date range/page/limit/sort | REST `{data,pagination}`; MCP `{invoices,total,page,limit}` |
| GET `/api/v1/invoices/:id` | `get_invoice` | Invoice UUID; MCP `invoiceId` | REST `{invoice,payments,base}`; MCP retains `{invoice}` |
| GET `/api/v1/invoices/summary` | New `get_invoice_summary` | None | Same count/total/aging envelope on both transports |

All operations use the authenticated organization. API keys supply organization
scope despite a conflicting `x-organization-id` header. MCP receives AuthContext
at registration and uses `wrapTool`, with no HTTP self-calls. Reads retain existing
access policy: authenticated members, including custom roles without write
permissions, can read. Foreign or soft-deleted invoice IDs return 404. No period
lock or posting action is needed for reads. Auth-key last-used metadata can change;
invoice/line/payment/allocation/rate/journal/audit data is not written.

## Fields and units

| Location | Retained numeric money | Added exact strings | Currency / other units |
|---|---|---|---|
| Invoice header, both list/detail | `subtotal,taxTotal,total,amountPaid,amountDue` | Each field plus `Minor` | Invoice `currencyCode`; stored integer minor units, USD cents |
| Detail lines | `unitPrice,amount,taxAmount` | `unitPriceMinor,amountMinor,taxAmountMinor` | Inherit invoice currency; quantity remains hundredths, discountPercent remains basis points |
| Nested contact | Nullable `creditLimit` | Nullable `creditLimitMinor` | Contact currency, not silently reinterpreted as invoice currency |
| REST allocated payments | `amount` | `amountMinor` | Stored document allocation units; payment's own currency may differ at settlement |
| REST `base.amounts` | Header amount fields, or null | Each field plus `Minor`, or null | `baseCurrency`, explicit guarded display conversion |
| Summary | `outstanding,overdue` | `outstandingMinor,overdueMinor` | One explicit `currencyCode`; null when no contributing invoices |
| Each summary aging bucket | `amount` | `amountMinor` | Same summary currency; count is a count |

Canonical integer string aliases preserve signed stored values. USD/IRR/JPY/KWD
1250 remains 1250; no /100 or currency-scale rescaling occurs on document reads.
Amounts are supported only within +/-9007199254740991 while numeric fields remain
mandatory. Unsafe/fractional/nonfinite monetary Numbers or bigint totals fail with
422 `LEGACY_NUMERIC_RANGE`. Aliases are never reconstructed from unsafe Numbers.
The ORM's safe-number adapter rejects unsupported stored values too.

Historical contact/account/tax-rate relations are allowed to be inactive/deleted,
but cross-organization relations reject the entire response with 422 before
foreign labels/data are returned. Allocated payment parents must belong to the
invoice's organization; unsafe allocations also reject REST detail reads. MCP
detail has no payment-history envelope, preserving its actual existing behavior.
Opaque sender/recipient snapshots are unchanged and retain MON-034 ownership.

## Base display FX

REST detail retains issue-date historical-rate lookup and freshness/status metadata.
This is display data, not a saved invoice posting rate. `rateExact` is the exact
decimal representation of the **six-place rate actually used for display**;
`rateDirection` is `quote_per_base` (organization base currency per document
currency), and `rateBasis` is `historical_lookup_millionths`. These fields do not
claim persisted invoice FX or the provider's unrounded quote. Posting-history FX
remains the relevant journal/domain task.

Identity conversion passes safe stored values through. Other rates must fit
positive int32 millionths, source/target currency scales must match, and each
amount * rate product must fit the signed safe-number range before conversion.
Exact bigint ratio rounding matches legacy Math.round's tie toward positive
infinity, including signed inputs. Missing rates preserve existing null amount
outputs, with null aliases and null `rateExact`; no 1:1 fallback is invented.
Future/foreign-organization rates do not enter issue-date lookup. Unsupported
cross-scale display/product ranges fail with 422; full-range and cross-scale FX
remain MON-007/008. Stored document amounts are never changed by display lookup.

## Summary and aging

Count all nondeleted invoices in the authenticated organization. Outstanding and
overdue totals include `sent`, `partial`, `overdue` rows; overdue includes only
`overdue`. Positive outstanding amounts enter four existing aging buckets:
`current`, `1-30`, `31-60`, `60+`. Days retain elapsed UTC-day calculation from the
Gregorian due date. Signed/zero balances still affect outstanding totals/counts,
but do not enter positive aging. No new timezone/calendar policy is introduced.

The summary reads count and rows in a repeatable-read, read-only transaction.
Amounts are selected as SQL text and summed as bigint; no SQL int32 cast or
Number accumulation remains. Individual values, final totals and every aging
bucket must fit safe compatibility, even when signed offsets make the net safe.
All contributing statuses must share a currency, including zero-balance rows;
mixed currencies fail with 422 instead of summing unlike units. Draft/paid/void,
other-tenant and soft-deleted monetary rows do not contribute. An empty summary
returns zero numeric/string totals and null currency. This does not qualify
dashboard/report currency conversion or change those separate endpoints.

## Filters and errors

REST `from/to` map to MCP `startDate/endDate`: inclusive canonical Gregorian
YYYY-MM-DD issue dates. Optional contact is a UUID. All schema invoice statuses,
including `pending_approval` and `rejected`, are supported. Sort columns are
date/due/total/amountDue/number/created; direction asc/desc; defaults created/desc.
REST retains pagination parsing/clamping for ordinary numeric inputs (default 1/50,
limit 1..100). MCP validates page >=1, limit 1..100; both reject invalid/NaN/huge
pages, reversed dates, malformed dates/IDs/status/sort with validation errors.
Page maximum is 21474836 to bound SQL offset with the maximum limit.

REST errors: authentication 401, invalid request 400, missing/scoped-out ID 404,
unsupported monetary/history/scope/summary currency 422. MCP returns `isError`
via the SDK/wrapper; classified service failures carry status/code, while SDK
input-schema rejections need not have the wrapper envelope. No negotiation header
or legacy removal date is introduced.

## Verification and remaining ownership

Four pure unit groups cover unit preservation, nested aliases, safe extremes,
signed display rounding/products/scales/null rates, sums/aging and invalid filters.
`tests/integration/invoice-reads.test.ts` migrates a random disposable PostgreSQL
database and invokes actual REST/API-key/custom-role reads and registered MCP
SDK tools. Covers int32-plus/safe-max, tenant/contact/account/tax/payment isolation,
unsafe raw history, filters/pagination, missing/issue-date/foreign/future rates,
exact summaries, overflow/mixed-currency rejection and before/after data snapshots.
HTTP/session/OAuth/browser, accounting qualification, invoice writes/lifecycle,
quotes/credits/receipts/templates/bulk remain their assigned tasks.
