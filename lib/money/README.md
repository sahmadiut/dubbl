# Exact money core

## Inventory assembly adoption (MON-078)

BOM/components and assembly REST/MCP use scoped transactional services with exact
minor cost aliases and physical decimal quantities. Component consumption uses
bigint ratios and whole-unit ceilings; completion retains full carrying cost in
finished stock/FIFO layers, separate from rounded unitCost. Journal/stock/layers/
status/audit commit together under source/account/range/period/retry checks.
BOM screens use the server's exact purchase-price estimate including wastage.
See [assembly contracts](../../.agentic/registries/INVENTORY_ASSEMBLY_WIRE_CONTRACTS.md)
for operations, ranges and limits. Procurement receipts retain their contract;
MON-024 combined acceptance and money/migration/IRR/release gates remain separate.

MON-077 inventory valuation/landed costs use exact conserving apportionment and
nullable FIFO carrying/consumption values, with historical null read fallback.
REST/MCP numeric amounts retain their units and add Minor aliases; legacy component
major numbers still scale by 100. Report saved carrying values are separate from
legacy price projections. See [valuation contracts](../../.agentic/registries/INVENTORY_VALUATION_WIRE_CONTRACTS.md)
for the additive migration, supported states/ranges, locks, atomic GL/audit and
remaining assembly/combined qualification gates.

Approval conditions (MON-073) keep string `value` and add `valueMinor` only for
monetary document-header thresholds. Both are canonical signed int64 strings
in the document currency's minor units; both supplied must agree. All six
integer operators compare bigint, with no Number coercion, FX or rescaling.
Text fields support literal eq/neq. Real document workflows retain safe numeric
ORM bounds; thresholds support full int64 independently. See
[approval contracts](../../.agentic/registries/APPROVAL_WIRE_CONTRACTS.md) for
supported fields, operations, historical validation and qualification bounds.


MON-072 tax period REST/MCP adds exact minor aliases to frozen lines, VAT totals
and base-currency cash settlement. Shared services freeze, post and audit
atomically with bigint aggregates and filing locks. See
[tax period contracts](../../.agentic/registries/TAX_PERIOD_WIRE_CONTRACTS.md)
for operations, safe bounds, cash/flat-rate/EC limits and remaining gates.

New monetary calculations import `lib/money/exact.ts`. A `Money` carries a signed
bigint minor-unit amount and a validated currency. Final amounts must fit signed
PostgreSQL bigint, including in memory before the storage migration. Intermediate
products/ratios are arbitrary precision. Currency mismatches and overflow throw.
USD 1250 stays USD 12.50; IRR 1250 means 1250 rial. No rescaling occurs.

`scales.ts` is a frozen snapshot of the installed ICU catalog used at MON-002,
with IRR explicitly set to zero as required by the project plan. It deliberately
does not consult runtime ICU during calculations. A future currency regime must
have a separate historical policy; do not change a posted currency's scale in
place. This metadata does not authorize or enable IRR production rollout.

`parseMajor` accepts ASCII decimal strings, with optional sign, mandatory whole
digits and optional fractional digits. It rejects whitespace, group separators,
exponents, symbols, localized digits and malformed suffixes. Input is limited to
256 characters. Locale parsing/formatting belongs to later boundary work.
`toMajorDecimal` emits an exact ungrouped decimal string without Number coercion.

Parsing, multiplication and tax all require an explicit rounding mode:

| Mode | Behavior for fractional minor units |
|---|---|
| reject | Throw unless exact |
| toward-zero | Truncate toward zero |
| floor | Round toward negative infinity |
| ceiling | Round toward positive infinity |
| half-away-from-zero | Nearest; ties away from zero |
| half-even | Nearest; ties to the even integer |

These are primitives, not jurisdictional tax or posting policies. Callers must
select the appropriate operation policy explicitly. `taxMoney(net, "12.5", mode)`
uses plain percent, not basis points. Quantity, discount and FX calculations use
`multiplyRatio`; the caller owns units, FX direction and target currency policy.
MON-004 adds exact FX string storage, backfill and guarded legacy coexistence;
see `../db/FX_MIGRATION.md`. Provider/inverse arithmetic and consumer cutover
remain MON-005/006/007/008 work.

`allocateMoney` requires nonnegative bigint weights with a positive total. It
allocates absolute amounts using largest remainders, breaks ties by input order,
then restores the sign. This deterministic residual policy conserves totals and
mirrors refunds; it is not automatically applied to existing workflows.

`fromLegacyNumber` and `toLegacyNumber` are explicit minor-unit bridges requiring
safe integer numbers. They never rescale and throw outside the safe-number range.
The deprecated functions in `lib/money.ts` retain their v1 behavior (including
permissive parsing and floating-point limitations) until consumers are migrated
by MON-006/007/008. Do not use them in new work.

