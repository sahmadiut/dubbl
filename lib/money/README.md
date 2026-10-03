# Exact money core

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
