# Dashboard widget and action-alert contracts (MON-119)

2026-10-07, Asia/Tehran. Technical self-review only. This bounded child of
MON-105 adopts two REST route files and six MCP operations. Layout CRUD,
custom/saved reports, scheduled delivery and budget notification writes remain
MON-120..123; MON-105 retains independent integration acceptance.

## Operations and inputs

| GET REST boundary | MCP tool | Output and selection |
|---|---|---|
| /api/v1/dashboard/widgets/accounts_receivable/data | get_dashboard_receivables | total, totalMinor, currencyCode, count, overdueCount; all live invoices, including draft/void/paid |
| /api/v1/dashboard/widgets/accounts_payable/data | get_dashboard_payables | Same fields for all live bills; null stored amountDue maps to zero |
| /api/v1/dashboard/widgets/bank_balances/data | get_dashboard_bank_balances | accounts with id, name, balance, balanceMinor, currencyCode; includes inactive live accounts |
| /api/v1/dashboard/widgets/inventory_alerts/data | get_dashboard_inventory_alerts | lowStockCount and first ten active live items at/below reorder point, sorted by ID; item id/name/code/quantityOnHand/reorderPoint |
| /api/v1/dashboard/widgets/quick_actions/data | get_dashboard_quick_actions | actions: new_invoice, new_bill, new_entry, new_contact |
| /api/v1/dashboard/alerts | get_dashboard_alerts | overdueInvoices, overdueBills, uncategorizedTransactions, accountsNeedingReconciliation, activeReminderRules |

Only monetary widgets and action alerts accept optional currencyCode: a supported
uppercase ISO code. REST rejects duplicate/unknown/empty parameters and unknown
widget types with 400. Nonmonetary widgets reject a currency filter. Shared service
input objects are strict; MCP fields describe their units. The SDK validates its
advertised input schema. Every operation requires view:data, including custom role
permissions. REST authenticates the API key/session; MCP gets AuthContext at
server creation and calls the shared direct-Drizzle service with wrapTool. The
new registration is in lib/mcp/tools/index.ts; no HTTP self-calls occur.

## Units, aliases, ranges and currency

Document amountDue totals preserve the existing integer fixed-cent contracts:
1250 remains 1250 for USD/IRR/JPY/KWD, without FX or rescaling. The numeric total
coexists with canonical signed ASCII totalMinor. Bank balances retain the bank
account contract's currency minor units (USD cents, JPY/IRR units, KWD thousandths),
with numeric balance and exact balanceMinor. Both aliases carry the identical
stored integer; currencyCode labels its existing unit convention.

Source amounts and final totals must each fit +/-9007199254740991. Text SQL
projections preserve stored bigint values before narrowing. Every selected source
is checked; bigint arithmetic allows exact cancellation of individually supported
operands and checks the final total. Unsupported stored source/output/currency or
selected alert dates fail with 422 LEGACY_NUMERIC_RANGE (MCP error includes status
422). No exact-only/full-int64 mode or representation header is advertised.
Counts and inventory quantities remain numeric, never money aliases. Unknown
input currency is a 400 validation failure, not an FX lookup.

Mixed currencies in each selected document total require a currencyCode filter.
Invoice and bill alert sections are checked separately and each carries its own
currencyCode; they are never added together. Empty sections use the requested
currency, otherwise the organization default (USD if absent). Invalid stored
fallback currencies reject when used. Per-account bank balances are never summed
and can expose multiple currencies without a filter. The filter selects bank
accounts by currency without converting their amounts.

## Selection, isolation and read-only behavior

Receivable/payable widgets retain all live document statuses. overdueCount counts
the explicit overdue status. Action-alert document sections instead select dueDate
strictly before today in UTC, excluding draft/void/paid and soft-deleted documents;
count includes selected zero/signed amounts. Due today is excluded. Selected
alert dates and exposed reconciliation dates must be real Gregorian dates in
0001..9999. No posted financial history or document lifecycle is changed.

Action-alert operational counts stay organization-wide even with a monetary
currency filter. Uncategorized transactions require null accountId and
unreconciled status on live organization bank accounts (including inactive).
Deleted bank account transactions are now excluded. Reconciliation alerts use
active live accounts, latest completed endDate, and more than 30 UTC calendar days
since that date; exactly 30 days is excluded. No completed reconciliation means
an alert; in-progress records do not count. Results carry bankAccountId,
bankAccountName and lastReconDate (null if absent), ordered by account ID.
activeReminderRules counts enabled live rules, retaining its original semantics.

All selected documents, banks, inventory and reminder rules are scoped to the
authenticated organization. Reconciliations/transactions join through scoped bank
accounts. Narrow projections do not decode unrelated monetary fields or expose
contacts, GL relations, banking credentials, raw payloads or inventory prices.
Each service reads a repeatable-read, read-only snapshot and verifies the
organization exists (404 if missing). No domain writes, audit entries, notifications,
email/provider requests, locks on posted periods or idempotency mutations occur.
API-key authentication may update lastUsedAt independently of the service.

## Verification and remaining limits

tests/integration/dashboard-data.test.ts migrates disposable databases and invokes
actual authenticated handlers plus MCP SDK clients. The owner client uses the full
registerAllTools entry point. Assertions cover all six operations, both legacy and
exact writer inputs, role/tenant isolation, status/date boundaries, empty defaults,
currency selection, bank/reconciliation/reminder/inventory selection, safe signed
edges, cancellation, source/result overflow, invalid saved currency/date, and
unchanged domain/audit snapshots on success/failure. Unconsumed unsafe source
columns do not break narrow count-only operations.

Large-volume performance, full-int64 business paths, application-wide financial
qualification, migration/IRR enablement and the remaining MON-105 children retain
their own gates. No schema, migration, build, dev server or deployment change is
made by this child.