ESLint's `money/no-new-legacy` blocks new imports and increases in imported-binding
references using `scripts/legacy-money-baseline.json`. Existing allowances are a
ceiling for migration, not permission to add uses. Remove allowances as consumers
are migrated; do not regenerate/increase them to silence errors. The guard also
rejects literal dynamic imports, require calls and re-exports. It is a static
guard, not whole-program dataflow analysis; computed module paths and unchanged
reference counts still require code review.

## Wire foundation (MON-011)

`wire.ts` supplies explicit money/rate DTOs and Zod inputs. `moneyDto` returns
`amountMinor` as a signed int64 string plus currency; legacy mode additionally
returns a safe numeric `amount` without changing units. `moneyInputSchema`
requires at least one alias and exact agreement when both are present.
`legacyMoneyInput` explicitly rejects values outside safe-number compatibility.
Use these aliases only for minor-unit contracts, never decimal-major prices.
Rate DTOs retain int32-millionths `rate` in legacy mode and an exact `rateExact`
decimal with `quote_per_base` direction; exact mode omits the numeric alias.

`stringifyWire`, the shared REST helpers and `wrapTool` default to legacy numeric
JSON, safely serializing nested bigint within the safe-number range. Unsafe or
nonfinite values produce `WireCompatibilityError` / `LEGACY_NUMERIC_RANGE` (422).
Explicit exact mode serializes bigint as integer strings and rejects already
unsafe Numbers. No global BigInt prototype changes or magnitude-based fallback.

The currency FX REST/MCP slice now accepts `rateExact` aliases during lossless
int32-millionths coexistence; see [FX contracts](../../.agentic/registries/FX_WIRE_CONTRACTS.md)
for actual operations, units and unsupported ranges. Legacy conversion preview
is limited to matching currency scales and safe integer intermediate products.
Remaining endpoint/tool adoption remains MON-012 and its domain children.
Direct NextResponse calls, domain input schemas and raw SQL aggregates require
their own migration. The ORM still exposes safe numbers; full-range business
paths remain MON-007/008. Serializing a handler result cannot undo earlier writes;
validate requests and supported business range before mutations. See
[ADR-006](../../.agentic/docs/ADR-006-EXACT-WIRE-COMPATIBILITY.md) for adoption and
the proposed deprecation policy; no actual sunset date is agreed. Production
flags, schema and stored units remain unchanged.

Contact CRUD/list REST and MCP now accept/return nullable `creditLimitMinor`
strings alongside numeric cents/limits. Guarded support remains 0 through
9007199254740991 before writes. REST list balances add `*Minor` aliases with
exact SQL-text/bigint totals and fail unsupported/mixed-currency pages with 422.
See [contact contracts](../../.agentic/registries/CONTACT_WIRE_CONTRACTS.md);
full-range consumers and other contact/report/bulk envelopes remain future work.

Budget CRUD accepts signed `totalMinor`/`amountMinor` aliases alongside cents,
validates all amounts/dates/org references before transactional writes, and uses
bigint sums/distribution within the signed safe-number range. GET detail returns
both aliases; header envelopes are unchanged. Budget reports remain pending. See
[budget contracts](../../.agentic/registries/BUDGET_WIRE_CONTRACTS.md).

Public payment-link/portal JSON now returns additive monetary `*Minor` strings
while retaining safe numeric envelopes. Statements use bigint sums and reject
mixed currencies/unsafe totals; quote status/activity writes share a scoped
transaction with monetary preflight. Seven strict, org-scoped MCP tools expose
the same operations. See [public contracts](../../.agentic/registries/PUBLIC_PORTAL_WIRE_CONTRACTS.md).
Checkout, providers, backups, opaque payloads, public frontend/PDF display and
full-range business consumers retain their assigned tasks. IRR remains disabled.

Journal CRUD accepts `debitAmountMinor`/`creditAmountMinor` and saved `rateExact`
aliases without changing stored units. REST retains fixed-two-decimal strings;
MCP retains safe minor-unit numbers. Amount/sum/legacy FX-product ranges are guarded
before writes, and adopted reads select saved FX as SQL text. The new MCP
`delete_entry` matches scoped, locked, draft-only REST deletion. See
[journal contracts](../../.agentic/registries/JOURNAL_WIRE_CONTRACTS.md), including
the existing REST/MCP balance-policy difference.

Journal post/void/recode/scheduling and bulk imports share scoped direct-DB services.
Post/void REST responses include exact leg aliases and saved FX; reversal swaps
stored amounts without reconversion. MCP posting rechecks locks; recode validates
target ownership and retains money/rates. REST import decimal `12.50` and MCP
integer `1250` retain 1250 units; both accept exact minor-unit aliases. Each imported
header/legs is atomic, and MCP preview supplies exact totals. See
[lifecycle/import contracts](../../.agentic/registries/JOURNAL_LIFECYCLE_WIRE_CONTRACTS.md)
for ranges, formats, errors, partial-job semantics and remaining recurring/
scheduled/full-domain qualification.

