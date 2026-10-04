# Bank categorization wire contracts (MON-065)

2026-10-04, Asia/Tehran. Shared direct-DB services in
`lib/api/bank-categorization.ts`, strict described schemas in
`bank-categorization-wire.ts`, MCP registration in `tools/bank-categorization.ts`.
This is safe numeric coexistence, not full-int64 support or IRR enablement.

## Operations and responses

| REST POST | MCP tool | Permission | Response |
|---|---|---|---|
| `/api/v1/bank-transactions/{id}/categorize` | `categorize_bank_transaction` | `manage:banking` | `journalEntryId`; MCP additionally retains `transactionId` |
| `/api/v1/bank-transactions/{id}/split-account` | `split_bank_transaction` | `manage:banking` | `journalEntryId`; MCP additionally retains `transactionId` |
| `/api/v1/bank-transactions/{id}/create-expense` | `create_expense_from_bank_transaction` | `manage:expenses` | `expenseClaim`, `journalEntryId`; claim numeric `totalAmount` plus `totalAmountMinor` |
| `/api/v1/bulk/bank-transactions/categorize` | `bulk_categorize_bank_transactions` | `manage:banking` | `results` (`transactionId`, `success`, journal ID or error), `summary` total/succeeded/failed |
| No separate existing REST operation | `bulk_cash_code` | `manage:banking` | `accountId`, requested/succeeded/failed, results with `ok` instead of `success` |

REST successes remain 201; MCP uses wrapTool with legacy-safe serialization.
No header negotiation or exact-only output mode. The explicit aliases are the
capability. Counts, IDs, dates and enums keep their existing JSON units.

## Inputs, units and ranges

All IDs are UUIDs. Coding requires `accountId`; optional nullable `contactId`,
`taxRateId`, `costCenterId`, `projectId` and memo (up to 10000 characters) describe
the other side. Omission/null clears dimensions; blank memo uses bank description.
The amount comes from the saved bank movement and cannot be overridden. Positive
movement debits bank and credits category; negative movement reverses the sides.
Zero and excluded movements fail. Saved currency must match its bank account.

Split allocations contain account/tax/memo/cost-center/project and `amount`,
`amountMinor`, or both. `amount` remains a positive integer in bank-currency
minor units, USD cents. `amountMinor` is a canonical positive int64 integer string,
within the actual numeric coexistence range 1..9007199254740991. Both aliases must
agree. No exponent, leading zeros, whitespace, localized digits, decimals or -0.
1..1000 allocations must reconstruct the exact absolute bank amount using bigint
sums; sum/output overflow fails before committed effects. Contact is not a split
journal-line dimension. Requests and nested objects reject unknown fields.

Create-expense requires title and 1..1000 items. Item fields: Gregorian date-only
YYYY-MM-DD, nonempty description, optional category/account and monetary aliases.
REST retains the existing decimal **major-unit** numeric `amount`; the new MCP
operation follows the project's integer minor-unit numeric `amount` convention,
consistent with ordinary `create_expense_claim`. `amountExact` is an exact nonnegative decimal major string
(20 whole, up to 18 fractional digits), `amountMinor` a canonical nonnegative
minor-unit integer string. Major aliases agree exactly, then round once using
nearest minor unit, ties toward positive infinity; minor alias agrees with that
rounded result. Numeric decimals use their JSON Number spelling and cannot recover
precision lost before submission. Integer totals/items stay in safe numeric range.
USD 12.50 / JPY 1250 / KWD 1.250 / IRR 1250 each represent 1250 minor units.
Currency defaults to the bank's currency and explicit currency must match; never
silently relabel an expense. Sum must equal the outgoing bank magnitude; incoming
and zero lines cannot create expenses. Zero expense items are allowed alongside
positive items and have no posting leg. Every named account is validated, including
zero items. Missing item accounts use an active base-currency expense account 5990.
All distinct item accounts are posted separately rather than discarded into a
single fallback. Item metadata dimensions come from the claim-level inputs.

Bulk accepts 1..200 items. Cash-code accepts 1..200 transactionIds plus shared
coding fields. Schema failure rejects the complete request before posting; business
failures are per item. Duplicate IDs are processed in order: subsequent items fail
as already reconciled. Other successful items commit. No whole-batch atomicity is
claimed or silently introduced.

