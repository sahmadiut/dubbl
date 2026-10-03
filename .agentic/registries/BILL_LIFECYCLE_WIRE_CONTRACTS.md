# Bill lifecycle contracts (MON-048)

2026-10-03, Asia/Tehran. Compatible exact alias adoption during safe-number ORM
coexistence. Self-review and synthetic PostgreSQL fixtures; no full-int64,
production migration, financial approval or IRR enablement claim.

## Boundaries and units

All operations are organization scoped. REST uses getAuthContext; MCP captures
AuthContext at server creation, wrapTool and direct Drizzle services. Bill UUIDs
are validated. No lifecycle operation accepts a replacement amount or client FX:
recognition uses the saved document and issue-date qualified historical rate.

| REST POST | MCP tool | Permission | Input and successful result |
|---|---|---|---|
| /api/v1/bills/{id}/receive | receive_bill | approve:bills | Draft ID; {bill,grniEntryId,warnings} |
| /api/v1/bills/{id}/approve | approve_bill | manage:bills | Pending ID; {bill,grniEntryId?,warnings?,request?} |
| /api/v1/bills/{id}/reject | reject_bill | manage:bills | Pending ID, optional reason string <=10000 chars; {bill,request?} |
| /api/v1/bills/{id}/void | void_bill | approve:bills | Unsettled ID; {bill} |
| /api/v1/approval-requests/{id}/action | approve_request / reject_request | manage:bills for bill requests | Request ID and action/comment; retained {request} envelope |

REST rejection parses JSON; receive/approve/void take their ID from the URL and
ignore request bodies. MCP fields are described. Existing generic request action
comments use the same bill service, retain pending state, and write an atomic
action/audit. Generic MCP supplies approve/reject; REST also supports comment.

Bill envelopes retain numeric subtotal, taxTotal, total, amountPaid and amountDue
in stored currency minor units, adding corresponding *Minor integer strings.
USD 1250 remains 1250 cents, KWD 1250 remains 1250 fils. Currency/locale never
infer a rescaling. All prices, saved amounts, costs, converted legs and sums fit
the signed safe-number range [-9007199254740991,9007199254740991]; posting requires
nonnegative line prices/amounts/tax and a positive document total. Draft rejection
and void preserve safe saved money, without claiming general signed posting.

Stored quantity is int32 hundredths. Stock uses exact nearest rounding to whole
units (150 -> 2); new stock and PO tallies stay nonnegative int32. Tax rates,
recoverability and procurement tolerances support 0 through 10000 basis points.
Warnings retain billLineId, kind and message; IDs are UUIDs, timestamps UTC instants,
and document dates canonical Gregorian YYYY-MM-DD. reason omission/empty clears it.

## Recognition, taxes and FX

Receive accepts only unposted/unsettled drafts with no pending workflow. Approve
accepts only unposted/unsettled pending_approval, bringing REST and MCP into
agreement. The former MCP draft/status-only approve behavior is replaced by
receive_bill for drafts and actual recognition on final approval. Direct pending
state without a workflow retains the REST approve/reject policy. When one pending
request exists, current-step assignee and organization-owned workflow/member
checks apply, including skipped step numbers. Intermediate approval advances the
request without posting. Final approval/action/header/posting commit together.
Reject returns draft and records rejection; void cancels pending requests.

Header subtotal/tax/total/supplier payable must agree with saved lines before
posting. Every expense/inventory account is required and active; absent AP or
other accounts cannot silently receive a bill. Supplier/dimensions/receipt/PO/
saved journal accounts must belong to the organization. Historic same-tenant
inactive accounts can be reversed; active new posting accounts are required.

Tax uses bigint ratios with existing nearest rounding. Standard/partial input
VAT splits saved tax by recoverablePercent; blocked tax enters cost. Reverse
charge validates notional tax against the saved line and rate, credits output
VAT, debits recoverable input VAT and absorbs blocked tax into cost. AP equals
the supplier amountDue, excluding reverse-charge tax. Matched line taxes receive
the same recoverability policy instead of becoming a bulk fully recoverable VAT
remainder. Both bill and GRNI entries balance independently.