## Recurring journal contracts (MON-037)

Recurring-journals REST and MCP share described canonical *AmountMinor aliases,
strict safe-number line/sum guards and atomic template/leg mutations. Retained
currency is not reset by partial edits. Templates have no configurable FX storage;
fixed rateExact "1" aliases declare the existing verbatim posting behavior.
Unsupported rates fail before mutation; no live rate is guessed. Generated legs
persist identity FX with explicit provenance. Tenant dimensions and current amounts
are revalidated under the template lock; catch-up journals and schedule commit
atomically per template. Concurrent runs of the same template do not duplicate
occurrences; locked dates retain the existing skip/consume policy.
See [recurring contracts](../../.agentic/registries/RECURRING_JOURNAL_WIRE_CONTRACTS.md)
for all operations, supported ranges, partial-run semantics and remaining domain gates.

## Invoice read contracts (MON-038)

Invoice list/detail REST and MCP preserve numeric stored minor units with additive
header/line/contact `*Minor` strings. REST payment allocations and guarded base
display add aliases too; display FX is explicitly issue-date lookup, not saved
posting FX. Invoice summary and the matching `get_invoice_summary` MCP tool use
SQL text and bigint sums in a read-only snapshot, rejecting mixed currencies and
unsafe totals/aging buckets. Nested foreign-tenant references fail before disclosure.
See [invoice read contracts](../../.agentic/registries/INVOICE_READ_WIRE_CONTRACTS.md)
for units, safe ranges, filters/errors and remaining write/lifecycle/full-domain gates.

## Bill read contracts (MON-046)

Bill list/detail REST and MCP share safe numeric stored minor units plus additive
header/line/contact `*Minor` strings. Detail base display declares issue-date lookup
FX with rateExact and matching-scale/product guards through the shared document
display adapter. Status counts select SQL sums/min/max as text; bigint guards
reject unsafe individuals/totals and mixed currencies within each status.
`get_bill` and `get_bill_counts` now expose the existing REST reads to MCP.
See [bill read contracts](../../.agentic/registries/BILL_READ_WIRE_CONTRACTS.md)
for units, ranges, errors and pending CRUD/lifecycle/procurement/settlement gates.

## Invoice CRUD write contracts (MON-039)

REST create/draft patch/delete and MCP create/update/delete share atomic direct-DB
services. Major prices retain `unitPrice`, adding decimal-major `unitPriceExact`
and integer-minor `unitPriceMinor`; aliases must agree. Bigint ratios preserve the
distinct create/edit rounding order, discount/tax ties and safe range without
floating products. Tenant references, old/new locks, pricing currency, credit
totals and response serialization are checked before mutation. Number/header/line/
create approval request roll back together. Numeric header/credit warning fields
add `*Minor` strings; full-int64 exact mode is unavailable during numeric coexistence.
See [invoice write contracts](../../.agentic/registries/INVOICE_WRITE_WIRE_CONTRACTS.md)
for defaults, units/ranges, concurrency/audit limits and remaining domain gates.

## Invoice lifecycle contracts (MON-040)

Send/void/bad-debt/interest/approval REST and MCP share scoped direct-DB services,
preserving numeric minor-unit money with `*Minor` strings. Interest override
`amount`/`amountExact` are decimal major units; recovery `amount` is integer minor
units. Both support `amountMinor`, with explicit alias agreement and safe numeric
range. Simple/daily compound interest and document-to-base scale conversion use
bigint ratios and one final rounding. Posting saves qualified FX; reversal mirrors
saved amounts and rates, and bad debt reuses recognition FX when linked. Header/
line/journal/stock/FIFO/warehouse/number/approval mutations commit atomically.
Send and interest require complete accounts; settled invoices cannot be voided.
See [invoice lifecycle contracts](../../.agentic/registries/INVOICE_LIFECYCLE_WIRE_CONTRACTS.md)
for all units, ranges, permissions, legacy stock/FX limitations, optional email
delivery semantics and remaining financial/settlement/provider qualification.

## Quote contracts (MON-041)

`lib/api/quote-wire.ts` and `quotes.ts` share REST/MCP quote operations. Numeric
REST prices remain decimal major units; MCP prices remain integer minor units.
Exact major/minor aliases agree explicitly; safe-number coexistence still limits
all prices, rounded products and sums. Quote/header/line/billing aliases never
rescale historic minor units. Bigint ratios implement price-first, discount and
exclusive tax rounding and deterministic final progress-billing residuals.
Organization/quote locks serialize atomic numbering, CRUD and conversion. See
`.agentic/registries/QUOTE_WIRE_CONTRACTS.md` for supported units, operations,
limits and intentionally separate public/PDF/provider/full-domain qualification.

## Receivable credit contracts (MON-042)

