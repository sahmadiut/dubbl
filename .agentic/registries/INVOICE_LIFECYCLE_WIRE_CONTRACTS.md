# Invoice lifecycle wire contracts (MON-040)

Inspected/implemented 2026-10-03 (Asia/Tehran). Entry HEAD `c40826c`.
This bounded MON-019 child adopts lifecycle operations; settlement stays MON-021,
public/payment-link/signature/email/PDF/provider qualification stays MON-016.
No schema, migration, configured application database or rollout flag changes.

## Units, inputs and outputs

Every invoice output retains numeric `subtotal`, `taxTotal`, `total`, `amountPaid`
and `amountDue`, adding identically valued `*Minor` canonical integer strings.
These are invoice-currency minor units: USD 1250 still means USD 12.50. No stored
amount is rescaled. Exact inputs coexist with numeric clients only within
`+/-9007199254740991`; full int64 business support is not implied. Recovery and
interest amounts must be positive. Saved headers, line money, due differences,
opaque snapshots, ledger sums, stock costs/products and final converted amounts
must be representable before a transaction can commit. Quantities remain stored
int32 hundredths on invoice lines; stock retains whole units rounded once, ties
toward positive infinity. Stock counters and numbering remain signed int32.

| REST POST path | MCP tool | Inputs and defaults | Output |
|---|---|---|---|
| `/api/v1/invoices/:id/send` | `send_invoice` | Organization-owned draft UUID. REST optional email settings below; MCP recognizes/posts without email | `{invoice}` with numeric/*Minor totals, sent/journal IDs and frozen snapshots |
| `/api/v1/invoices/:id/void` | `void_invoice` | Organization-owned unsettled UUID, no monetary body | `{invoice}`; amountDue/amountDueMinor become 0/"0" |
| `/api/v1/invoices/:id/write-off`, default action `write-off` | `write_off_invoice` | `method`: direct (default) or allowance. Reject recovery-only fields in write-off mode | REST/MCP `{invoice,amountWrittenOff,amountWrittenOffMinor,method}`; additional fields preserve the existing REST envelope |
| Same path, action `recover` | `recover_written_off_invoice` | `amount`: positive integer minor units; `amountMinor`: exact canonical string alias; both must agree. Omitted defaults to invoice total. Optional bankAccountCode; omission uses/creates 1100, explicit code must exist | `{invoice,recovered,recoveredMinor}`; invoice remains written-off/void |
| `/api/v1/invoices/calculate-interest` | `calculate_invoice_interest` | No body; organization configured annual basis-point rate (500 = 5%), simple/daily compound method and grace days; UTC today | `{data}` rows: invoiceId/number/currencyCode, daysOverdue, amountDue/amountDueMinor, interestAmount/interestAmountMinor |
| `/api/v1/invoices/:id/charge-interest` | `charge_invoice_interest` | `amount`: positive legacy decimal-major override; `amountExact`: unsigned ASCII decimal-major string, up to 20 whole/18 fractional digits; `amountMinor`: canonical integer-minor override. All supplied aliases must agree after currency-scale rounding; numeric and decimal-major aliases must agree before rounding. Omission calculates interest | REST 201; MCP `{invoice,journalEntry,originalInvoiceId,daysOverdue,interestAmount,interestAmountMinor}` |
| `/api/v1/invoices/:id/submit-for-approval` | `submit_invoice_for_approval` | Draft UUID, matching active workflow with organization-owned approvers | `{invoice}`, pending_approval |
| `/api/v1/invoices/:id/approve` | `approve_invoice` | Pending UUID, optional comment, current assigned approver | `{invoice,request}`; pending until last step, then draft |
| `/api/v1/invoices/:id/reject` | `reject_invoice` | Pending UUID, optional reason, current assigned approver | `{invoice,request}`, both rejected |
| `/api/v1/approval-requests/:id/action` for invoices | `approve_request` / `reject_request` for invoices | Scoped request UUID, action approve/reject/comment plus optional comment. Invoice actions route through the same preflight; comments retain authenticated member access | Existing `{request}` envelope; complete invoice lifecycle mutations are atomic |

Example: interest `{amount:12.5,amountExact:"12.50",amountMinor:"1250"}` in USD
charges 1250 units; recovery `{amount:1250,amountMinor:"1250"}` recovers the same
1250 units. `amount:12.5` is invalid for recovery. Decimal-major rounding uses
the currency's 0/2/3-digit scale; exact strings reject exponent/localized syntax.
Malformed or conflicting aliases return REST 400 / MCP validation error. Valid
int64 strings outside safe workflow range return 422 `LEGACY_NUMERIC_RANGE`.
Unknown ordinary body fields retain Zod's existing stripping behavior.

## Arithmetic and saved FX

Simple interest is `round(principalMinor * annualBasisPoints * days / 3650000)`.
Daily compound interest uses the exact ratio
`principalMinor * ((3650000 + annualBasisPoints)^days / 3650000^days - 1)`.
Round once to minor units, half ties upward. Annual rate is positive int32;
grace and overdue duration support 0 through 36500 days. Unsupported configuration,
negative/unsafe principal or unsafe calculated output fails. An explicit override
bypasses calculation, while still checking configured rate/method/grace/duration.
Preview considers sent/partial/overdue unpaid history, excluding draft/paid/void/
pending/rejected documents; each row declares its currency, without mixed sums.

Posting uses historical document-major to base-major FX, explicit minor-unit
scale conversion and bigint ratios. Each side's final total is rounded once;
per-leg residual goes to its largest leg, first tie. Both document and converted
sums are guarded. FX must coexist exactly with positive int32 millionths
(up to 2147.483647 and no more than six nonzero fractional places); other exact
rates return 422 instead of rounding them into legacy fields. Headers/lines are
never posted with missing FX, unavailable control accounts or incomplete legs.

New recognition, interest and COGS journals persist `rateExact`, format version 1,
quote_per_base direction and the migration trigger's canonical
`legacy_scaled_1e6:transaction` provenance/status exact. Journal amounts are already
in organization base minor units; `currencyCode`/rate retain the existing
document-currency metadata convention. Sender snapshots additionally retain
`baseCurrencyCode` for new documents. Bad debt reuses a linked recognition journal's
qualified, consistent saved rate; it rejects changed base currency when captured.
Legacy unlinked sent rows retain issue-date lookup and legacy snapshots lacking
base currency cannot prove base-currency changes. No historical repair is inferred.
Reversal mirrors saved base amounts, dimensions and all FX metadata verbatim,
linking reversesEntryId/reversedByEntryId; it never looks up or reapplies a new rate.

## State, scope, atomicity and audit

- Send/void/write-off/recover/approve/reject require `approve:invoices`; charge
  and submit require `manage:invoices`. MCP void now shares REST posting permission
  and full reversal behavior instead of the old status-only manage operation.
  Preview retains authenticated access. Generic invoice comments require scoped
  membership; decisions additionally require permission and assigned approver.
- New mutations check issue-date locks, including drafts/approval transitions;
  interest also checks today's posting date. Existing advisor bypass and closed
  fiscal-year rules are retained. Foreign/deleted invoice IDs return 404. Contacts,
  retained dimensions, stock-account links, original journal accounts/dimensions,
  workflow/request/members and generic request actions remain organization-scoped.
- Sending requires nonnegative complete revenue lines, active revenue/AR/tax
  accounts and exact header/subtotal/tax/amountDue agreement. Unsupported incomplete,
  negative or already-posted drafts fail instead of producing an empty/partial GL.
- Void blocks all nonzero settlements, including applied credit. Draft voiding
  cannot create stock; posted invoices need a qualified posted recognition journal.
  Pending requests are cancelled. New stock issues carry invoice IDs; restoration
  uses original saved values, reopens original FIFO consumptions and recreates
  exact average-cost shortfall layers. New COGS is reversed from saved journals.
  Legacy unlinked stock retains the prior current-average restock policy; its
  historical reconstruction remains a later accounting/data qualification gate.
- Write-off is restricted to sent/partial/overdue positive outstanding debt;
  paid, draft, pending, rejected, void and previously written-off rows fail.
  Zero legacy amountDue retains the exact total-minus-paid fallback. Direct 6500/
  allowance 1290 loss accounts and default recovery 1100/4400 are created only
  inside the transaction. Recovery retains invoice-total default and repeat-call
  semantics; it does not add settlement reconciliation or a recovery cap.
- Organization/invoice row locks serialize adopted CRUD/lifecycle numbering and
  duplicate send/void. Every header/line/journal/stock/layer/warehouse/number/request/
  action/status effect uses one transaction per operation. Successful audits are
  awaited with previous status and monetary operation details; existing audit
  failures remain best-effort. Rejected/rolled-back transactions emit no audit.
- Interest/recovery are deliberately repeatable separate accounting events;
  request-key idempotency and races with external writers/lock/workflow/base/plan
  changes remain later domain qualification. Neither task completion nor aliases
  enable IRR or full-range domain/reporting support.

## Optional REST email boundary and qualification limits

REST send validates explicit `sendEmail:true` options before recognition: valid
recipientEmail, nonempty subject, structured templateProps (organizationName,
contactName, documentType/documentNumber and optional personalMessage/amount/date/
URL/button strings), attachPdf default true, includePaymentLink default false.
Accounting commits before external delivery; existing optional payment-link,
renderer and document sender remain. PDF receives the document currency. A provider
or renderer/delivery error cannot undo committed accounting, so retry delivery via
email tools instead of retrying recognition. Actual email/PDF/provider behavior,
durable delivery retry/outbox and payment-link/token concurrency are MON-016 gates;
only malformed email options are exercised here, without sending external messages.

`tests/invoice-lifecycle-wire.test.ts` covers aliases, all four currency scales,
signed safe bounds, interest ratios/rounding and FX residual/scale/range guards.
`tests/integration/invoice-lifecycle.test.ts` invokes actual authenticated REST
exports and registered SDK MCP tools against disposable migrated PostgreSQL.
It qualifies two tenants/custom roles, sent/draft/paid/approval/deleted states,
unsafe persisted headers/lines/snapshots, missing/foreign/inactive accounts,
invalid alias/no-write snapshots, locks, saved FX after rate deletion/change,
base-currency change rejection, zero/three-digit scales, safe-max/FX overflow,
stock/FIFO cost restoration, multistep/generic approvals, concurrent send/void and
forced rollback after header/line/ledger/stock/request/action mutations. HTTP/session/
OAuth/browser, full financial reports, external writers and PostgreSQL 16/Linux
execution remain separate qualification; local tests used PostgreSQL 18.6.