Document-to-base FX uses exact ratios with explicit currency scales and one
deterministic per-side residual allocation. Unmatched stock value uses the same
converted cost leg, preventing sub-minor FX discrepancies between GL and stock.
Saved journal legs carry numeric exchangeRate millionths, exact rateExact,
quote_per_base direction, version 1 and exact migration status. Rate means base
currency major units per document currency major unit. Only exactly representable
positive int32 millionths are supported. JSON bill responses contain header money
aliases; saved FX is persisted in the journal and exposed by journal reads, not
invented as a bill-header rate field. Void never consults a new live rate.

## Stock and GRNI

Unmatched stock receives once, with exact value/average costs, scoped warehouse
tallies and FIFO layers. FIFO value must divide exactly into whole-unit cost;
otherwise 422 rolls back the operation. Void mirrors saved bill movements and
values instead of issuing at current average/FIFO costs. Original receipts must
match bill item/warehouse/rounded quantity, link a reversed recognition entry,
and remain fully available for FIFO removal. Insufficient quantities/value,
consumed FIFO layers, stranded zero-quantity value and unlinked legacy stock fail.
Average/standard reversal uses saved value and recalculates the remaining average.

Matched stock is not received again. GRNI requires one posted, unreversed,
balanced goods_receipt accrual for the receipt number, qualified identity FX in
the current base currency, safe received cost and a received/billed receipt from
the same supplier. Foreign-currency or ambiguous/unqualified accruals reject;
MON-052 owns saved receipt FX qualification. Billed-vs-ordered prices use exact
basis-point ratios; price warnings follow the existing PO policy (PO price
variance warns, GRN-only price variance can block). Quantity/required-receipt
settings retain their block/warn behavior. Duplicate lines and partial bills
include already/proposed billed quantities; clearing never exceeds remaining
rounded receipt units. Excess unreceived cost enters PPV rather than GRNI.

On-hand cleared price variance plus blocked tax enters Inventory; depleted
variance enters PPV. Revaluation movements link bill and clearing journal. FIFO
zero-quantity revaluation is deliberately unsupported until layer qualification.
PO quantityBilled, GRN billed status/stamp, inventory value and both journals commit
together. Void reverses both entries and revaluation, decrements this bill's PO
quantity and preserves other active bills. It restores the remaining bill's
clearing stamp or original goods-receipt accrual and received/billed status.
Matched legacy bills without a linked sourceId clearing journal reject, avoiding
guessing history by supplier invoice number.

## Atomicity, errors and settlement coordination

Organization/bill locks serialize lifecycle operations and numbering; receipts,
PO lines, stock and workflow rows are scoped and locked. Journal/header/stock/
FIFO/warehouse/GRNI/PO/approval/audit mutations share one transaction. DTO/JSON
preflight runs before commit. Repeated/concurrent receive or void returns a state
error after the first success; no duplicate committed effects. All issue dates
and original reversal journal dates use strict existing period/closed-year checks.
Period/rate configuration readers retain existing helper behavior outside this
transaction; races with separate configuration writers remain unqualified.

REST returns 200, 400 for schema/state/balance errors, 401 invalid credentials,
403 insufficient permission/current assignee, 404 foreign/deleted IDs, 422 for
period/FX/procurement/unsupported monetary history, and 500 with rollback for DB
failures. Money-range/history errors include LEGACY_NUMERIC_RANGE. MCP returns
wrapTool errors/status/code; SDK input validation can fail before wrapTool.
There is no exact-only switch or automatic large-value/string fallback.

MON-021 retains full REST pay/payment/allocation/FX/bank and MCP pay_bill adoption.
This slice adds a common recognition barrier to both: draft/pending/void/paid and
orphan received bills cannot be paid; REST now requires manage:bills. Payable
arithmetic uses guarded bigint sums and subtracts actual amountDue, repairing
MCP's reverse-charge phantom balance. No payment exact aliases are advertised
here. MCP pay_bill still only annotates balances; REST retains its legacy payment
journal flow. Their settlement ledger/idempotency/locking/carrying-FX and races
with other payment/debit-note/bulk writers are not qualified by MON-048.
Lifecycle refuses nonzero saved amountPaid before void or recognition.

MON-020 retains combined acceptance. MON-049..054, MON-021/024, full-range money,
base-currency regime migration, historical remediation, financial/security review,
production migration/IRR and release gates remain separate. No schema changes.