Credit-note REST prices remain decimal major units; MCP numeric prices are minor
units. `unitPriceExact` and `unitPriceMinor` agree explicitly, and extended-price
rounding retains the original credit policy. Customer-credit creation and both
credit application types accept numeric minor `amount` and canonical `amountMinor`.
All money/products/sums/FX outputs fit the safe integer coexistence range.
Header/line/contact/summary/available-credit envelopes add named `*Minor` strings.
Shared org-scoped atomic services guard state/references/locks and numbering;
credit-note application posts no second AR journal. Void preserves saved FX and
new stock-return costs. See [credit contracts](../../.agentic/registries/CREDIT_WIRE_CONTRACTS.md)
for all operations, amounts/units, errors, historical stock and carrying-FX limits.

## Sales receipt contracts (MON-043)

Receipt REST and MCP numeric unitPrice both retain decimal major units. Exact
unitPriceExact major strings and unitPriceMinor integer strings must agree;
bigint ratios retain extended-price, discount and exclusive-tax rounding. Header,
line, contact and bank money adds named *Minor strings without rescaling. The
safe integer ORM coexistence limit still applies to every price/product/sum/FX.
Shared scoped services atomically create/edit/delete drafts, post complete cash
revenue/tax/stock effects and void saved FX/COGS/cost history. Missing revenue
accounts and unqualified legacy inventory fail without committed effects.
See [receipt contracts](../../.agentic/registries/SALES_RECEIPT_WIRE_CONTRACTS.md)
for all seven REST/MCP operations, units, errors and qualification limits.

## Recurring invoice contracts (MON-044)

Recurring invoice REST and MCP accept numeric unitPrice in decimal major units,
unitPriceExact decimal-major strings and unitPriceMinor canonical minor strings.
Aliases agree before storage; stored prices and quantities round before exact
integer-ratio gross/discount/tax calculation. Responses add unitPriceMinor,
creditLimitMinor and preview lineTotalMinor while preserving numeric fields.
Shared scoped services serialize template edits and generation. Numbering,
documents, automated posting and catch-up advancement commit together; failed
posting leaves the schedule pending. Email delivery follows committed posting.
See [recurring invoice contracts](../../.agentic/registries/RECURRING_INVOICE_WIRE_CONTRACTS.md)
for all operations, currency/FX policies, ranges and remaining qualification limits.


## Bulk invoice contracts (MON-045)

Nested and grouped invoice imports retain decimal-major numeric prices, additive
exact major/minor aliases, USD omission default and extended-price rounding.
Bigint products/sums protect the safe-number coexistence range. Preview totals
add Minor strings; grouped jobs count documents. Shared direct-DB REST/MCP services
preflight malformed money before jobs and atomically commit each invoice/number.
Bulk send reuses exact lifecycle posting in one batch transaction; bulk mark-paid
remains a guarded status annotation without settlement. Reminder formatting uses
exact strings/bigint Intl parts. See [bulk invoice contracts](../../.agentic/registries/INVOICE_BULK_WIRE_CONTRACTS.md)
for all boundaries, error/partial-job/retry policies and MON-021 coordination.

## Bill CRUD contracts (MON-047)

Bill REST and MCP writes retain decimal-major numeric prices, additive exact
major/minor strings and extended-price rounding. Exact ratios and sums protect
the safe-number coexistence range; header responses add named *Minor aliases.
Both transports now preserve REST create's exclusion of reverse-charge VAT
from supplier amountDue on create/edit. Scoped services atomically commit
numbering, header/lines, procurement links and audit, with strict date locks,
draft state and saved-history validation. New update_bill/delete_bill tools
match REST CRUD. See [bill write contracts](../../.agentic/registries/BILL_WRITE_WIRE_CONTRACTS.md)
for inputs, aliases, supported ranges, duplicate/approval policy and remaining
lifecycle/settlement/full-int64/IRR qualification.

## Bill lifecycle contracts (MON-048)

Receive/approve/reject/void REST and MCP now share atomic scoped services, with
numeric header minor units plus *Minor aliases. Exact ratios preserve partial
and reverse-charge tax, document/base scales and posted stock rounding residuals.
Saved FX and stock values reverse verbatim; no current-cost valuation. GRNI clears
only remaining received quantities, avoids double receipts and reverses PO/receipt
and linked variance history. Approval workflow actions and audit commit together.
See [bill lifecycle contracts](../../.agentic/registries/BILL_LIFECYCLE_WIRE_CONTRACTS.md)
for supported ranges, legacy/FIFO/GRNI limits, permissions and settlement coordination.
Full-int64, foreign-currency receipt FX and actual settlement remain separate gates.

## Purchase order contracts (MON-049)

