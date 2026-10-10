# Shared core posting cutover (MON-128)

2026-10-10, Asia/Tehran. Bounded backend child of MON-007, under ADR-006 safe-number
coexistence. MON-007 retains its original combined criteria and MON-129 owns the
remaining core UI input/display consumers. Existing REST/MCP operation adoption
is recorded in [core integration](CORE_ACCOUNTING_INTEGRATION_CONTRACTS.md),
with its complete six linked domain inventories; tracker status alone is not
verification. This change does not expand public operations, schemas or supported
business ranges.

## Consumer ownership in MONEY_MANIFEST

| Core backend group | Adopted service/wire arithmetic and complete boundary ownership | Shared closure in this child |
|---|---|---|
| Ledger/manual/imported/recurring journals | journal-wire, journal-lifecycle, journal-import-wire, recurring-journal-wire; [journal inventory](JOURNAL_INTEGRATION.md) | journalTotals uses exact ratio rounding while retaining its documented safe FX-product cap; convert-entry uses bigint side sums and residuals |
| Invoice/quote/credit/customer-credit/receipt | invoice-write-wire, invoice-lifecycle-wire, quote-wire, credit-wire (including customer credits), sales-receipt-wire; [receivable inventory](RECEIVABLE_DOCUMENT_INTEGRATION.md) | Shared retained invoice/credit recognition sums guard before inserting headers; common converter and saved reversal helpers use exact money |
| Bill/debit/PO/requisition/receipt | bill-write-wire, bill-lifecycle-wire, debit-note-wire, purchase-order-wire and procurement services; [payable inventory](PAYABLE_PROCUREMENT_INTEGRATION.md) | Retained createBillJournalEntry tax/recoverability/sums use exact ratios and one transaction including control accounts, header and lines; current bill lifecycle already has its own adopted exact posting |
| Cash/allocations/replay/reversals | payment-settlement-wire, payment-batch-wire, payment-reversal-wire, payment-settlements and payment-batches; [payment inventory](PAYMENT_EXPENSE_BANK_INTEGRATION_CONTRACTS.md) | Shared payment journal allocation and converted bank/counter sums plus realized FX differences become exact |
| Expenses/bank coding/import/matching/transfers/reconciliation | expense-wire, expense-lifecycle-wire, bank-categorization and linked bank wire/service modules; [cash/expense/bank inventory](PAYMENT_EXPENSE_BANK_INTEGRATION_CONTRACTS.md) | Retained categorization gross-inclusive/reverse-charge tax and absorbed expense sums use exact ratios; new regression covers the shared helpers separately from already adopted public services |
| Tax/settings/approval/filing/settlement | tax-rate-wire, tax-period-wire, tax-period-calculation, approval-wire; [configuration inventory](CONFIGURATION_INTEGRATION_CONTRACTS.md) | calcTax and splitGrossTax delegate to canonical posting ratios; retained VAT control aggregation reads SQL text, checks exact totals/differences before legacy projections |
| Shared document stock-to-GL bridge | journal-automation createCogsJournalEntry, recordBillStockReceipts and createInventoryAdjustmentJournalEntry; inventory-valuation | Money cost products and unit-cost division are exact; whole physical quantity rounding remains explicitly separate. Inventory master regression verifies the live bulk-adjustment consumer; broader costing/background closure remains MON-008 |

These are source-verified owners, not a claim that every historical pure/helper
function is a live API call. In particular the retained createBillJournalEntry,
createCategorizationJournalEntry and calcTax helpers have no current external
source caller. They remain callable shared backend exports, so they must not
silently lose low digits or leave failed posting headers. Current REST/MCP core
services already use the linked exact adapters and their own transaction policies.

`lib/money/posting.ts` validates safe integer input, delegates signed rounding to
canonical `roundRatio`, keeps intermediates/sums as bigint and projects only
supported final values through `legacyMinor`. Ties retain the previous policy
toward positive infinity, including negative half ties. A final or input amount
outside +/-9007199254740991 raises classified LEGACY_NUMERIC_RANGE/422 through
existing REST/MCP error wrappers. Positive FX rates remain int32 millionths.
Canonical ratio products may exceed JS precision in memory; public operations'
existing narrower caps still apply. Full-int64 business/rate support is not inferred.

## Explicit scale and compatibility exceptions

- Monetary posting inputs/outputs are the existing stored document/base/bank
  minor integers. No magnitude inference, historical rescale or currency flag edit.
- FX `1000000` is an explicit quote-rate denominator, not a currency scale.
  `convertAmount` and retained `toBaseLines` remain raw-unit scalar helpers.
  Current document posting uses `convertInvoiceLegs` with both currency scales;
  no cross-scale FX qualification is inferred from the retained scalar helper.
- `10000` is the explicit basis-point denominator for tax/recoverability/discount,
  not two-decimal currency arithmetic. Gross tax uses `10000 + rateBp`.
- Document quantity `/100` and whole-unit Math.round in shared stock helpers
  are physical hundredths, not money. Shared unitCost rounding now uses an exact
  integer ratio; no perpetual valuation/reversal policy is otherwise changed.
- `journalLegacyDecimal` and existing journal import retain fixed-two legacy
  projections with exact raw Minor companions. They use integer formatting/parsing
  rather than floating monetary calculations. Domain recurring/import exceptions
  remain in their linked inventories; they are not reinterpreted as currency major.
- Core UI still has legacy money parsing/calculation: accounting/[id]/page.tsx,
  shared create-drawer document prices/expense mileage/journal totals, and other
  core list/detail/edit and tax settlement screens. MON-129 must enumerate and
  migrate these consumers, splitting as needed. This child cannot close MON-007.
- Auxiliary jobs/reports/exports/public/provider/rendering complete-consumer
  closure is MON-008. Existing operation adoption does not erase remaining lexical
  consumer work or financial/migration/security/locale/release gates.

## Verification composition

New `posting-money.test.ts` proves the one-minor-unit floating error, signed ties,
safe edges, exact cancellation, rejected inputs/results, gross-tax conservation
and FX residuals. `core-money-cutover.test.ts` invokes real shared posting exports
on migrated synthetic PostgreSQL, with independent integer expectations across
USD/IRR/JPY/KWD. It verifies large gross/partial/reverse-charge tax, bill control
legs, recognition/credit preflight, unchanged range failures and mirrored saved
reversals. EUR-to-USD recognition retains low digits and saved FX after reference
rate edits; a genuinely unsafe SQL control sum rejects with transaction state
unchanged. Synthetic IRR values do not enable production IRR.

Separate actual authenticated handler/full-SDK core, journal, receivable,
payable/procurement, cash/expense/bank and configuration fixtures retain deeper
allocation/replay, lock, concurrency, permission and tenant coverage. Historical
FX, public FX, combined economic-event and inventory master regressions verify
shared-helper impact without running a Next server. The new helper fixture is
not itself an authenticated transport or independent accounting qualification.
