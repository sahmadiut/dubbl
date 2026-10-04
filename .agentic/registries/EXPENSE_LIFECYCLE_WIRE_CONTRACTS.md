# Expense claim lifecycle wire contracts - MON-061

2026-10-04, Asia/Tehran. Source: actual expense routes, shared
`lib/api/expense-claims.ts`, `expense-lifecycle-wire.ts`, MON-060 CRUD validators,
and six tools in `lib/mcp/tools/expenses.ts`. This is bounded safe-number
coexistence, not full-int64 or independent financial/production qualification.

## Operations and inputs

All REST routes are POST `/api/v1/expenses/{id}/{operation}`. Every ID is a live
claim UUID in the authenticated organization. The six matching MCP tools are
already registered by `registerExpenseTools` in the tool index. MCP schemas are
strict: unknown fields reject, including invented amount/rate/status/tenant overrides.

| Operation / MCP tool | Inputs besides claim ID | Permission | Required state / result |
|---|---|---|---|
| submit / submit_expense_claim | None | manage:expenses | Positive unposted draft/rejected to submitted; clears rejection |
| recall / recall_expense_claim | None | manage:expenses | Unposted submitted to draft; clears submittedAt |
| approve / approve_expense_claim | None | approve:expenses | Positive submitted to approved; records approver/time and recognition journal |
| reject / reject_expense_claim | reason: trimmed nonblank string, max 10000 | approve:expenses | Unposted submitted to rejected; records reason/time; no GL |
| pay / pay_expense_claim | date: canonical Gregorian YYYY-MM-DD; bankAccountCode: nonempty max 100, default 1100 | approve:expenses | Approved to paid; full reimbursement journal, paidAt |
| reverse / reverse_expense_claim | None | approve:expenses | Approved/paid to draft; reverses complete saved recognition/payment and clears all lifecycle timestamps/reasons/approver/journal link |

REST ID is the path parameter; MCP calls it `expenseClaimId`. Reject/pay REST
bodies must be valid JSON objects and reject unknown fields. Other REST operations
retain their existing no-body contract and ignore bodies; no monetary fields are
read from them. There is no user-supplied approval date or FX override. Approval
uses today's **UTC** Gregorian date, preserving the original posting policy;
timestamps are UTC instants. Pay date cannot predate the saved approval date.
Approval cannot predate any saved item date.

## Responses, aliases, units and ranges

Every success is HTTP 200 / successful MCP JSON text `{expenseClaim}` with the
updated persisted header. All header fields remain, including title, description,
organizationId, submittedBy, status, currencyCode, approvedBy, journalEntryId,
submittedAt/approvedAt/rejectedAt/paidAt, rejectionReason and timestamps.
`totalAmount` remains numeric integer **claim-currency minor units**, adding
`totalAmountMinor` as the matching canonical integer string. USD 1250 stays 1250
cents; JPY/IRR 1250 stays 1250 minor units. Lifecycle accepts no new amount input:
legacy REST major numeric / exact major strings / minor strings and MCP minor
numeric creation/edit are documented in [CRUD contracts](EXPENSE_CRUD_WIRE_CONTRACTS.md).
Exact clients use those saved aliases and lifecycle `totalAmountMinor`; neither
headers nor magnitude select a full-int64/exact-only mode.

Every saved amount, item sum, mileage rate, journal side sum, rounded tax/FX leg,
carrying/cash value and response must fit 0..9007199254740991. Positive submission,
recognition and reimbursement are required; zero item lines can be retained.
Ratios/products use bigint, with explicit half-up rounding for nonnegative money.
Amounts outside the safe ORM range fail; int64 strings do not promise int64
business support. Journal sequence numbers must fit positive int32.

Saved journal `debitAmount`/`creditAmount` and posting audit legs are **base-currency
minor units**. Their currencyCode remains the original claim tag (existing
automated GL convention), not the denomination of the already-converted amounts.
FX direction `quote_per_base` means base-currency major units per claim major
unit; currency minor scales are explicitly included once. Never convert these
saved base legs again. Journal readers supply named Minor and rateExact aliases
via their own contracts; lifecycle returns only the expense header.

## Recognition, tax and settlement

Approval DR expense / CR Employee Reimbursements Payable (2110) for the explicit
supplier/employee gross. Missing item expense account uses Miscellaneous Expense
5990, preserving the original fallback rather than COGS. Assigned accounts must
be live active organization expense accounts. Cost centers carry onto expense
and tax legs. Applicable purchase/both tax rates are organization-owned/active;
no default tax is guessed for a null taxRateId, and mileage never recomputes money.

For standard/partial_block, inclusive VAT = round(gross * rate / (10000 + rate));
recoverable = round(VAT * recoverablePercent / 10000). DR Input VAT 1500 for
recoverable; DR expense gross minus recoverable. For blocked/exempt/no_vat/
sales_tax_us, the explicit gross is all expense with no recovery. Reverse charge
treats explicit reimbursement as supplier net: notional VAT = round(amount *
rate / 10000), DR recoverable input, CR Output VAT 2200 for notional VAT and DR
expense amount plus blocked VAT. The amount owed is unchanged. Rate and
recoverablePercent are integer basis points, not money. Compound tax components
reject with 422 pending separate posting qualification; their parent rate is not
silently treated as the complete tax. This is application posting policy, not a
claim of statutory correctness for any jurisdiction.