REST and MCP now share PO reads/counts, CRUD, send and bill conversion. Numeric
prices retain decimal major units; unitPriceExact and unitPriceMinor supply exact
aliases. Safe header/line money adds *Minor strings. Existing PATCH replacement
lines retain zero tax/discount calculation. Atomic numbering and procurement
allocations use exact saved net/tax values, preserve discounts/residuals after
partial void, and avoid GRN reuse or repeated recognition tallies. Converted bill
CRUD protects reservations; void releases them. See [purchase order contracts](../../.agentic/registries/PURCHASE_ORDER_WIRE_CONTRACTS.md)
for boundaries, compatibility changes and remaining qualification limits.

## Purchase requisition contracts (MON-050)

Shared REST/MCP requisition services use exact price ratios and bigint sums,
retaining decimal-major numeric input, additive exact major/minor aliases and
zero-tax extension semantics. Header/line money adds *Minor strings. Atomic
numbering, header/line/status/PO-link/audit writes validate supported safe bounds,
references, dates and history before committing. Conversion copies saved amounts
without recomputation; the UI draft submission now performs a real transition,
with distinct MCP edit/delete/submit operations. See [requisition contracts](../../.agentic/registries/PURCHASE_REQUISITION_WIRE_CONTRACTS.md)
for all boundary envelopes, units, ranges, compatibility corrections and limits.

## Bill bulk contracts (MON-053)

REST/MCP flat CSV preview/import share exact bigint-ratio price/quantity/override
math. Legacy numeric/CSV prices and amount overrides remain decimal major units;
named Exact/Minor aliases add canonical major/minor strings. Grouped headers and
safe prices/products/overrides/sums validate before jobs. Preview keeps line counts
and adds stored minor numeric amounts with *Minor strings. Each draft/number/
lines/create audit commits atomically; business failures remain partial jobs.
Repeat creates new drafts; no ledger/payment posting. See [bill bulk contracts](../../.agentic/registries/BILL_BULK_WIRE_CONTRACTS.md)
for formats, mixed count units, signed rounding and retry/race limits.

## Supplier debit-note contracts (MON-051)

REST/MCP CRUD, send, apply and void share atomic organization-scoped services.
REST numeric prices remain decimal major units; MCP numeric prices remain
integer minor units. Exact major/minor aliases preserve extension/tax/discount
rounding; header/line numeric minor amounts add *Minor strings. Linked recognition
uses saved bill FX; reversal swaps saved journal legs and restores qualified
complete average/FIFO stock returns and paired noncash allocations. Unsafe history,
unsupported partial/GRNI/tracked stock, specialized expense taxes and differing
carrying-FX settlement reject before commit. See [debit-note contracts](../../.agentic/registries/DEBIT_NOTE_WIRE_CONTRACTS.md)
for envelopes, ranges, legacy history and MON-021 coordination. Full-range,
production migration, independent financial/security and IRR gates remain separate.

## Expense CRUD contracts (MON-060)

Expense list/detail/counts/create/edit/delete REST and six strict MCP tools share
scoped DB services. REST numeric amounts retain decimal major units; MCP implements
its documented integer minor input, correcting the former double conversion.
amountExact/amountMinor agree explicitly; bigint ratios and sums guard safe numeric
coexistence. Header/item/mileage results add *Minor aliases, and status sums reject
mixed currencies/unsafe values. Atomic header/lines/audit writes validate dates,
roles and organization-owned references. Existing line IDs retain omitted metadata;
the edit form submits exact major strings, and summary cards use exact fractions
and explicit currencies. See [expense CRUD contracts](../../.agentic/registries/EXPENSE_CRUD_WIRE_CONTRACTS.md)
for boundary units, compatibility corrections, limits and remaining lifecycle/
generic create-drawer/locale/provider/full-range/financial qualification. Stored
history, schema and production IRR enablement are unchanged.


## Expense lifecycle contracts (MON-061)

Six expense lifecycle REST/MCP operations now share atomic scoped services with
CRUD locks/validators. Header numeric totalAmount adds totalAmountMinor without
rescaling. Approval posts exact inclusive/recoverable/reverse-charge tax and
saved historical FX; reimbursement clears the actual saved payable carrying
value and books realised FX separately. Reversal mirrors complete saved money,
FX and dimensions on original open dates. Posting audit records qualify base
currency/history; missing or ambiguous legacy history rejects rather than guesses.
See [expense lifecycle contracts](../../.agentic/registries/EXPENSE_LIFECYCLE_WIRE_CONTRACTS.md)
for units, ranges, correction/compatibility policy, concurrency and qualification
limits. Full-int64, historical remediation, compound tax and combined MON-021/
independent financial/provider/production/IRR gates remain separate.

## Bank account contracts

MON-062 adopts bank account CRUD, statement balance diagnostics and low-balance
settings in REST and MCP. Signed numeric minor-unit balances/thresholds coexist
with canonical exact aliases within +/-9007199254740991. SQL text and bigint
diagnostics avoid int32 casts and lossy differences. Bank/GL-link/audit writes
commit atomically; statement/payment/opening GL history prevents currency or GL
link changes. Opening GL remains a separate workflow. Scheduled messages format
full stored int64 with exact saved currency scales. See
[the boundary registry](../../.agentic/registries/BANK_ACCOUNT_WIRE_CONTRACTS.md).

