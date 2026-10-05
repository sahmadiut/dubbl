# Payroll contractor and tax payment contracts (MON-083)

Inspected and implemented 2026-10-06. `lib/api/payroll-payments.ts` is the shared
direct-Drizzle service; REST authenticates API keys/sessions and MCP uses the
server's AuthContext through wrapTool. No HTTP self-calls or representation header.

## Boundaries

Paths below start at `/api/v1/payroll`; contractor paths include the actual
contractor UUID and, for details, the payment UUID belonging to that contractor.
All contractor operations require `manage:contractors`; tax operations require
`manage:payroll`. The live parent contractor must belong to the organization.

| REST operation | MCP operation | Input and returned envelope |
|---|---|---|
| GET contractors/[id]/payments | list_contractor_payments | Contractor ID; `{data: payment[]}` |
| POST contractors/[id]/payments | create_contractor_payment | Amount aliases, optional currency/description/invoiceNumber/service period; `{payment}`, HTTP 201 |
| GET contractors/[id]/payments/[paymentId] | get_contractor_payment | Contractor/payment IDs; `{payment}`; added missing read operation |
| PATCH contractors/[id]/payments/[paymentId] | update_contractor_payment | IDs plus amount aliases, nullable description/invoiceNumber or status; `{payment}` |
| DELETE contractors/[id]/payments/[paymentId] | delete_contractor_payment | IDs; `{success:true}`; added missing pending-only delete operation |
| POST contractors/[id]/payments/[paymentId]/process | process_contractor_payment | IDs, optional paymentDate; `{payment}` |
| GET tax-payments | list_payroll_tax_payments | Optional from/to overlap filters; `{payments: payment[]}` |
| POST tax-payments | create_payroll_tax_payment | Period, allocations, optional bank code/ID, jurisdiction/tax label/date/reference/notes/retry key; `{payment,journalEntryId}`, HTTP 201 |
| Same tax service, legacy MCP adapter | record_payroll_tax_remittance | Existing amount/bankAccountId/taxKind/date fields plus amountMinor/retry key; `{payment,journalEntryId}` |

MCP uses `contractorId` and `paymentId`; REST takes these from path parameters.
Lists are unpaginated as before, ordered deterministically by existing timestamps
and UUID. They return only owned payments. Contractor detail/get_contractor also
uses the same saved-payment DTO; nested master money remains MON-079's contract.

## Money, FX, dates and compatibility

- `amount` is positive integer cents, not a major-unit price. `amountMinor` is
  its canonical ASCII integer-string alias. Either is required on create and on
  each tax allocation; both must agree exactly. Updates may omit both.
- Runtime remains 1..9007199254740991 cents with matching safe numeric responses.
  Canonical int64 aliases above the safe range reject with 422 before commit.
  Invalid/conflicting aliases, fractions, exponents, whitespace, localized digits,
  unknown fields and malformed dates reject with 400. No magnitude or currency
  rescaling; USD/IRR/KWD 1250 remains integer 1250. This is bounded coexistence,
  not full-int64 business support or production IRR readiness.
- New contractor currency defaults to the saved contractor currency. An explicit
  ISO currency may differ; the amount is denominated in that currency. Historical
  null currency remains readable without an invented fallback; processing it
  fails validation. Only active live contractors can create/process new events.
- Dates are real Gregorian YYYY-MM-DD, years 1..9999. Supplied period ends cannot
  precede starts. Process paymentDate defaults to today UTC. Tax REST/create tool
  also defaults today UTC; legacy record_payroll_tax_remittance keeps its existing
  date default of periodEnd. Timestamps retain their existing instant semantics.
- Contractor processing resolves owned authoritative historical FX as of the
  paymentDate: payment-currency -> organization-base `quote_per_base`. No missing
  or quarantined quote becomes 1:1. Bigint ratio conversion rounds once,
  half-away-from-zero, and rejects unsafe/zero results.
- Migration 0010 adds nullable contractor `baseAmount`, `baseCurrency`, `rateExact`
  and `paymentDate`. Their legacy values remain null. New paid rows save all four;
  baseAmountMinor matches the numeric baseAmount. rateDirection is the fixed
  quote_per_base contract (null for legacy no-snapshot rows). SQL rateExact numeric
  uses the positive 20-whole/18-fractional CHECK without typmod rounding.
