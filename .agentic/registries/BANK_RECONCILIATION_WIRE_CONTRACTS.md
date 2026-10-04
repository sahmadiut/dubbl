# Bank reconciliation wire contracts (MON-068)

2026-10-04, Asia/Tehran. Shared direct-DB services in
`lib/api/bank-reconciliations.ts`, described strict schemas in
`bank-reconciliation-wire.ts`, eight registered MCP tools in
`tools/bank-reconciliations.ts`. The old banking module retains a compatibility
export; the main registry registers the new module once. No exact-mode header,
schema migration, historical rescaling, full-int64 promise or IRR enablement.

## Operations and envelopes

| REST | MCP tool | Successful REST envelope |
|---|---|---|
| GET bank-accounts/:id/reconciliations | list_bank_reconciliations | `{data,pagination:{page,limit,total,totalPages}}` |
| POST bank-accounts/:id/reconciliations | create_bank_reconciliation | 201 `{reconciliation}` |
| GET bank-accounts/:id/reconciliation | reconciliation_report | Proof fields below |
| POST bank-accounts/:id/reconciliation action=complete | complete_bank_reconciliation | `{reconciliationId,status,reconciledCount}` |
| POST bank-accounts/:id/reconciliation action=adjustment | post_bank_reconciliation_adjustment | 201 `{journalEntryId,adjustmentAccountId,amount,amountMinor}` |
| POST bank-transactions/:id/reconcile | reconcile_bank_transaction | `{transaction}` |
| POST bank-transactions/:id/unreconcile | unreconcile_bank_transaction | `{transaction}` |
| POST bank-transactions/:id/exclude | exclude_bank_transaction | `{transaction}` |

Paths start `/api/v1/`. All requests require authenticated organization scope.
List needs authenticated access; proof and all writes require `manage:banking`.
Undoing a bank-created expense additionally requires `manage:expenses`.
API keys inherit creator role/custom permissions; spoofed organization headers
cannot change their tenant. MCP uses AuthContext, wrapTool and direct Drizzle.

MCP list retains `{reconciliations,total,page,limit}`; session/proof/adjustment
results match REST. Mark returns `{transactionId,status,reconciliationId,
journalEntryId}`; exclude returns `{transactionId,status}`. Undo retains
transactionId/status/paymentId/reversedAllocations/voidedJournalEntryId/
unwoundTransferLegId/deletedTransferMirror and adds reversalEntryId and
deletedTransaction. The historical name voidedJournalEntryId identifies the
original bank-created posting; it now remains posted with a linked exact
compensating reversal. It is null when an existing posting is only detached.
REST retains its transaction envelope even when a proven synthetic line is
deleted: returned row is its pre-delete statement data with cleared links/status.
MCP deletedTransaction explicitly identifies this case.

## Inputs, outputs and supported units

Every monetary input is **integer bank currency minor units**, never decimal
major units: USD 1250 cents = USD 12.50; JPY/IRR 1250 = 1250; KWD 1250 = 1.250.
Create requires real Gregorian inclusive startDate/endDate (YYYY-MM-DD,
start <= end), and at least one of startBalance/startBalanceMinor and
endBalance/endBalanceMinor. Balances are signed; numeric/exact aliases agree.
Adjustment requires nonzero signed amount/amountMinor, Gregorian date,
optional description (max 10000), own-bank in-progress reconciliationId and
active owned adjustmentAccountId. Mark optionally accepts nullable own-bank
reconciliationId and matching journalEntryId. No new posting occurs on mark.
Complete requires reconciliationId and optionally up to 10000 distinct
transactionIds. Omission selects all unattached nonexcluded window lines;
an explicit empty array selects none, and succeeds only if no such lines remain.
Undo/exclude accept path ID (MCP transactionId) only.

All IDs are UUIDs. Schemas reject unknown fields, malformed JSON/dates/IDs,
fractional/unsafe numeric money, negative zero and conflicting aliases.
Exact Minor strings are canonical signed int64 integers: no whitespace, plus,
leading zeros, negative zero, exponents, decimals or localized numerals.
Actual coexistence capacity for saved/input/derived amounts and totals is
absolute <= 9007199254740991. Larger valid exact strings fail 422 before commit;
numeric schema violations fail 400. No rounding or magnitude-based repair.

Session outputs retain numeric startBalance/endBalance and add matching Minor
strings and currencyCode. Transactions retain numeric amount/nullable balance
and add amountMinor/nullable balanceMinor; null saved currency inherits bank
currency, explicit conflicting currency fails. Nested references/imports are
validated before output; opaque payloads use guarded serialization.

Proof includes bankAccountId,reconciliation,statementEndBalance,glBalance,
difference,isBalanced,hasLedgerAccount,reconciled/unreconciled. Each group
contains count,total,totalMinor,transactions. Statement money and group totals
use bank currencyCode; GL money uses glCurrencyCode (organization base).
Every scalar monetary field adds a matching nullable/nonnullable Minor alias.
PostgreSQL numeric SUM is read as text and accumulated/compared as bigint;
invalid saved GL legs and unsafe totals/differences reject, without int32 casts
or lossy subtraction. A foreign statement/base GL comparison returns null
difference/Minor, false isBalanced and different_currency_units; missing GL
returns missing_ledger_account. No unsupported conversion of historical balance.
Proof uses a read-only repeatable-read snapshot; latest session is the default,
otherwise all unattached lines and the bank's cached closing balance.