## Bank transaction reads (MON-063)

Six REST GET operations and MCP tools share scoped read-only snapshots for
transactions, activity, account/match suggestions, import metadata and duplicate
diagnostics. Numeric money retains signed currency minor units with matching
*Minor aliases in the safe coexistence range. Nested references, opaque payload
serialization and currency units are guarded. Journal candidates sum complete
base-currency bank legs exactly; fuzzy amount thresholds use bigint ratios.
See [read contracts](../../.agentic/registries/BANK_TRANSACTION_READ_WIRE_CONTRACTS.md)
for envelopes, limits and the separate banking writer/qualification tasks.

## Bank import contracts (MON-064)

Statement and mapped bulk REST/MCP imports share scoped atomic services. Decimal
major text uses the bank scale; BAI2 uses integer minor units. Canonical
amountExact/amountMinor and CSV balanceMinor aliases agree before writes; numeric
statement money adds Minor strings. Bulk preview's existing amount stays in major
units. Bigint sums/running balances and safe-range guards prevent precision loss.
Duplicate checks include within-file/concurrent retries; invalid batches and DB
faults roll back rows/history/job/balance/audit. New scoped parser-profile tools
operate the existing table. Rules supply suggestions without phantom reconciliation.
See [bank import contracts](../../.agentic/registries/BANK_IMPORT_WIRE_CONTRACTS.md)
for parser limits, compatibility corrections and retry/qualification boundaries.

## Bank document matching (MON-066)

Invoice/bill/split/existing-payment/journal REST and MCP matching share atomic
scoped DB services and the exact settlement engine. Positive numeric minor-unit
inputs add amountMinor; results retain numeric money and add exact aliases.
Full statement coverage, currency/direction, outstanding payable and saved
carrying/cash FX are checked; noncash credit/debit/prepayment carriers stay separate.
Existing cash links reuse qualified saved history without a new posting or rate
lookup. Direct journal links support base-currency identity FX. Numbering, posting,
document changes, bank/payment links and audits commit together. See
[matching contracts](../../.agentic/registries/BANK_DOCUMENT_MATCH_WIRE_CONTRACTS.md)
for all boundaries, compatible envelopes, explicit partial/mixed-contact limits,
safe numeric ranges, retry policy and remaining banking/financial gates.

## Bank transfer contracts (MON-067)

Standalone and statement transfer REST/MCP operations share an atomic scoped
service. REST numeric amount remains decimal major units; MCP remains integer
currency minor units. Both add decimal amountExact / integer amountMinor aliases
with exact agreement and currency-scale rounding. One historical exact-FX
journal and two equal opposite linked movements commit with GL self-linking and
audit. Organization locks serialize adopted writers; repeated source/counter
matches reject, while standalone requests intentionally create new transfers.
Statement snapshots/running balances are preserved. See
[transfer contracts](../../.agentic/registries/BANK_TRANSFER_WIRE_CONTRACTS.md)
for every boundary, safe ranges, unsupported currencies/FX/history, retry policy
and the MON-068 undo/session handoff. No schema or IRR gate change.

## Bank reconciliation contracts (MON-068)

Session/list/proof/complete/adjustment/reconcile/unreconcile/exclude REST and MCP
share atomic scoped services. Signed integer bank minor inputs/outputs add named
Minor aliases; text SQL sums and bigint arithmetic protect safe numeric bounds.
Foreign statement/base GL units stay explicit, without unlike-unit subtraction.
Existing journals/payments detach; bank-created category/cash/expense/transfer
postings get saved-FX reversals, preserving dimensions and allocation history.
Affected completed sessions reopen and only proven synthetic movements delete.
See [reconciliation contracts](../../.agentic/registries/BANK_RECONCILIATION_WIRE_CONTRACTS.md)
for all envelopes, units, safe ranges, compatibility corrections, retry policy,
base-currency completion/adjustment limits and remaining MON-021/069 gates.

## Tax rate/profile contracts (MON-071)

Tax rates, compound components, recovery shares, country profiles and cached
jurisdiction rates use bounded numeric basis points, never money/FX strings.
Legacy and exact consumers share these lossless int32 fields; unknown aliases
reject. Scoped org-locked direct DB services atomically preserve defaults,
component replacements, idempotent profile batches/NULL-key upserts and audits.
See [tax configuration contracts](../../.agentic/registries/TAX_RATE_PROFILE_WIRE_CONTRACTS.md)
for all operation envelopes/ranges, authorization, compatible corrections and
separate filing/report/historical-data gates. No rate-policy or currency change.

## Inventory catalog wire adoption (MON-074)