- Ledger debit/credit cents are converted base amounts; currencyCode tags the
  original payment currency. Lines save authoritative rateExact, format version,
  direction, provenance, exact migration status and the matching exchangeRate
  millionths. Coexistence requires exact positive int32 millionths (at most six
  decimal places, max 2147.483647); unsupported reciprocal/tiny/high rates reject
  transactionally. Payment snapshots survive subsequent live-rate edits.
- Tax remittances are organization-base cents with 1:1 saved ledger FX. Allocation
  sums/grouping use bigint and reject combined overflow. No tax-rate calculation,
  new statutory policy or withholding jurisdiction is introduced.

## Posting, state, scope and retries

Organization locks serialize adopted posting/retry/sequence writers; contractor
row locks are shared with MON-079 master edits and currency-history checks.
Contractor master create/update/delete also acquire the organization lock first,
preventing a contractor-row/audit-foreign-key deadlock against payment creation. Each
mutation validates saved DTOs before updating, preflights its response, and commits
payment/account/sequence/journal/audit together. Synthetic audit faults roll all
of them back. Deleted, inactive, wrong-type and foreign-currency accounts reject.

Contractor processing debits 5130 Subcontractor Expense and credits bank 1100,
creating missing owned base-currency accounts atomically. Tax bank defaults to
payrollSettings.bankAccountCode, then 1100; an explicit owned bankAccountId may
select another base-currency asset account. Supplying ID and code requires agreement.
Missing liability codes are created atomically as base-currency liabilities.
Income buckets (income_tax/fit/paye/state_income/withholding) map to 2220; payroll
tax buckets (fica/social_security/medicare/futa/suta/payroll_tax/nic) to 2235;
pension/benefits/retirement to 2245; garnishment/statutory to 2236. Explicit 3..20
digit liability codes are supported; unknown named buckets reject instead of
silently clearing income tax. Duplicate aliases collapse to one debit per code.
The legacy MCP taxKind substring mapping is retained: fica/social/medicare/futa/
suta/940/unemployment -> 2235, otherwise 2220. REST taxKind is a reporting label;
REST allocations explicitly choose accounts. No implicit 941 liability split.

Unposted pending payments may update or become void. PATCH status paid rejects
with 409; processing is mandatory. Paid/void rows cannot change or delete; delete
physically removes only unposted pending rows with an atomic audit. Posted history
is never rewritten. Period/fiscal-year locks apply to every new posting (422).
Paid process retries return the original payment/journal without rebooking or
auditing; an explicit conflicting date rejects. Retry verifies owned posted
source-linked journal, safe balanced lines, account scope and new snapshot amount/
rate/date agreement. Legacy paid rows with missing journals need manual review,
not invented journal/FX repair. Ordinary contractor creates remain separate events.

Tax `idempotencyKey` is optional, organization-scoped, 1..128 ASCII letters/digits/
._:-. Org-locked audit metadata persists a SHA-256 fingerprint of normalized
period/jurisdiction/bank/date/text and sorted grouped allocations. Numeric and
Minor aliases normalize identically. Matching reuse returns the existing owned
paid payment/journal without new side effects, including after period locks or
rate changes; conflicting input returns 409. Keys are neither reference numbers
nor generic create deduplication. Omitting the key creates a new remittance.

## Verification and limits

Actual migrated PostgreSQL fixtures exercise all eight REST operations and nine
MCP tools through API authentication and SDK transport, including full server
registration and described strict fields. Cases cover cents 29/1250/above-int32/
max-safe, 1.2 FX, later quote changes, concurrent process/remittance retries, master
currency/create races, permission/tenant/sibling/bank scope, period/fiscal locks,
unsafe/invalid/corrupt history, unsupported FX and audit rollback. Separate
0009-to-current fixtures compare every original contractor/tax-payment field,
assert nullable snapshots and repeat migration idempotently. Historical all-money
checksum fixtures exclude only the new snapshot fields and still hash originals.

Dashboard payment editors use existing exact cents input; contractor payments
display their actual saved currency. Individual payment rows use the existing exact
English currency formatter, preserving maximal safe fractional cents. Tax-report
accruals and the existing report summary/bucket calculations remain MON-085. Remittance UI retains a key across network
retries of the same input and changes it for changed input or a successful event.
Source behavior/layout/accessibility was reviewed; no browser/screenshots claimed.
Apply the migration before running this runtime. No production migration/build/
dev server/provider/IRR flag change or human financial sign-off. No liability
balance cap or bank-balance synchronization is added; legacy posted orphan/history
remediation, foreign-bank postings, full-int64, reporting and combined payroll
qualification remain MON-025/MON-084/085 and later gates.