## Posting, FX and tax

Integer tax ratios and residuals use bigint, never floating ledger multiplication.
Nonnegative int32 basis-point tax rate and 0..10000 recoverable percent are required.
Tax must be live, active, organization-owned and sales/purchase/both applicable.
Standard/partial VAT splits recoverable input on money out; blocked/exempt/no-VAT
and US purchase sales tax stay in category. Money in uses output VAT/US payable.
Reverse-charge purchases debit net plus blocked notional VAT, debit recoverable
input VAT and credit full notional output VAT, retaining the cash leg. Category
splits now apply the same reverse-charge semantics as single categorization.
Compound tax-component rates explicitly fail 422 rather than lose their component
meaning. Required tax control accounts are created in the current base currency;
existing incompatible/inactive control accounts fail and the transaction rolls back.

Fresh posting resolves transaction-date historical exact FX through the transaction
executor. Only positive exact rates representable in int32 millionths are supported;
missing/review-required/unrepresentable FX fails 422. Original and base currency
minor scales are applied explicitly. Base legs round with balanced residual
allocation; both sides' totals and individual amounts must fit safe Numbers. A
zero or invalid converted bank leg fails. Journal lines persist `rateExact`,
legacy `exchangeRate`, quote_per_base, exact migration status/version and provenance.
Audits record base/currency, movement aliases and journal/claim identity.

Correction of a reconciled plain categorization voids its old journal and creates
a new journal atomically. It reuses the old saved FX even when live rates change
or are absent. Previous journal must be owned, posted, unreversed, on the bank date,
plain categorization/split, with balanced nonnegative amounts, matching bank leg,
consistent saved FX and owned live references. Base must match its saved audit;
without that audit only established same-currency identity history is supported.
Missing/corrupted/ambiguous legacy history fails visibly instead of being repaired.
Single categorize repeats are intentional corrections (new IDs/void history), not
stable-result idempotency. Concurrent adopted writers leave one active posting.
Split repeats fail; a split may be corrected to one category using categorize.

## Atomicity and authorization

Organization, bank account and bank transaction are locked in that order. Parent
ownership is verified before decoding bank money, including unsafe foreign data.
All target/contact/tax/cost-center/project/control/bank-ledger references are owned
and live; chart and cost-center activity is required. Category denominations may
be bank or base currency; bank GL must be bank-denominated with correct bank-type
band and exclusive link. Incoming/outgoing references do not bypass AuthContext.
API keys/custom permissions are tested; spoofed organization headers do not change
key scope. No HTTP self-calls or duplicated tool names.

Period locks and closed fiscal years guard every bank posting/correction plus all
expense item dates. Transfer/statement/payment-linked movements require their own
undo workflow. Bank self-linking, control/fallback creation, journal, bank stamp,
previous-journal void, expense/items and audits share the transaction and rollback.
Responses are guarded within it. Categorization does not change statement amount,
running balance or bank balance. Bulk wraps this same atomicity per item.

Bank-created claims are already paid, with source `bank_expense`, sourceId claim
and linked journal. They cannot be edited, approved or reimbursed again by ordinary
claim lifecycle. Recoding/recreating a movement with an existing live bank expense
fails, including historical expense audits and manually cleared bank journal links.
This corrects the earlier unlinked draft behavior which allowed double recognition.
Undo/claim reversal coordination remains MON-068/MON-021; this task does not promise
that existing generic undo restores bank-created expense state. It guards against
silently recreating such claims after an incomplete undo. Existing ambiguous legacy
expense history and bad-unit data require assigned remediation, not automatic repair.

## Qualification limits

Pure contracts and actual exported REST handlers/MCP SDK tools on disposable
PostgreSQL 18 fixtures cover numeric/exact aliases, tenant/role checks, exact tax/FX,
corrections, failure snapshots, concurrent splits/expense creation and atomic audits.
No browser/session/OAuth/provider/PostgreSQL 16/production/independent accounting
qualification is implied. Other bank matching, undo, transfers, bulk and rules stay
MON-066..069. Period-configuration and other legacy writers do not adopt this lock
protocol here. No schema, migration, rollout flag or production IRR change.
