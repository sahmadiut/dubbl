# Receivable credit wire contracts (MON-042)

2026-10-03, Asia/Tehran. Implemented in `lib/api/credit-wire.ts`, `credits.ts`
and `credit-stock.ts`. This is additive safe-number coexistence under ADR-006;
full int64 business processing is still assigned to MON-007/008. No schema or
IRR functional-currency flag changes. Monetary integers are currency minor units
(USD cents); an existing integer 1250 stays 1250 in every currency.

## Operation inventory

| REST operation | MCP operation | Input and output envelope |
|---|---|---|
| GET `/api/v1/credit-notes` | `list_credit_notes` | Filters/pagination; REST `{data,pagination}`, MCP `{creditNotes,total,page,limit}` |
| POST `/api/v1/credit-notes` | `create_credit_note` | Customer/date/currency/lines; `{creditNote}`, REST 201 |
| GET `/api/v1/credit-notes/:id` | `get_credit_note` | Note UUID; `{creditNote}` with contact/lines/account/tax |
| PATCH `/api/v1/credit-notes/:id` | `update_credit_note` | Draft header whitelist/optional replacement lines; `{creditNote}` |
| DELETE `/api/v1/credit-notes/:id` | `delete_credit_note` | Draft UUID; `{success:true}` |
| GET `/api/v1/credit-notes/summary` | `get_credit_note_summary` | No money input; totals/statusBreakdown/currencyCode |
| POST `/api/v1/credit-notes/:id/send` | `send_credit_note` | Draft UUID; REST optional email body; `{creditNote}`, MCP also `journalEntryId` |
| POST `/api/v1/credit-notes/:id/apply` | `apply_credit_note` | Invoice UUID, amount aliases; `{creditNote,invoice}` |
| POST `/api/v1/credit-notes/:id/void` | `void_credit_note` | Note UUID; `{creditNote}` |
| GET `/api/v1/customer-credits` | `list_customer_credits` | Filters/pagination; REST `{data,pagination}`, MCP `{customerCredits,total}` |
| POST `/api/v1/customer-credits` | `create_customer_credit` | Customer/date/amount/source/cash account; `{customerCredit}`, REST 201 |
| GET `/api/v1/customer-credits/:id` | `get_customer_credit` | Credit UUID; `{customerCredit}` with contact/recognition journal |
| POST `/api/v1/customer-credits/:id/apply` | `apply_customer_credit` | Invoice UUID, amount aliases, optional date; `{customerCredit,invoice}` |
| GET `/api/v1/invoices/:id/available-credits` | `list_invoice_available_credits` | Invoice UUID; `{credits,currencyCode,amountDue,amountDueMinor}` |

Customer credits are posted immediately; existing API exposes create/read/apply,
with no edit/delete/refund operation. Those operations are not invented here.
Credit-note PDF rendering, email provider delivery and other public money routes
retain their separate qualification gates. MCP send moved from tax registration
to credit-note registration; existing tool names remain. Customer-credit tools
moved from sales receipts to their own registered file. All use direct DB,
AuthContext, wrapTool and described input fields.

## Units, aliases and supported ranges

- REST credit-line `unitPrice` is decimal major units; MCP numeric `unitPrice`
  is an integer minor-unit price. Both add `unitPriceExact` (ASCII decimal major
  string, up to 20 whole/18 fractional digits) and `unitPriceMinor` (canonical
  signed int64 minor string). Numeric/exact major aliases agree as decimal
  ratios; minor aliases agree with the rounded unit price. Numeric MCP prices
  agree with the minor alias. Omitted prices remain zero, with no item lookup.
- Products extend the unrounded major price by physical quantity, then round
  to minor units. This retains credit REST's original extended-price policy,
  distinct from invoice/quote create price-first rounding. Discount follows gross
  rounding, then exclusive line tax. Integer ratios implement signed nearest
  rounding with ties toward positive infinity; totals use bigint sums.
- `amount` for both application types and customer-credit create remains a
  positive integer minor Number. Add `amountMinor`, a positive canonical minor
  string; require one alias and exact agreement. No amount major-unit alias.
- Money inputs, stored values, each rounded gross/tax, derived balance, sum,
  FX-converted leg and output must fit `[-9007199254740991,9007199254740991]`.
  Positive applications must fit `[1,9007199254740991]`. Larger valid int64
  strings fail 422 before committed changes; they do not activate exact-only mode.
