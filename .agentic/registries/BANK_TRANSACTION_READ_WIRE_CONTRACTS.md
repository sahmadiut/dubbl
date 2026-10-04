# Bank transaction read contracts (MON-063)

2026-10-04, Asia/Tehran. Actual sources: bank-transaction-read-wire.ts,
bank-transaction-reads.ts, bank-match-reads.ts, six REST GET exports and
bank-transaction-reads MCP tools. ADR-006 numeric coexistence applies.

## Operations and inputs

| REST GET /api/v1 | MCP | Inputs and output |
|---|---|---|
| bank-accounts/:id/transactions | list_bank_transactions | Live bank UUID; optional status, page, limit. REST {data,pagination}; MCP {transactions,total,page,limit} |
| bank-transactions/:id/activity | get_bank_transaction_activity | Live transaction UUID; {currencyCode,activity} |
| bank-transactions/:id/suggestions | get_bank_account_suggestions | Live transaction UUID; {suggestions} |
| bank-transactions/:id/match | get_match_suggestions | Live transaction UUID; {transaction,suggestedMatches,existingMatches,openInvoices,openBills,accountSuggestions} |
| bank-accounts/:id/imports | list_bank_statement_imports | Live bank UUID; {imports}, latest 20 |
| bank-accounts/:id/duplicates | list_bank_transaction_duplicates | Live bank UUID; {bankAccountId,duplicateGroups,totalGroups}, at most 100 ordered pairs |

MCP bankAccountId/transactionId input objects are strict and every field is
described. Existing list_bank_transactions and get_match_suggestions names move
from the writer module to this module, registered once in tools/index.ts. Shared
services use direct Drizzle access with AuthContext/wrapTool; no HTTP self-calls.

Status is unreconciled/reconciled/excluded. Page defaults 1, limit 50. REST accepts
canonical positive ASCII integer query strings, page <=2147483647, limit 1..100;
MCP accepts integer Numbers, limit 1..200. Computed offset must fit positive int32.
Malformed/empty/fraction/exponent/leading-zero queries and unsupported offsets
reject with 400; no parseInt truncation, NaN SQL or silent clamping. Unknown MCP
fields reject. UUIDs validate before SQL. No money input or exact negotiation
flag is needed for these reads: aliases always coexist with numeric outputs.

## Units and supported range

All known money is signed integer currency minor units. USD 1250 means 1250 cents;
JPY/IRR 1250 remains 1250; KWD 1250 remains 1.250 major units. No historical
rescaling, denomination inference, FX conversion or production IRR enablement.
Each numeric money value and aggregate must fit +/-9007199254740991. Out-of-range
stored int64 or unsafe/ambiguous JSON money fails with 422 LEGACY_NUMERIC_RANGE;
aliases do not advertise a full-int64 business path. No bigint JSON crash, numeric
rounding, string fallback, dynamic magnitude negotiation or removal of v1 fields.

| Boundary | Numeric fields retained | Exact aliases / currency |
|---|---|---|
| Transaction list | amount, nullable balance, existing transaction columns | amountMinor, nullable balanceMinor, effective currencyCode |
| Nested import and import list | nullable openingBalance/closingBalance; numeric imported/duplicate/error counts | matching nullable *Minor aliases, effective currencyCode |
| Match transaction/candidate | signed amount; document/payment/journal/transfer identifiers and descriptions | amountMinor, currencyCode |
| Match open documents | total, amountDue; status/date/reference context | totalMinor, amountDueMinor, currencyCode |
| Existing match meta | payment positive amount, journal positive net side, transfer original signed amount | amountMinor, currencyCode, retained metadata |
| Activity changes | known amount/balance/taxAmount/totalAmount and allocation-item money | corresponding nullable *Minor aliases; outer currencyCode |
| Duplicate group | original signed amount | amountMinor, currencyCode; canonical Gregorian date string |
| Suggestions/pagination | confidence, matchCount, page, limit, total, totalPages, group counts | Ordinary counts/percentages, no minor-unit alias |

