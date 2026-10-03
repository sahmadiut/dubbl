# Quote wire contracts (MON-041)

2026-10-03, Asia/Tehran. Implemented by shared direct-DB `lib/api/quotes.ts`,
described schemas/DTO/arithmetic in `quote-wire.ts`, REST routes and existing
registered `lib/mcp/tools/quotes.ts`. Self-review, safe-number coexistence, no
production/IRR/financial sign-off. No public representation switch is introduced.

## Complete adopted boundary inventory

| REST | Registered MCP | Inputs / returned envelope |
|---|---|---|
| GET /quotes | list_quotes | Optional status, page, limit; REST data/pagination, MCP quotes/total; contact + header aliases |
| GET /quotes/:id | get_quote | UUID / quoteId; quote with contact and lines/account/taxRate |
| POST /quotes | create_quote | Customer, issue/expiry dates, optional reference/notes/currency/list, 1..1000 lines; quote (REST 201) |
| PATCH /quotes/:id | update_quote | UUID plus optional permitted contact/date/reference/notes/currency/lines; quote |
| DELETE /quotes/:id | delete_quote | UUID; success true; draft only, header soft-delete and physical line removal |
| POST /quotes/:id/send | send_quote | UUID; REST optional validated email options, MCP status only; quote with sentAt |
| POST /quotes/:id/accept | accept_quote | UUID; sent and unexpired through current UTC day; quote |
| POST /quotes/:id/decline | decline_quote | UUID; sent only; quote |
| POST /quotes/:id/convert | convert_quote_to_invoice | UUID, optional percentage/milestone lines; quote/invoice/billing |

All writes require manage:invoices. Reads retain existing authenticated access.
AuthContext selects tenant; an API-key tenant overrides a conflicting header.
IDs and dates validate before queries/writes. Historical nested contact/account/
tax references cannot expose another tenant. List and count use a repeatable-read
read-only snapshot. Unknown status/pagination fails instead of reaching SQL enum/
offset errors. REST keeps existing pagination normalization, max 100/default 50;
MCP page 1..21474836, limit 1..100/default 50. Invalid schemas return 400; missing
and cross-tenant documents return 404; denied permission 403; unsafe numeric
coexistence 422 LEGACY_NUMERIC_RANGE. State/expiry/overbilling returns 400.

## Prices, quantities, currency and ranges

- Numeric REST unitPrice is decimal currency major units; numeric MCP unitPrice
  is a safe integer currency minor unit. Do not substitute one for the other.
- Both transports accept unitPriceExact: signed ASCII decimal major string,
  max 20 whole and 18 fractional digits (40 chars); no whitespace/exponent/
  localized digits. REST numeric/exact major aliases must agree rationally.
- unitPriceMinor is a canonical signed int64 integer string (no leading zeros,
  negative zero, exponents or decimal). All aliases must agree with the rounded
  major price, including MCP numeric minor. Full int64 business paths remain
  MON-007/008; larger-than-safe aliases reject before numbering or writes.
- USD, IRR, JPY and KWD retain exactly the same supplied minor integer; metadata
  affects only explicit major-to-minor conversion. Currency defaults USD in both
  transports. PATCH currency edits relabel retained units without rescaling,
  preserving historical API behavior; replace lines to supply a new valuation.
- All stored prices, rounded gross/discount/net/tax/header totals and billed/
  remaining sums must be within +/-9007199254740991. Intermediate bigint ratios
  can exceed this; rounded results are guarded before Number/ORM conversion.
- Input quantity is physical decimal units, default 1, bounded to signed int32
  hundredths (-21474836.48..21474836.47 physical). Stored/output quantity is an
  integer hundredths. Discount is integer 0..10000 basis points, default 0;
  taxRateId resolves org-owned int32 nonnegative basis points. Neither is money.
- Price-first rounding, quantity extension, basis-point discount then exclusive
  tax preserve original REST and MCP rules. Each monetary rounding uses integer
  ratios with signed ties toward positive infinity. Tax/subtotals use bigint sums.
- Creation resolves omitted inventory prices using per-line/document list tiers
  (quantity default-for-lookup remains quantity || 1), active/effective windows,
  then item sale price, else zero. Explicit aliases win. Lists must match quote
  currency; item fallback requires org base currency, no implicit FX. Scoped
  contact/accounts/taxes/centers/items/lists are share-locked through commit.
  Item and list IDs are lookup-only; quote_line persists only supported fields.