REST list has page >=1 and limit 1..100 (default 50); MCP limit 1..200.
Offset must fit PostgreSQL int32. Counts are guarded safe numeric integers.

## State, posting, undo and compatibility corrections

Writes lock organization -> owned bank -> movement/session and share adopted
account/import/coding/matching/transfer writer serialization. Active live banks,
exclusive live correctly typed/denominated GL links, owned references and saved
amount/date/currency history are required. Tenant lookup precedes decoding
foreign money. Statement sessions now prevent changing bank currency/type/GL
link even before the first movement; their balances cannot acquire new units.
Session creation rejects inclusive overlapping windows, including retries.

Completion requires all nonexcluded statement lines in the window accounted
for, with qualified posted bank legs. Explicit foreign/out-of-window/already
attached IDs cannot be silently ignored. Opening balance plus exact included
statement sum must equal closing balance, which must equal the GL. Completion
and adjustments support base-currency banks; foreign statement completion needs
separate qualification and fails 422. Prior unchecked/imbalanced completions
and arbitrary journal ticking are corrected: mark requires a nonzero movement,
matching manual (or legacy null source) identity-FX base journal, no shared/domain/noncash history and an open
own session/window if supplied. Categorize/match workflows account for other
cases. Excluded lines must be restored first.

Adjustment positive amount debits bank/credits revenue; negative credits bank/
debits expense. Default accounts 4920/5940 are transactionally created, validated
and denominated in base currency. Optional session attachment retains the existing
synthetic reconciliation_adjustment movement; amount/date/currency are explicit.
Attached synthetic adjustment participates in statement sums, so callers must
verify opening/closing coverage before completion. Unattached adjustments post
GL only, preserving the old contract. No adjustment is invented automatically.

Undo validates full saved balanced journal amounts, exact FX aliases/version/
direction, accounts/dimensions and the actual matching bank leg. Ambiguous,
shared, foreign, unqualified or changed base-currency history rejects.

- A pre-existing journal matched by MON-066 or mark is detached and preserved.
- A pre-existing cash payment matched by MON-066 is detached; payment, allocations,
  document balances and journal remain. Qualified cash identity, saved settlement
  base and distinct full positive document allocations are checked again.
- A bank-created cash payment uses MON-057 reversal in the same transaction,
  restoring exact invoice/bill balances and preserving retained allocation
  history. Payment is soft-deleted and bank link cleared. Credit/debit/prepayment
  carrier allocations never follow the cash path; other live noncash document
  allocations remain part of the reversal service's balance validation.
- Bank-created category/split/expense/adjustment journals get linked reversals
  copying saved amounts, FX and dimensions verbatim. Bank expense header is
  soft-deleted, with lines/history retained. Unknown expense/provider history
  is not guessed. Bank caches/provider running balances are preserved.
- Transfer must have one qualified shared journal and exactly two owned,
  reciprocal same-currency equal-opposite movements. Both unwind atomically;
  only audit-proven synthetic legs are deleted, including the selected leg.
  Existing statement legs retain amount/date/balance/import provenance.

Affected completed sessions reopen with audit; only removed/reset lines lose
session links. Remaining lines stay attached and the same session can be
completed after accounting is restored. All statement/journal/counter/item/
session dates must be open; closed years reject. Normal bank operations honor
existing custom period bypass; bank-created cash reversal retains MON-057's
stricter document/journal locks with no new bypass permission.

Numbering, GL creation, journals/reversals, documents/payments/expense/pair/session
changes, output preflight and awaited audits commit together. Audit failure
rolls back the entire operation. Originals are not deleted or rewritten with
current FX. Complete/mark/undo repeats reject, concurrent exclusive operations
permit one success. Exclude intentionally toggles; create adjustment intentionally
creates a new economic event each call. No replay key/response replay is promised.
After an uncertain response inspect state before retrying.

Errors use existing mapping: 400 syntax/state, 401 auth, 403 permissions,
404 missing/foreign primary references, 422 range/currency/qualified-history/
period errors; internal/audit faults 500. MCP returns wrapTool errors.

## Verification and remaining qualification

Pure schema/display fixtures and actual exported REST/registered SDK MCP on
disposable migrated PostgreSQL 18 cover legacy/exact/dual balances, signed safe
maxima, int32-exceeding GL, unsafe sums/differences/history, four currency units,
auth/custom roles/tenant isolation, complete/reopen, direct detach, cash/expense/
coding/adjustment/paired undo, audit faults and races. Payment/reversal/expense/
matching/transfer/account regressions retain their separate gates.

The UI submits exact scale-aware balances, accepts three-decimal currency input,
uses bigint sums and exact signed display, identifies unlike statement/GL
currencies and disables unsupported write-off. Locale expansion is separate.
No browser/session/OAuth, provider, PostgreSQL 16, production migration/deployment
or independent financial/security qualification. MON-069 covers other bank
operations; MON-021 retains combined acceptance with MON-042/045/048/051 noncash
and status annotations kept separate. Full-range and production IRR gates remain.
