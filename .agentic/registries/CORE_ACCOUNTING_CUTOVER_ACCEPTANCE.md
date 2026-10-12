# Core accounting consumer cutover acceptance (MON-007)

2026-10-12, Asia/Tehran. Independent final integration of MON-128 posting and
MON-129 editors/presentation under [ADR-006](../docs/ADR-006-EXACT-WIRE-COMPATIBILITY.md).
The runtime already composes; this task adds combined acceptance and reconciles
ownership. No schema, public operation, supported range or production flag changes.
This entry supersedes older MON-007-pending wording in the linked inventories.

## Complete consumer ownership

[MONEY_MANIFEST](MONEY_MANIFEST.md) owns the economic units and task disposition;
[MONEY_BOUNDARIES](MONEY_BOUNDARIES.json) records lexical paths, source lines and
hashes. The complete operation inventories below join those records to adopted
REST handlers, direct-DB MCP tools, shared services and core UI sections.

| Consumer family | Complete backend ownership | Editor/presentation ownership |
|---|---|---|
| Ledger, manual/imported/recurring journals and saved reversals | [Journal inventory](JOURNAL_INTEGRATION.md); journal-wire/lifecycle/import/recurring, convert-entry, posting | [Core UI](CORE_UI_MONEY_CUTOVER.md) MON-130/152; journal editor, list/detail/account pages and recent-journal dashboard section |
| Invoices, quotes, credits, prepayments, cash receipts and recurring receivables | [Receivable inventory](RECEIVABLE_DOCUMENT_INTEGRATION.md); exact write/read/lifecycle/credit/receipt/generation services | Core UI MON-131/134..138/143..146; document drawers, previews, lists/details and shared line/amount controls |
| Bills, debits, PO/requisition/receipt and recurring payables | [Payable inventory](PAYABLE_PROCUREMENT_INTEGRATION.md); exact bill/procurement/debit services | Core UI MON-132/139..142; previews, drawers, procurement conversions and saved detail/list/editor sections |
| Payments, allocations, replay, reversal, expenses, bank imports/matches/transfers/reconciliation | [Cash inventory](PAYMENT_EXPENSE_BANK_INTEGRATION_CONTRACTS.md); settlement/reversal/batch/expense and bank services | Core UI MON-133/148..150; payments, expense/mileage, banking pages, bank/base proof and raw rule thresholds |
| Opening balances, organization configuration, tax rates/returns/settlement and approvals | [Configuration inventory](CONFIGURATION_INTEGRATION_CONTRACTS.md), [core contracts](CORE_ACCOUNTING_INTEGRATION_CONTRACTS.md); exact settings/tax/approval and flat opening reads | Core UI MON-133/147/151; explicit USD openings, exact rates/money/thresholds, tax and organization settings |
| Retained posting helpers and stock-to-GL money bridge | [Posting inventory](CORE_POSTING_CUTOVER_CONTRACTS.md); exact tax/FX/sums/cost products with checked numeric projections | Shared inputs use the above domain editors; physical quantities remain nonmoney |

MONEY_BOUNDARIES also contains nonmoney IDs, counts, dates, percentages and
metadata consumers. Their lexical matches are not unresolved monetary math.
Shared create-drawer, LineItemsEditor, InvoiceAmountInput, DualAmount,
SendDocumentDialog and dashboard are owned by section, as detailed in Core UI.
Remaining budget/accrual drawers, budget/report/dashboard widgets, auxiliary
domains, background processors, public/provider/export/PDF consumers belong to
MON-008. Existing backend contracts for these surfaces do not prove complete
consumer closure; MON-008 must inspect the actual remaining source.

## Independent combined behavior

`tests/integration/core-cutover-acceptance.test.ts` and its worker run eight
authenticated REST-origin/MCP-origin workflows on migrated disposable PostgreSQL
in USD, JPY, KWD and synthetic IRR. One linked MCP session per organization owns
the involved journal, document, payment, bank, account and reversal operations.

Exact editor price 3000000001 raw units plus half a minor unit times three
travels through quote/accept/convert/recognize and bill/recognize. At 3333 basis
points, independently asserted tax is 999900001 on each document. Existing
price-first quote rounding and extended-price bill rounding give totals
3999900005 and 3999900004, saved tie prices 1, quantity 300, and line amounts
3 versus 2. Both documents settle completely; two authenticated transports
replay each payment's saved result without new GL, allocations, numbering or
audit writes. Imported statement movements then match those existing payments.
Manual editor/posting of seven units leaves cash net eight. Literal SQL-text
oracles verify five balanced journals with total debits 15999600025, zero dues,
numeric/Minor agreement and explicitly tagged account/journal presentation.

Foreign reads/settlement, overpayments, malformed/overflow/conflicting writes,
locked settlement, bank-linked deletion, locked reversal and repeated deletion/
void reject without changes to ordered snapshots. Snapshots include document
headers/lines, quote headers/lines, chart/bank accounts, movements, payments,
allocations, journals/legs, numbering, locks, rates and financial audit rows;
API-key usage bookkeeping is excluded. Display reads also preserve these rows.

After unmatching, payment deletions restore original document dues. Invoice,
bill and manual reversals then exactly mirror every original line, including
amounts, account, currency, exact/legacy FX, direction/version/migration status,
provenance and dimensions. Original journal lines remain byte-equivalent as
SQL-text fields. Every journal balances and every posted account net becomes
zero. Repeated destructive operations reject with unchanged final snapshots.

The joint acceptance run additionally executes the existing core editor/UI,
shared posting, core/journal/receivable/payable/cash/configuration, FX history/
wire and serialization fixtures. These independently cover expense and credit
unwinds, real tax filing/settlement, opening balances, procurement/recurrence,
role/tenant isolation, concurrency, source/base scales, edited reference rates
and unchanged saved FX. Parent acceptance comes from actual combined runs and
source review, rather than completed child status.

## Reviewed unit and compatibility exceptions

- Canonical money calculation uses bigint/rational arithmetic and checked safe
  numeric projections. Public number-domain operations retain their documented
  limits; int64 storage/transport does not expand business capability.
- Quote/converted-invoice price-first rounding and ordinary bill extended-price
  rounding remain distinct. Recurring payable price input deliberately remains
  fixed-two for all tags, before quantity extension. No history is rescaled.
- Journal REST fixed-two decimal aliases use exact integer formatting/parsing
  alongside raw Minor strings; MCP reads use numeric raw minor units. Tagged
  manual amounts and automated base amounts follow the saved/source policy.
- Opening balances deliberately retain numeric integer USD cents. Account raw
  GL aggregates retain the current organization-base convention, including the
  existing mixed/history restrictions; this task does not normalize history.
- FX millionths, basis-point denominators, quantity/distance hundredths,
  counts, dates and UI percentages are nonmoney. Source inspection confirms
  remaining core tax/bank percentage floats do not calculate currency amounts.
- Legacy cross-scale REST invoice base display rejects unsupported envelopes;
  MCP's invoice-only source representation remains usable. No inferred scale
  or repeated conversion is introduced.

No hidden monetary float/fixed-two shortcut remains in the owned core sections.
Auxiliary budget floats remain explicitly MON-008. Production IRR, full-int64
business expansion, accounting defects/qualification, base-history remediation,
bank-feed parity, migration, security, localization and release gates remain
independent. Local PostgreSQL 18 verification does not qualify hosted PostgreSQL
16. DEC-005 permits behavioral/static layout review; no live browser effects,
full build, dev server, deployment or independent human review is claimed.
