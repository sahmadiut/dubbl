# Expense CRUD wire contracts - MON-060

2026-10-04, Asia/Tehran. Shared `lib/api/expense-wire.ts` / `expense-crud.ts`,
REST handlers and `lib/mcp/tools/expense-crud.ts`. ADR-006 additive aliases;
safe-number coexistence, no exact-only negotiation or approved numeric sunset.
MON-021 retains combined expense/payment/banking acceptance.

## Operations and envelopes

| REST | Registered MCP | Input | Output |
|---|---|---|---|
| GET `/api/v1/expenses` | `list_expense_claims` | Optional status/page/limit | REST `{data,pagination:{page,limit,total,totalPages}}`; MCP `{expenseClaims,total}` |
| GET `/api/v1/expenses/:id` | `get_expense_claim` | Live scoped claim UUID; MCP `expenseClaimId` | `{expenseClaim}` with items/accounts and public user profiles |
| GET `/api/v1/expenses/counts` | `get_expense_claim_counts` | None | `{counts,total}`; status buckets `{count,amount,amountMinor,currencyCode}` |
| POST `/api/v1/expenses` | `create_expense_claim` | title, optional description/currencyCode, 1..1000 items | REST 201/MCP result `{expenseClaim}` header, no items |
| PATCH `/api/v1/expenses/:id` | `update_expense_claim` | Optional title/description/complete replacement items | `{expenseClaim}` header, retained currency |
| DELETE `/api/v1/expenses/:id` | `delete_expense_claim` | Scoped claim UUID | `{success:true}` |

All reads retain authenticated-member access; writes require `manage:expenses`,
honoring custom permission arrays. API-key organization overrides request header;
MCP uses the server AuthContext and direct DB, no HTTP self-call. Invalid/expired
keys fail 401, denied writes 403, missing/deleted/foreign claim IDs 404.
Schemas are strict, described and operation-specific; unknown body/tool fields
fail 400/MCP validation. Contact/project/header money/status/user/journal inputs
are not supported: these entities have no contact/project columns. Their routes
are not silently repurposed to add dimensions. Cost-center storage does exist
and now has a validated input. Receipt signing/upload, OCR, recurring templates,
analytics, submit/recall/approve/reject/pay/reverse remain other slices.

## Inputs, units and exact agreement

| Field | Contract and range |
|---|---|
| REST item `amount` | Optional nonnegative decimal major-unit Number, USD 12.50; numeric shortest decimal spelling interpreted by exact ratios, including exponents |
| MCP item `amount` | Optional safe nonnegative integer minor-unit Number, USD 1250 cents = $12.50 |
| Both `amountExact` | Optional ASCII nonnegative decimal major string, up to 20 whole/18 fractional digits and 40 characters; no exponent/localized digits/leading plus/leading whole zeros |
| Both `amountMinor` | Optional canonical nonnegative integer minor string; signed-int64 syntax schema, supported workflow 0..9007199254740991 |
| `mileageRate` / `mileageRateMinor` | Optional nullable safe integer minor units per mile / canonical exact string; simultaneous aliases agree, null clears |
| `distanceMiles` | Optional nullable nonnegative int32 hundredths of miles, 0..2147483647; no monetary alias |
| Dates | Real Gregorian date-only YYYY-MM-DD, preserved verbatim |
| Account/tax/cost-center IDs | Optional nullable organization-owned UUIDs; null clears |
| Receipt fields | Optional nullable key/file-name strings; nonempty key must match an owned uploaded attachment under the organization's UUID prefix |

Every line requires amount, amountExact or amountMinor. REST major numeric/exact
aliases must describe the same rational amount before rounding. Rounded major
amount must equal amountMinor; MCP numeric minor amount must agree with all exact
aliases. Nonnegative major rounding is nearest, ties upward, once at the currency
scale using bigint ratios. Each amount and the bigint sum must fit safe integers.
Zero lines/totals are valid drafts. TotalAmount is computed, never client-set.
TaxRateId is metadata on a supplied tax-inclusive amount; CRUD calculates neither
input-tax splits nor FX/GL. Mileage amount is explicitly supplied; distance times
rate is not recomputed or required to equal amount. Mileage flag requires distance
and rate; when false, stored distance/rate are cleared after validating inputs.

Title/item description are nonempty, max 10000 characters; other free-text fields
max 10000. Currency is an ISO code normalized at input, defaulting to the locked
organization default (no contact fallback). Updates cannot change currency.
Existing USD 1250 stays 1250; JPY/IRR 1250 stays 1250; KWD 1250 stays 1250.
No magnitude-based or retrospective MCP/IRR rescaling is performed.

