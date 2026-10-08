# Payment, expense and banking integration contracts - MON-021

2026-10-09, Asia/Tehran. This is the independent integration acceptance of
MON-055..069, based on current shared services, actual exported REST handlers,
registered MCP SDK tools and migrated disposable PostgreSQL fixtures.

## Boundary inventory

Each linked registry documents the complete operation inputs, envelopes,
permissions, units, aliases, supported ranges, state and error contracts.
Their historical task evidence remains unchanged; current combined verification
is recorded in MON-021-attempt-1.md.

| Child | Boundaries and detailed contract | Current operation fixture |
|---|---|---|
| MON-055 | [Payment list/detail](PAYMENT_READ_WIRE_CONTRACTS.md), contact/bank/paired allocations | payment-reads |
| MON-056 | [Standalone/invoice/bill cash settlement](PAYMENT_SETTLEMENT_WIRE_CONTRACTS.md), carrying FX, retry keys | payment-settlements |
| MON-057 | [Cash/noncash payment reversal](PAYMENT_REVERSAL_WIRE_CONTRACTS.md), saved GL and allocations | payment-reversals |
| MON-058 | [Immediate batch and batch CRUD/process/remittance](PAYMENT_BATCH_WIRE_CONTRACTS.md) | payment-batches |
| MON-059 | [Scheduled payment CRUD/process](SCHEDULED_PAYMENT_WIRE_CONTRACTS.md) | scheduled-payments |
| MON-060 | [Expense claim CRUD/list/detail/counts](EXPENSE_CRUD_WIRE_CONTRACTS.md), items, mileage, attachments | expense-crud |
| MON-061 | [Expense submit/recall/approve/reject/pay/reverse](EXPENSE_LIFECYCLE_WIRE_CONTRACTS.md) | expense-lifecycle |
| MON-062 | [Bank account CRUD/balance diagnostics/alerts](BANK_ACCOUNT_WIRE_CONTRACTS.md) | bank-accounts |
| MON-063 | [Statement reads/suggestions/activity/imports/duplicates](BANK_TRANSACTION_READ_WIRE_CONTRACTS.md) | bank-transaction-reads |
| MON-064 | [Statement and mapped bulk import/preview/profiles](BANK_IMPORT_WIRE_CONTRACTS.md) | bank-imports |
| MON-065 | [Categorization/account split/bulk coding](BANK_CATEGORIZATION_WIRE_CONTRACTS.md) | bank-categorization |
| MON-066 | [Document split/match, existing payment/journal match](BANK_DOCUMENT_MATCH_WIRE_CONTRACTS.md) | bank-document-matches |
| MON-067 | [New transfer and statement transfer match](BANK_TRANSFER_WIRE_CONTRACTS.md) | bank-transfers |
| MON-068 | [Reconciliation sessions/proof/adjustments/mark/undo/exclude](BANK_RECONCILIATION_WIRE_CONTRACTS.md) | bank-reconciliations |
| MON-069 | [Rule CRUD/testing/application/maintenance](BANK_RULE_WIRE_CONTRACTS.md), opaque monetary configuration | bank-rules |

Fixture names identify `tests/integration/<name>.test.ts` and its worker. Each
test creates, migrates and drops a random database; none resets the target DB.
Credit/debit-note and bill lifecycle regressions qualify the shared noncash and
recognition carriers alongside these fifteen child fixtures.

## Units and compatibility

Integer numeric money retains existing document/bank currency minor units and
adds canonical matching `*Minor` strings. USD 1250 remains 1250 cents; IRR/JPY
1250 remains 1250 minor units; KWD 1250 remains 1.250 major units. No magnitude
inference, historical rescaling, exact-mode header or implicit conversion occurs.
Statement amounts/balances are signed; saved null balances retain null aliases.

Legacy exceptions remain explicit: immediate-batch allocation `amount` and REST
expense item `amount` are decimal major units; MCP expense item `amount` is
integer minor units. New-transfer REST/MCP numeric units also differ as documented
in the transfer registry. Statement text amounts and mapped bulk rows are major
units except native minor formats and explicit Minor columns. `amountExact`
represents a decimal major string; supplied aliases must agree after the operation's
documented currency-scale rounding. Quantities, mileage distance, percentages,
FX, counts and priorities retain their separate units.

Exact inputs use canonical integer strings and int64 syntax, but these adopted
ORM consumers support only safe numeric coexistence: absolute minor values and
derived sums <= 9007199254740991. Positive/nonnegative restrictions depend on
operation. Unsupported exact values/history/FX fail with 422
`LEGACY_NUMERIC_RANGE`; malformed numeric/schema inputs fail with 400. Products
and sums use bigint/SQL text before guarded numeric serialization. Historical
exact FX must also coexist losslessly with positive int32 millionths. These are
bounded contracts, not full-int64 business support.

## Shared-record behavior

`payment-expense-bank-integration.test.ts` composes actual REST and SDK tools in
four independent organization pairs, with USD/IRR/JPY/KWD as their base currencies.
The fixture creates recognized documents, applies paired credit/debit-note
offsets, settles invoice cash through REST and a major-unit MCP batch, imports
the corresponding statement, matches existing cash and a fresh bill settlement,
and proves a zero bank GL/statement reconciliation before completing its session.
It reads payment/paired allocation aliases through both transports. Noncash
offsets create no second cash posting and remain distinct from cash settlements.

Detaching an existing cash payment preserves its original journal; subsequent
payment deletion restores only its allocation and posts the saved reversal.
Undoing a bank-created cash settlement reverses its payment and restores the
bill's outstanding amount, retaining its debit-note offset. Expense approval,
payment and reversal use the same bank GL while creating no payment allocation
carrier. Reversal restores the bank GL exactly. Competing REST cash settlement
and MCP bank settlement of one invoice allow one allocation/cash posting; the
winner can be linked/undone through its owning workflow. All posted journals
remain balanced by SQL numeric sums.

Cross-tenant IDs, denied write roles, invalid API keys, disagreeing money aliases,
unsupported exact range and unknown payment MCP fields reject without financial
or non-authentication audit changes. MCP registers full strict schemas for all
five payment tools and invoice/bill pay tools; unknown fields reach rejection
instead of being stripped by the SDK's raw-shape registration. Existing tool
names, defaults, output envelopes, service authorization and retry semantics stay
the same. The child fixtures additionally cover fiscal/period locks, foreign
historical FX, safe maximums, forced database/audit rollback and domain races.

## Qualification limits

The combined fixture uses exported handlers with API-key authentication and the
real linked MCP SDK, not a running HTTP server, browser, OAuth session or live
provider. Child fixtures run against PostgreSQL 16 for this acceptance; no clean
dependency install, production migration/deployment, statutory compliance,
independent accounting/security review or IRR production enablement is implied.
External configuration/manual writers do not all acquire the adopted locks.
Bank feeds and owner-deferred provider work stay outside this task. No schema,
migration, stored monetary unit or rollout flag changes are required.
