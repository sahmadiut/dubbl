# Core accounting integration contracts (MON-014)

2026-10-09, Asia/Tehran. Combined acceptance of the six adopted core groups under
[ADR-006](../docs/ADR-006-EXACT-WIRE-COMPATIBILITY.md). This index and its linked
inventories document every selected REST/MCP operation, input/output envelope,
unit, alias, supported range, permission and exclusion. Child completion alone
does not establish this parent's acceptance.

| Core group | Complete operation/field inventories | Current combined verification |
|---|---|---|
| Contacts (MON-017) | [Contacts](CONTACT_WIRE_CONTRACTS.md): collection/detail create/read/update/delete, merge; six corresponding tools | All six real SDK operations and API-key handlers; shared AR/AP balances; invoice/bill/payment merge and subsequent cash reversals |
| Journals (MON-018) | [Journal integration](JOURNAL_INTEGRATION.md), indexing CRUD, lifecycle/import and recurring/generation | Legacy REST creation, exact MCP replacement/posting, both detail readers, REST reversal; parent and all three child suites |
| Receivables (MON-019) | [Receivable integration](RECEIVABLE_DOCUMENT_INTEGRATION.md), indexing invoice reads/writes/lifecycle/bulk, quotes, credits, receipts and recurring invoices | Contact to legacy/exact invoice, recognition, payment, merge/reversal; parent and all eight child suites |
| Payables/procurement (MON-020) | [Payable/procurement integration](PAYABLE_PROCUREMENT_INTEGRATION.md), indexing bill reads/writes/lifecycle/bulk, PO/requisition/receipt, debit note and settings | Shared contact to opposite-transport bill, recognition, outgoing settlement/merge/reversal; parent and all nine child suites |
| Payments/expenses/banking (MON-021) | [Payment/expense/bank integration](PAYMENT_EXPENSE_BANK_INTEGRATION_CONTRACTS.md), indexing all fifteen detailed inventories | Bank cash, incoming/outgoing allocations, replay, locks, expense reimbursement/reversal; parent and all fifteen child suites |
| Organization/tax/approval (MON-022) | [Configuration integration](CONFIGURATION_INTEGRATION_CONTRACTS.md), indexing settings, rates/profiles/jurisdictions, periods/filing/settlement and approvals | Numeric mileage then exact edit/read at four scales; parent tax/approval/document/filing/settlement flow and all four child suites |

## Units and ranges across boundaries

| Field family | Existing contract | Exact companion / supported coexistence |
|---|---|---|
| Contact credit limit and organization mileage/threshold | Currency minor integers; credit limit nullable, omitted edit retains saved value | Named Minor strings; nonnegative writes through 9007199254740991. Bill threshold remains read-only |
| Manual journal debit/credit inputs | Nonnegative minor integer, omitted side zero | debitAmountMinor/creditAmountMinor; amounts, side sums and required FX intermediates fit safe Number |
| Manual journal reads and legacy import | REST fixed-two-decimal strings/inputs; MCP detail/input minor integers | Minor siblings always raw integers. REST raw 250 reads as historical 2.50 while Minor remains 250, including IRR/JPY/KWD |
| Invoice/bill/PO/requisition numeric line prices | Currency major units on both transports | unitPriceExact major decimal and unitPriceMinor integer; currency scale applies only at this explicit input adapter |
| Credit/debit note and sales receipt numeric prices | REST major units, MCP minor integers | Same exact price aliases with transport-specific numeric agreement; recurring/import exceptions stay in their inventories |
| Payments/allocations/bank balances and movements | Document/bank currency minor integers; positive cash/allocations, signed bank movements | Minor siblings and safe source/intermediate/result bounds. Batch allocation amount/amountExact are major units |
| Ordinary expense item numeric amount | Currency major decimal | amountExact major decimal / amountMinor integer; mileage/physical fields keep separate contracts |
| Tax/approval configuration | Basis points, enums, dates and switches are non-money; approval comparisons use string thresholds | Tax-money Minor aliases and signed int64 approval valueMinor; int64 comparison does not enable int64 posting |
| FX | Saved rates, positive int32 millionths where legacy aliases are required | rateExact, explicit quote_per_base; lossless compatibility, identity-only recurring journals, saved settlement/reversal policy |

Money compatibility remains bounded by +/-9007199254740991, with narrower sign,
minimum, product, total and currency restrictions in the linked inventories.
Canonical int64 syntax does not promise full-int64 consumers. Malformed syntax
and alias conflicts return validation errors; supported syntax outside the
business range and unsafe stored/derived money return classified 422
LEGACY_NUMERIC_RANGE. Physical quantities, percentages, counts and dates receive
no fabricated money aliases. No implicit negotiation, scale guessing, historical
rescaling, bigint JSON fallback, numeric-client removal or production flag change.

## Repairs established by the combined fixture

Unsupported creditLimitExact on contact update disappeared at the SDK boundary
while the accompanying name was committed. All six contact tools now register
full strict object schemas, preserving descriptions/defaults and wrapTool
handlers. REST contact create/update reject unknown fields too. Documented
REST/MCP metadata differences and nullable behavior remain unchanged.

Unsupported journal-line debitAmountExact disappeared before a balanced create
or full replacement. The shared nested line schema is strict on both transports.
Recurring rate validation explicitly projects the three FX fields from its
already validated template into that strict adapter. Manual header/import
whitelisting and other domain-specific policies remain documented; this does
not establish universal rejection of every unknown JSON property.

The new worker calls registerAllTools with real linked SDK clients and checks
unique names and described/full-strict contact schemas. The existing contact
child's direct registered-schema adapter remains; the new real SDK coverage
includes all six operations. Unsupported fields, malformed/conflicting/unsafe
aliases, foreign IDs, denied roles/keys and locked dates use SQL-text snapshots
of core financial tables, numbering and non-authentication audit rows.

Eight scenarios cross USD/IRR/JPY/KWD with legacy 1250 and exact 3000000000 writers.
GL control accounts and contact AR/AP balances agree through recognition, cash,
merge and cash deletion/reversal. Expense reimbursement shares cash GL without
changing payment allocation ownership. Every posted journal balances by SQL
numeric sums. Each scenario finishes with cash zero, restored AR +value, AP
-value and surviving contact limit 1250. IRR is synthetic legacy compatibility;
this does not enable IRR. Existing parent/child suites additionally exercise tax,
approval, procurement/stock, imports/recurrence, saved FX and concurrency.

## Qualification boundaries

Fixtures invoke actual authenticated handler exports and direct-DB SDK tools on
random migrated disposable PostgreSQL databases. They do not run a Next server,
browser, OAuth/session network transport, external provider or production data.
Snapshots omit API-key authentication bookkeeping. Existing audit-fault,
unsafe-history and rollback fixtures remain; no universal atomic-audit or
reference/configuration-lock guarantee is inferred.

Full-int64 cutover, financial/migration/base-currency/IRR qualification, AUD-002
baseline defects, historical remediation and independent accounting/security/
localization/release review retain their gates. Inventory outside procurement
belongs to MON-024; remaining report parents to MON-015; exports/public/provider/
opaque integration to MON-016. No schema migration, history repair, deployment
or approved client deprecation window is introduced.