Variants and supplier links accept existing integer cents prices and additive
purchasePriceMinor/salePriceMinor canonical strings, with exact agreement and
safe Number bounds. Null historical prices retain null aliases; invalid stored
money rejects before patching. Physical variant whole units and supplier days
remain int32. REST/MCP share tenant-scoped transactional services and atomic audit.
Editors parse and display exact cents. See
[inventory catalog contracts](../../.agentic/registries/INVENTORY_CATALOG_WIRE_CONTRACTS.md).
Other inventory/valuation workflows and production/full-range qualification remain
with MON-024 and its remaining children.

## Inventory master/import wire adoption (MON-075)

Item master cents prices and book costs retain safe numeric fields and add exact
Minor strings. Opening products and bulk FIFO/average costs use exact preflight;
valuation unit-cost ratios round with bigint. CSV legacy purchase/sale columns
remain two-decimal major units, exact Minor columns remain cents, physical units
remain whole int32. Scoped atomic services share REST and sixteen MCP tools;
new CSV rows post opening ledger within their own valuation/audit transaction.
Local master CSV export uses exact decimals; generic exports remain MON-033.
See [inventory master contracts](../../.agentic/registries/INVENTORY_MASTER_WIRE_CONTRACTS.md).
No schema, historical rescale, full-int64 or production IRR change.

## Inventory movement/warehouse wire adoption (MON-076)

Shared REST/MCP adjustment, warehouse, transfer, stock-take and serial/lot metadata
services keep cents money aliases exact and whole physical units unscaled. Every
adopted writer is tenant-scoped and audits atomically; stock/value changes enforce
period/account/range checks. Warehouse counts compare location stock, every
counted line rechecks live stock, and completion cannot repost transfers/takes.
Exact carrying-value residuals and bigint cost ratios avoid rounded over-issues.
Value-only FIFO/standard adjustments reject pending layer qualification. See
[inventory movement contracts](../../.agentic/registries/INVENTORY_MOVEMENT_WIRE_CONTRACTS.md)
for REST target versus MCP delta semantics, offsets, envelopes, ranges and
metadata-only serial/lot behavior. General tracked workflows/valuation/assembly,
full-int64 and production IRR remain separate inventory/qualification gates.

## Payroll configuration contracts (MON-080)

Settings/deduction/tax-election/bracket/allowance REST and 23 MCP tools share
scoped atomic services. Nonnegative safe integer cents add matching Minor strings;
annual thresholds and per-period amounts stay explicit. Basis points, decimal
binary32 percent/hours and int32 counts retain their units. Invalid references,
unsafe history and output/audit faults reject or roll back. Scoped lazy defaults
and allowance uniqueness serialize; deleted tax configurations stay out of the
existing withholding loader. Editors use actual fields and exact cents. See
[configuration contracts](../../.agentic/registries/PAYROLL_CONFIG_WIRE_CONTRACTS.md)
for envelopes, all fields/ranges, strict-input compatibility corrections and
remaining run/jurisdiction/full-range/IRR qualification.

## Payroll time and leave contracts (MON-081)

32 REST/MCP operation pairs share scoped atomic services. Hours and premium
percentages stay numeric physical quantities, with no money aliases/coercion.
Binary32 inputs and bigint-scaled physical sums must persist unchanged; unsupported
rounding/history rejects before commit. Nested employee/project cents gain safe
Minor strings; project minutes remain minutes. Draft-only entry edits, correct
entry paths, scoped membership and once-only year-specific leave balance deduction
are enforced. See [time contracts](../../.agentic/registries/PAYROLL_TIME_WIRE_CONTRACTS.md).
Run/accrual calculations, financial outputs and production IRR remain separate.


## Payroll output contracts (MON-085)

Reports, CSV, payslips, tax-form JSON and self-service share scoped REST/MCP services. Existing safe numeric cents add canonical Minor strings; bigint aggregates/averages preserve exact values. Saved item/run/form currencies remain explicit, mixed single-total currencies fail, and YTD includes only the same Gregorian year's completed live runs. Generation/view/profile changes and audit commit atomically; concurrent payslip retries fill only missing snapshots. Tax forms use saved withholding/deduction data and USD payment thresholds, with saved paymentDate preferred over legacy UTC paidAt. CSV and dashboards preserve the legacy fixed-cents display contract exactly. The existing /pdf endpoint remains JSON; general PDF/locale/scale and full-range financial qualification stay separate. See [output contracts](../../.agentic/registries/PAYROLL_OUTPUT_WIRE_CONTRACTS.md) for every boundary, limitation and compatibility correction.

MON-086 asset/category masters retain their existing fixed integer-cents contract and add canonical Minor strings alongside safe numeric fields. `lib/api/asset-master-wire.ts` validates explicit aliases and supported ranges; `lib/money/asset-display.ts` parses/displays fixed two-decimal cents exactly and supports bigint loaded-row aggregate presentation. Asset tables have no saved currency/FX tag; this is no currency/history conversion or lifecycle calculation qualification. See `.agentic/registries/ASSET_MASTER_WIRE_CONTRACTS.md`.

