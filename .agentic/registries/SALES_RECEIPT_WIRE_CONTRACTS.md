# Sales receipt wire contracts (MON-043)

Verified 2026-10-03 (Asia/Tehran). Shared Drizzle services in
`lib/api/sales-receipts.ts` serve authenticated REST handlers and the existing
`registerSalesReceiptTools(server, ctx)` registration. No HTTP self-calls, public
negotiation header, schema change or IRR enablement.

## Operations and envelopes

| REST | Registered MCP tool | Inputs and result |
|---|---|---|
| GET `/api/v1/sales-receipts` | `list_sales_receipts` | Status/contact/date/page/sort filters. REST `{data,pagination}`, MCP `{salesReceipts,total}` (total is count); each header includes its currency and contact. |
| GET `/api/v1/sales-receipts/:id` | `get_sales_receipt` | Receipt UUID / salesReceiptId; `{salesReceipt}` with contact, ordered lines and account/tax relations, bank/deposit account and journal header. |
| POST `/api/v1/sales-receipts` | `create_sales_receipt` | Contact UUID, sale date, optional currency/cash/notes/reference, 1..1000 lines. REST 201 / MCP success; `{salesReceipt}`, status draft. |
| PATCH `/api/v1/sales-receipts/:id` | `update_sales_receipt` | Whitelisted optional contact/date/currency/cash/notes/reference and complete replacement lines. `{salesReceipt}`; unposted drafts only. |
| DELETE `/api/v1/sales-receipts/:id` | `delete_sales_receipt` | Receipt UUID; soft-delete unposted draft; `{success:true}`. |
| POST `/api/v1/sales-receipts/:id/post` | `post_sales_receipt` | Optional cash overrides; absent REST body is `{}`. `{salesReceipt}`, paid. |
| POST `/api/v1/sales-receipts/:id/void` | `void_sales_receipt` | Receipt UUID; empty or `{}` REST body. `{salesReceipt}`, void with voidedAt. |

Draft update/delete are new REST/MCP parity operations. Existing five MCP names
and numeric contracts are retained. There is one tool per operation.

## Units, aliases and supported range

Both REST and MCP creation/editing retain decimal-major numeric `unitPrice`
(USD 12.50), physical decimal `quantity` (1.5 units) and basis-point
`discountPercent` (1000 = 10%). Unlike quotes/credit notes, receipt MCP prices
are **major** units. `unitPriceExact` is a decimal-major ASCII string with up to
20 whole and 18 fractional digits; no exponents, whitespace or localized digits.
`unitPriceMinor` is a canonical signed int64 integer-minor string. Missing price
means zero; no price-list or inventory price lookup is introduced. Numeric and
exact major prices must agree as decimal ratios; the minor alias must agree
with their rounded currency-scaled price. No magnitude/currency-driven coercion.

All persisted/output monetary values retain safe integer Numbers and receive
additive exact strings. Header: subtotalMinor, taxTotalMinor, totalMinor. Lines:
unitPriceMinor, amountMinor, taxAmountMinor. Contact: creditLimitMinor, including
null. Bank: balanceMinor and lowBalanceThresholdMinor, including null. Journal
relation is a header with no money; deposit/account/tax relations retain their
ordinary metadata. USD 1250 remains 1250 cents; JPY/IRR 1250 remain 1250 minor
units, KWD 1250 remains 1250 fils. Functional IRR remains disabled: its scale is
tested only in pure arithmetic fixtures.

The current number ORM coexistence limit is **-9007199254740991 through
9007199254740991** for every price, extended product, tax and combined sum;
valid larger int64 strings are rejected with 422, not claimed as full-range
business support. Draft signed/zero lines are retained; posting requires a
positive total, nonnegative line amounts/taxes and a revenue account on every
line. Zero revenue legs with full discounts remain supported. Quantities round
to signed int32 hundredths (-2147483648..2147483647); stored 150 means 1.5,
not 150 minor units. Discounts are integer 0..10000; tax rates are nonnegative
int32 basis points. Physical inventory uses the established positive whole-unit
rounding policy, with int32 quantity capacity and safe minor-unit costs.