Approval resolves a scoped qualified historical FX quote at/before the UTC
approval date. Same currency supplies identity 1. Direct/inverse source,
effective date and available provider provenance are recorded in the atomic audit.
FX must coexist losslessly with positive int32 millionths; nonrepresentable
inverse/tiny/large rates reject rather than round. Exact currency-scale conversion
uses shared `convertInvoiceLegs`: round line amounts and each side's total, absorb
the rounding residual into the largest leg on that side with stable item ordering.
Nonzero balanced recognition and positive payable carrying amount are required.

Pay DR 2110 for **the complete actual saved recognition carrying value**, CR
bank/cash for explicit claim total converted at payment date FX, and balance
realised loss 5930 or gain 4910. Expense accounts are not debited again. Bank code
must resolve to a live active owned asset account with bank/cash subtype or
standard 1100-1199 bank band, and claim or base denomination. Tax/payable/FX
control accounts require the correct type and current base denomination; absent
system accounts are created in the same transaction. Example: EUR 1000 minor
recognized at 1.2 gives payable USD 1200; payment at 1.4 clears USD 1200, credits
cash USD 1400 and debits loss USD 200. There is no partial reimbursement,
payment/payment_allocation record, bank-feed balance change or external transfer.

## Qualified history and reversal

Pay/reverse require exactly one unreversed posted approval linked by the header,
and exactly one payment for paid state (none for approved). Missing, ambiguous,
draft/deleted/reversed, foreign or orphan history rejects. A posting-specific
approve/pay audit must match journal ID, original claim total, base denomination,
rate and all saved account/money/dimension legs. This audit is required provenance;
retaining it is part of supported operation. This deliberately rejects old expense
history without qualified audit, even if a generic migration populated rateExact.
No historic amounts, taxes or FX are guessed or repaired.

Saved FX must have version 1, quote_per_base, exact status, trigger-assigned
legacy_scaled_1e6:transaction provenance and agreeing numeric/exact rate aliases.
Saved lines must be nonnegative, one-sided, balanced and nonempty. All saved
account/cost-center/project references must belong to the organization. Inactive
historical accounts/dimensions can reverse; no new eligibility is inferred from
their current status. Changing organization base currency rejects settlement/
reversal rather than reinterpret posted amounts.

Reversal swaps the actual stored debit/credit, copies rates/currency/dimensions,
posts on each original open date, links reversesEntryId/reversedByEntryId and
retains both posted entries. It does not look up a current rate or recompute tax.
Changing/deleting rate quotes or changing active tax configuration cannot revalue
the reversal. All original links, both reversal journals, draft reset and audit
commit together. Another approval/pay/reverse cycle matches its own journal audit.

## Scope, locking, errors and qualification limits

All operations share organization then claim FOR UPDATE locks with MON-060 CRUD.
Saved/current users are organization members; scoped public user columns exclude
secrets. Header/items/mileage/receipt/tax/account/cost-center and header totals
reuse CRUD validation. Submit/approve require all line dates open; approval/pay
require posting date open; reversal requires every original posting date open.
Two-tier advisor bypass and closed fiscal years retain existing policy.
Recall/reject do not post GL and can return an otherwise valid submitted claim
from a locked date. Role authority remains organization-wide, not claimant-only.

Status, journals, generated accounts, numbering, reversal links, response
compatibility check and expense audit are inside one transaction. Audit errors
roll back all effects. Some validations happen after tentative transactional
account/journal writes; there are no committed effects on failure. Concurrent
approve/pay/reverse cannot duplicate cash/recognition; one wins and the subsequent
state mismatch fails. Repeats are 400 state errors, not successful idempotent
replays; there is no new public idempotency key. Concurrent CRUD edit/submit and
recall/approve serialize. API-key last-used audits are separate authentication
effects and excluded from financial rollback assertions.

REST 400: malformed JSON/schema/UUID/date, invalid state/reason/bank, future
expense or pre-approval reimbursement. 401/403: invalid/expired API key / missing
operation permission. 404: missing/deleted/foreign claim. 422: unsupported money,
history, FX, dimensions, compound tax, base changes, period locks/fiscal closure.
Wire range errors carry LEGACY_NUMERIC_RANGE; missing FX and period errors retain
their shared classifications. Unexpected injected DB/audit faults return 500.
MCP exposes corresponding errors via wrapTool, without unsafe JSON or BigInt crash.

Real handler/API-key and linked MCP SDK fixtures cover six operations, exact and
legacy saved amounts, separate roles/tenants, supported tax/FX, saved reversals,
negative histories, rollbacks and races on migrated disposable PostgreSQL 18.6.
Unit tests cover tax ties, safe max and schema strictness. Browser/session/OAuth,
live providers, PostgreSQL 16/clean install, production migration, old historic
remediation, full-int64, independent accounting/security and functional IRR
enablement remain separate gates. Generic bank-created claims, restore/merge,
manual journal/reference/lock/configuration writers do not all acquire these
locks; these fixture races do not qualify concurrent external configuration
changes. MON-021 retains combined payment/expense/bank acceptance and earlier
carrier handoffs. No schema, migration, stored-unit or rollout flag change.