- New optional costCenterId persists and converts faithfully. No inventory,
  project or warehouse persistence is invented. PATCH replacement uses explicit
  prices/omitted-zero, no lookup. Header-only update retains existing lines/totals.

## Outputs and write guards

Header fields subtotal/taxTotal/total/billedTotal retain numeric minor units and
gain *Minor strings. Detail line unitPrice/amount/taxAmount gain *Minor; related
contact creditLimit gains nullable creditLimitMinor. Conversion invoice includes
subtotalMinor/taxTotalMinor/totalMinor/amountPaidMinor/amountDueMinor; billing
invoiced/billedTotal/remaining gain *Minor and fullyBilled is boolean. Counts,
physical quantities, basis points, IDs and dates retain their types/units. The
shared serializer rejects unsafe values, without bigint.prototype changes,
magnitude-driven type changes or silent float repair.

CRUD/lifecycle/conversion load and preflight saved header, lines, balance sums,
currency/date and retained reference ownership before mutations. Retained inactive
references are allowed; newly supplied unavailable/foreign references fail.
Draft PATCH accepts only contactId, issueDate, expiryDate, reference, notes,
currencyCode and lines. Arbitrary DB patches (tenant, ID, status, creator,
convertedInvoiceId, raw totals) now fail explicitly; no mass assignment. This
deliberately removes unsafe undocumented behavior, not the supported header API.
Old/new issue-date period locks are strict; conversion checks current UTC invoice
date too. No custom lock override is newly granted.

Organization then quote locks serialize adopted services. Numbering (QTE/INV,
int32 sequence ceiling), header/lines, delete and quote billed/status/latest
invoice pointer commit atomically. Conversion uses existing contact/org terms,
zero terms retains 30-day fallback, reference/notes/currency and supported line
dimensions copy. Draft invoices do not post stock/ledger or invent FX snapshots.
Audit is awaited after successful commit with the existing best-effort policy.

## Progress billing and intentional rounding repairs

Accepted only. Nonempty milestone lines take precedence over percentage; empty
lines preserve default behavior. Duplicate or foreign quoteLineId and quantities
rounding to zero fail. Milestones first round physical quantity to hundredths,
then gross, discount and proportional original effective tax. Percentage >0..100
bills that share of original total, independently rounding each original amount,
tax and quantity as before; overbilling after line rounding fails. Default first
conversion copies values; subsequent omitted percentage/lines use exact remaining
over original total with cumulative deterministic amount/tax residual allocation
in stable sortOrder/UUID order. Output subtotal + tax always equals the precise
remaining total. Final status is converted only when remaining is zero: the old
one-minor-unit forgiveness and proportional remainder loss/overbilling are fixed.
Repeated full conversion rejects; valid repeated partial calls intentionally
produce another bill subject to the remaining cap, not request deduplication.
REST overbilling keeps remaining/requested numeric fields, adds matching strings.
Malformed nonempty conversion JSON is 400, never an accidental full conversion.

## Email and separate qualification gates

REST empty send body records sent; explicit sendEmail true validates recipient,
subject/template before status, token or email writes. Optional provider email
follows committed send state, matching invoice lifecycle policy; failures do not
undo status, and retry uses the document-email workflow. Existing attachPdf false
behavior is preserved. MCP send records status only. Email template/display,
providers/PDFs and public portal acceptance retain MON-016/030/031/034 ownership.
Those writers do not yet share these locks and concurrent external writers,
period-lock/config changes, HTTP/session/OAuth, UI and financial qualification
remain MON-007/QA/release gates. Existing conversion does not enforce invoice
create plan/credit/approval policies; those broader workflow decisions are not
silently added here. Rollout flags and schema remain unchanged.

## Executable evidence

`tests/quote-wire.test.ts` verifies units/aliases/rounding/ranges/residuals and read
scoping. `tests/integration/quotes.test.ts` invokes actual authenticated handlers
and all nine registered SDK MCP tools against disposable migrated PostgreSQL:
legacy/exact/dual clients, four currency scales, scoped pricing/relations, custom
permissions, two tenants, state/date/lock guards, safe-max/unsafe saved amounts,
complete rejection snapshots, exact progress residuals, concurrent operations
and injected create/edit/delete/conversion rollback. See MON-041 evidence for
actual command outcomes and limitations.