Null aliases remain null. Bank transaction nullable currency and import nullable
statementCurrency inherit the live bank currency explicitly; noncanonical or
mismatched saved currencies reject. Nested GL/import/journal/reconciliation/
contact/tax/dimension/transfer references exposed by the transaction list must
belong to the same organization (reconciliation/import also to the same bank).
Historical soft-deleted owned references can still identify retained history.

Audit normalization projects known money fields and allocation items, checks
numeric/exact agreement and leaves saved JSON unchanged. reversedAllocations is
a count. Opaque audit metadata, rawPayload and import metadata retain their own
units and syntax; no generic major/minor inference or blind amount-name conversion
inside opaque objects. Generic serialization still rejects unsafe/nonfinite
Numbers in all nested payloads. Already-rounded JSON Numbers cannot be recovered;
opaque historical remediation remains MON-032/033, not claimed completed here.

## Matching, aggregates and isolation

All six operations use repeatable-read, read-only PostgreSQL snapshots. Lists,
counts and nested references share a snapshot; list ordering is date DESC,
createdAt DESC, id ASC. Import/activity and top-N sets have deterministic tie
ordering. Numeric counts come from SQL text and bigint range checks. Reads do
not post ledger entries, write audits, mutate bank data or bypass dated period
locks. Authentication's existing API-key lastUsedAt update remains separate.

List/import/duplicates retain authenticated-read access. Activity/account/match
suggestions retain manage:banking, including custom permission checks. All banks
must be live and owned; foreign/missing/deleted parents return 404, invalid/expired
API keys 401 and insufficient permissions 403. Activity additionally filters
auditLog.organizationId even when another org has an event for the same entity
UUID. User projection includes only id/name/email. API-key org-header spoofing
does not override the authenticated organization.

Open documents, existing payments and transfer candidates must share the bank
currency. Contact names and payment journal IDs are checked for tenant ownership;
void/deleted payment journals are not suggested. Existing bank GL must be owned.
Journal debit/credit fields are base currency; existing-journal suggestions are
limited to banks in the org's current base currency. All bank lines in a selected
entry are summed as bigint debit minus credit and guarded, not offered separately
or compared to a foreign statement amount. Incompatible projected journal-line
currency rejects. Unlinked journal exclusion is org-scoped, preserving linked
historical bank rows. This is a read candidate ranking, not settlement/posting
qualification or automatic repair of legacy carrying history.

Matching preserves confidence rules, direction, date/reference/text weights and
top five documents / top ten existing candidates. Amount proximity uses exact
bigint products with strict <1%/<5% thresholds; date windows use UTC Gregorian
days. Documents/payments/transfers examine deterministic first 50 eligible rows;
journals sum complete eligible entries and consider the first 50 entry IDs in
date/ID order. Candidate limits are not an exhaustive search or financial proof.
Zero-amount lines retain the previous non-outgoing direction behavior.

Account suggestions join live bank to owned active undeleted GL accounts;
invalid/foreign category rows cannot disclose GL names. Counts/rounded percent
confidence use bigint, without changing percentages into money. Existing ASCII
text normalization remains; Persian search/localization belongs to later tasks.

Duplicate detection retains same signed amount/date rather than absolute value,
and now requires the same effective currency. Opposite-sign flows remain
distinct. SQL projects amount/date as text, followed by guarded numeric and exact
aliases; PostgreSQL bigint driver strings are not accidentally sent as numeric
fields. Groups are built from at most 100 stable pairs; large groups can be
partial. No deletion/idempotency claim is made by this diagnostic.

## Verification and handoff

Pure fixture: tests/bank-transaction-read-wire.test.ts. Actual migrated disposable
PostgreSQL REST handlers and MCP SDK transport:
tests/integration/bank-transaction-reads.test.ts and worker. See attempt evidence
for results, regressions, environment and exclusions. Boundary source inventory
and TEST_MATRIX are refreshed. MON-064 owns statement/bulk import/profile writers;
MON-065..069 own reconciliation/categorization/transfer/bulk/rule contracts.
MON-021 retains combined banking acceptance, full-range/migration/production and
independent financial qualification; existing AUD-002 discrepancy is not fixed
or waived by these reads.