Prices/quantities are interpreted as exact decimal ratios. Both transports retain
extended-price rounding first, then discount, then tax-exclusive tax rounding;
signed ties follow Math.round toward positive infinity, implemented with bigint.
Saved line amounts/taxes are authoritative at posting: header sums must agree,
without recomputing historical prices or tax rates. Editing only a currency label
never rescales retained minor amounts; replace lines to reprice.

## Cash, posting and reversal

Currency defaults explicit request > contact > organization > USD. All current
multi-currency plan and rollout gates remain. Every cash ID supplied/retained is
validated in the organization, even when bank precedence means the deposit ID
will not be used. At post, omitted cash fields retain saved values, explicit null
clears; bank takes precedence over deposit; neither uses Undeposited Funds 1250.
Bank currency must match the receipt. Deposit chart-account use retains its
existing base-ledger policy; no second bank conversion or bank transaction row
is introduced. Existing bank balance cache is not changed by this workflow.

Posting debits the complete receipt total and credits every net line plus Output
VAT 2200, never AR. Missing/inactive revenue accounts fail instead of silently
dropping revenue. Bank auto-linking/control-account creation, historical exact
FX, journal lines, inventory average/FIFO issues, warehouse quantities and paid
state share one transaction. Posting FX is quote-per-base (target base units per
receipt unit), stored with each journal line; it must fit positive int32 legacy
millionths exactly. Conversion respects both currencies' minor scales and uses
the existing deterministic residual allocation to balance base legs.

Voiding paid receipts requires their own posted, unreversed recognition entry.
It copies and swaps saved base debit/credit values, FX and dimensions, linking
reversesEntryId/reversedByEntryId; changed market rates never revalue the reversal.
New inventory issues link the receipt UUID and COGS journal. Void requires matching
saved issue item/warehouse/whole-unit quantities (including duplicates), restores
captured costs and FIFO consumptions, checks their saved values against the COGS
journal, and reverses that original entry. Zero
cost issues restore quantities without a zero-value COGS entry. Historical unlinked
stock and unqualified saved FX are unsupported and reject without committed
effects; no current-cost historical repair is inferred. Draft void has no GL effect.

## Authorization, atomicity and errors

Reads are authenticated and tenant scoped; nondeleted UUID lookups return 404
outside the organization. Nested contact/account/tax/bank/journal and every
line dimension (including project UUID without a DB FK) are tenant checked.
Create/edit/delete require manage:invoices; post/void require approve:invoices.
Custom permissions retain precedence. Missing/invalid auth: 401; missing role:
403; malformed JSON/schema/alias/reference/state errors: 400; unsafe numeric or
unsupported saved-history/FX values: 422 with LEGACY_NUMERIC_RANGE where applicable;
period-lock and missing-rate errors: 422; unexpected database failure: 500.
MCP uses wrapTool error results with status/code. Exact strings do not bypass
workflow limits. All saved amounts and return serialization are checked before
commit; rejected writes leave numbering/header/lines/ledger/bank/stock unchanged.

Canonical Gregorian sale dates are required. All mutations guard the receipt
date; edit also guards the replacement date. Receipt operations lock the
organization and receipt, numbering, banks and stock in their transaction.
First-sequence numbering seeds from historical receipt numbers. Mixed REST/MCP
post/void/create races serialize; duplicate lifecycle calls fail without repeated
effects. This does not provide a create idempotency-key protocol. Audit is awaited
after success under the existing best-effort logging policy; audit failures do
not undo accounting writes.

Qualification limits: external inventory/configuration/period-lock writers do
not all share these locks; changes to organization base currency after posting
lack a receipt header base-currency snapshot and need separate historical policy.
Legacy unlinked stock requires explicit remediation/qualification.
Inventory reversal still requires available active current item cost/control
account configuration under the shared stock helper; saved journal account
ownership alone does not qualify a changed inventory configuration. UI-wide exact
formatting, PDF/email/provider flows, all inventory writers, full-int64 domain
cutover, combined MON-019 acceptance and accounting/release/IRR gates remain
their assigned tasks. This slice changes no production flag or deployment.

Fixtures: `tests/sales-receipt-wire.test.ts` and migrated disposable PostgreSQL
`tests/integration/sales-receipts.test.ts` / `sales-receipts-worker.ts`, invoking
actual authenticated REST handlers and registered SDK tools. See MON-043 evidence
for executed checks, fault injection and honest self-review.