Intentional MCP defect correction: the former tool described integer cents but
called decimalToMinorUnits, multiplying USD 1250 into 125000. The adopted tool now
implements its documented minor-unit contract and rejects fractional numeric MCP
amounts. Clients that compensated for that bug must use the documented numeric
minor value or amountMinor going forward. Previously saved claims remain unchanged;
repair needs provenance and separate qualification, never a guessed division.

## Read money, references and aggregates

Header `totalAmount` adds `totalAmountMinor`; detail item `amount` and nullable
`mileageRate` add `amountMinor` and nullable `mileageRateMinor`. Numeric result
money remains stored integer minor units in both transports. Units never change
between list/detail/write/count envelopes. IDs, mileage distance, sort order,
counts and dates retain their own units. No bigint reaches ordinary JSON.
User profiles include only id/name/email/image; authentication fields, password
hashes and session metadata formerly included by unrestricted relations are removed.
Submitter/approver must have current membership in the claim organization. Removed
members or foreign users are unsupported history requiring provenance review.

Lists/detail use read-only repeatable-read transactions. Every returned header and
saved line/mileage amount is safe and nonnegative; line sum must equal total and
at least one line must exist. Foreign/missing account/tax/cost-center/receipt/user/
journal references reject before disclosure. Inactive/deleted owned account/tax/
cost-center history remains readable, but is not permitted for edits. Writable
accounts must be expense type, tax must apply to purchases, and tax rate/recovery
metadata must be valid nonnegative int32 basis points / 0..10000 recovery points.
No nested contact/project money exists on the actual expense schema.

Status counts use SQL text sum/min/max and bigint range checks, grouping by status.
One currency is required within each status, with currencyCode added to the bucket.
Different statuses may have different currencies; `total` sums document counts,
never money. Unsafe individual/sum or negative totals and mixed-currency buckets
fail 422. Empty org returns `{counts:{},total:0}`; absent statuses are omitted.
Counts guard headers, not hidden line integrity; list/detail guard saved lines.

Status values are draft/submitted/approved/rejected/paid. MCP page 1..21474836,
limit 1..100, defaults 1/50. REST retains parseInt/clamp pagination, then validates;
bad NaN or excessive pages fail 400. Empty status is omitted, unknown nonempty
status fails 400; unrelated query parameters are ignored. List order is createdAt
descending then UUID descending. Validation/invalid JSON is 400, incompatible
money/history/aggregate is 422 (`LEGACY_NUMERIC_RANGE`), closed dates 422, state/
reference eligibility violations 400; SQL faults 500. MCP wrapTool returns matching
classified errors; SDK schema rejection may occur before the handler.

## Atomic edits, locks, audit and limits

Adopted writers lock organization then claim and re-read current state. Only
unposted draft/rejected claims may edit/delete; any journal link blocks mutation.
Creation checks new dates; edit checks all saved and replacement dates, even for
title-only changes; delete checks all saved dates. The existing two-tier permission
and closed-fiscal-year policy applies. Header, line insertion/replacement/deletion,
soft delete and mandatory audit commit or roll back together. Audit includes exact
header and line snapshots. Injected final audit and line-insert faults prove rollback.

Items are completely replaced. Optional update item `id` must belong to this claim
and be unique in the request; it carries omitted metadata from that saved line.
Required date/description/amount are replaced. Explicit nullable metadata clears;
no ID makes a new line with defaults. Replacement regenerates line UUIDs; clients
must reread before a subsequent replacement. Current editor now sends IDs and saved
accountIds, preserving tax/mileage/cost-center/receipt metadata it does not edit.
Editor prefill and totals use exact currency scales, and submit sends amountExact
without parseFloat. Summary cards format exact fractional minor units, sum bigint
only for one currency and display "Multiple currencies" across differing status
currencies. Read/count failures are visible instead of showing a false empty state.
No positional identity guessing. No items means header-only edit. Delete removes
lines and soft-deletes header, without posting or reversing money.

Concurrent adopted edit/delete serialize; repeated delete is 404. Repeated create
creates another draft: there is no new public idempotency key. Legacy lifecycle,
bank-created expenses, generic restore/merge/reference/lock writers do not acquire
these locks and remain MON-061/021/other qualification. CRUD concurrency tests do
not claim approval/payment concurrency or accounting qualification. Full-int64,
tax/FX posting, historical MCP remediation, browser/locale/PDF, receipt provider,
OAuth/session, performance, independent financial/security/migration/release and
functional IRR gates remain assigned work. No schema/migration/flag/deployment change.
The generic create drawer's legacy mileage calculation and display, broader list/
detail locale formatting and receipt signing remain their existing separate
money-consumer/locale/provider qualification; CRUD does not claim those are exact.