MON-087 depreciation retains numeric cents alongside explicit Minor strings and computes methods/conventions with bigint rational intermediates. Three REST/MCP pairs share scoped atomic services, monthly retry protection, period checks and original-line linked reversals. Full-at-purchase expenses the base and final timing periods clear residuals exactly. Revalued/inconsistent assets fail closed until carrying-base policy is adopted; fixed cents do not imply saved currency/FX or full-int64 support. See [depreciation contracts](../../.agentic/registries/ASSET_DEPRECIATION_WIRE_CONTRACTS.md) for input/outputs, supported ranges, zero-charge and retry limitations.

MON-088 valuation/disposal shares direct scoped REST/MCP transactions, safe numeric cents with explicit Minor aliases, bigint signed equity/P&L splits and valuation-adjusted carrying/gross disposal math. Accounts/history/dates/currencies, periods and retry keys are validated under lifecycle locks; audit/output faults roll back all writes. Dashboard value/proceeds text parses exactly. Legacy inconsistent positive MCP impairment history fails closed without rewriting it; post-valuation depreciation schedules remain unsupported pending parent integration. See [valuation contracts](../../.agentic/registries/ASSET_VALUATION_WIRE_CONTRACTS.md).


MON-089 CWIP services retain safe numeric cents with amountMinor/totalMinor/capitalizedCostMinor aliases, exact bigint sums, scoped identity-rate postings and atomic audit/output checks. Capitalization preserves recorded opening basis plus tracked costs; nonzero balances cannot redirect the saved CWIP account. Three REST/MCP operations share period/lifecycle/retry safeguards. Missing/corrupt cost journals fail closed; opening funding remains an explicit precondition. See [CWIP contracts](../../.agentic/registries/ASSET_CWIP_WIRE_CONTRACTS.md).

MON-090 loan services preserve REST decimal-major versus MCP integer-cents principal inputs with exact aliases. Rational bigint PMT/interest and final residuals, safe aggregate bounds, UTC month-overflow dates and scoped atomic GL/audit transactions qualify six REST/MCP operations. Targeted/keyed retries prevent duplicate payments; dashboard cents input/display/sums are exact. Loan tables have no saved currency; two-decimal base/account/history checks fail unsupported states without rewriting them. See [loan contracts](../../.agentic/registries/LOAN_WIRE_CONTRACTS.md) for envelopes, limits and the separate historical/integrated financial gates.

MON-092 CRM services preserve numeric fixed cents with additive valueCentsMinor strings, exact bigint totals/averages and currency-filtered scalar summaries. Sixteen REST/MCP pairs share scoped contact/public-member joins and atomic organization-locked audit/output transactions. Probability retains integer percent; same-state won/lost retries preserve timestamps. Editors/display/weighted values use exact cents. See [CRM contracts](../../.agentic/registries/CRM_WIRE_CONTRACTS.md) for envelopes, strict inputs, safe ranges, mixed-currency errors and historical/integrated qualification limits. No schema or IRR gate change.


MON-093 project masters/time/member/milestone/task metadata share 48 scoped REST/MCP operations. Nonnegative safe numeric fixed cents coexist with canonical Minor strings; minutes/seconds/progress retain their units. Organization/project locks and exact summed minutes protect atomic totals, audit and output validation. Editors parse exact cents and hours, with bigint time products/display. See [project master contracts](../../.agentic/registries/PROJECT_MASTER_WIRE_CONTRACTS.md) for envelopes, reference guards, retries, legacy corrections and the separate MON-094 billing and parent financial/IRR qualification. No schema or historical conversion.


MON-094 project billing/profitability retains safe numeric fixed cents and adds explicit Minor aliases. Shared direct DB REST/MCP services compute exact bigint markup/time/fixed percent products, sums and signed variances, enforce same saved currency and identity journal rates, and atomically allocate sources with numbering, audit and returned-money checks. Stable project IDs prevent name-based fixed allocation collisions; keyed retry and remaining-price guards prevent duplicate/over billing. Progress preview uses exact totals and decimal percent input. See [project billing contracts](../../.agentic/registries/PROJECT_BILLING_WIRE_CONTRACTS.md) for seven pairs, the singular adapter, units, errors, history restrictions and pending integrated/full-range/IRR qualification.


MON-027 qualifies the combined pricing/CRM/project master/billing slice. Cross-transport fixtures cover saved rates, immutable allocations, historical invoice prices, currency-filtered summaries, rollback and writer races. Fixed-price master edits now reject prices below the attributed invoiced fixed amount, excluding recharged costs. See [combined contracts](../../.agentic/registries/PROJECT_CRM_PRICING_INTEGRATION.md) for all 81 operation pairs and retained safe fixed-cents limits. Full-int64, FX, historical repair and independent production qualification remain separate.