- Notes add `subtotalMinor`, `taxTotalMinor`, `totalMinor`, `amountAppliedMinor`,
  `amountRemainingMinor`; lines add `unitPriceMinor`, `amountMinor`, `taxAmountMinor`.
  Credits add `originalAmountMinor`, `amountRemainingMinor`; related contact adds
  `creditLimitMinor`. Application invoice adds header/paid/due minor aliases.
  Summary adds `totalAmountMinor`, `totalAppliedMinor`, `totalRemainingMinor` and
  each status bucket's `amountMinor`. Counts remain numeric, never monetary.
- Quantity is decimal physical units on input, signed int32 hundredths on output;
  discounts are integer basis points, 0 through 10000; stored tax-rate basis
  points must be nonnegative int32. Lines are 1 through 1000. Dates are validated
  Gregorian YYYY-MM-DD. UUID dimensions must be owned by the organization.
- Note currency defaults to USD in both transports. Customer-credit currency
  defaults to contact/org/USD. Currency edits retain minor integers; they never
  rescale history. A linked original invoice must match tenant/customer/currency.
- Lists accept status/contact, REST from/to (MCP startDate/endDate), page 1 through
  21474836, limit 1 through 100, sortBy and asc/desc. Existing default sort is
  created descending. Customer status also includes refunded. Unknown/malformed
  filters reject. Available credits retain open/positive/same-contact/currency
  selection and the legacy envelope even for a draft invoice; applying enforces
  eligible invoice state. Summary retains all nondeleted note statuses and rejects
  mixed currencies or unsafe per-row/bucket/overall totals, with no int32 casts.

## Workflow and protection

Writes require `manage:credit-notes` or, for customer credits, `manage:payments`.
Reads retain existing authenticated org-scoped access; auth middleware verifies
API key/membership, and the MCP context is supplied by server creation. Foreign
document IDs return 404. Foreign/unavailable new dimensions, unsupported states,
alias conflicts, malformed JSON/date and bad balances reject 400; numeric/rate
compatibility failures return 422 with `LEGACY_NUMERIC_RANGE`. Locked periods
and missing FX return 422; unauthorized roles return 403, bad auth 401.

Organization and document/invoice/stock locks serialize these services. Credit
note and carrier payment numbering, header/line mutations, journal recognition,
stock/FIFO/warehouse movements and application balances share one transaction.
Old/new draft dates, issue/void dates, application posting date and affected invoice
issue dates must be open. Failed transactions emit no success audit. Successful
audits await the existing best-effort audit helper. Repeated successful creates
still create new records; no request-ID idempotency guarantee is introduced.

Sending requires positive total, nonnegative line revenue/tax and complete active
revenue/AR/control accounts. Posts DR revenue/tax and CR AR for the entire note;
omitted accounts use revenue 4000. Foreign FX converts document major to org-base
major with explicit scale ratios and balanced residuals, retaining exact decimal
FX and compatible legacy int32 millionths. Missing/noncoexisting rates reject.
Note application is a pure open-item offset, with no second AR recognition.
Customer-credit creation posts DR cash / CR deposits, requiring exactly one cash
bank or asset chart account; bank currency must match. Auto-linking bank GL is
transactional. Both applications require same customer/currency, eligible
sent/partial/overdue invoice, positive remaining/due and consistent balances.
Customer application retains the existing application-date FX policy and posts
DR deposits / CR AR; carrying-value FX settlement remains MON-021/MON-007 work.

Void mirrors saved base recognition legs/FX instead of refreshing rates. Validated
carrier allocations agree exactly with note applied balance and affected invoice
amounts; foreign/corrupt carriers or unsafe sums reject. Multiple applications
unwind atomically; void invoices retain void state. Returned inventory retains
whole-unit average/FIFO policy. New return movements are linked to the note and
void reuses saved quantities/costs/COGS, independent of later invoice/item changes.
Consumed returned FIFO/warehouse stock or insufficient book value rejects instead
of guessing. Standard/serial/lot stock returns reject in this bounded path.
Historical unlinked returns keep the old pro-rata/current-cost fallback, with
remaining inventory qualification in MON-024/MON-007/QA. Historical/current base
regime changes and external writer/configuration races also retain later gates.

REST email input is validated before sending/posting; optional provider delivery
follows commit. Delivery failure can return an error while the note remains sent;
retry email separately. No email/PDF provider call is exercised by fixtures.

## Evidence

`tests/credit-wire.test.ts` covers units, aliases, signed rounding, currency scales,
ranges and DTOs. `tests/integration/credits.test.ts` / `credits-worker.ts` invoke
all fourteen actual REST operations and fourteen SDK-registered MCP tools against
committed migrations, with roles/two tenants, unsafe/corrupt history, locks,
saved FX/stock reversal, concurrency, complete rejection snapshots and injected
rollback. See MON-042 attempt/review evidence for actual checks and limitations.
MON-019 retains combined receivable acceptance after all child slices.
