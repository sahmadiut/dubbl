# Asset CWIP wire contracts (MON-089)

2026-10-06, Asia/Tehran. Verified against source and disposable PostgreSQL
REST/API-key handlers and MCP SDK transports. Bounded implementing-assistant
self-review; no independent accounting, production or IRR approval.

## Operations and authorization

Paths are relative to `/api/v1/fixed-assets/:id`. All three operations require
`manage:assets`, a valid UUID and a live asset in the authenticated organization.
API-key organization wins over a conflicting organization header. MCP registers
one tool per operation, uses AuthContext, wrapTool and direct shared Drizzle
services in `lib/api/asset-cwip.ts`; no HTTP self-calls.

| REST | MCP | Result, retaining existing envelopes |
|---|---|---|
| GET cwip-cost | list_cwip_costs (added parity) | `{costs,total,totalMinor}`; costs newest date/createdAt/id first, each includes scoped journalEntry |
| POST cwip-cost | add_cwip_cost (added parity) | `{cost,asset,journalEntryId}` |
| POST capitalize | capitalize_cwip_asset (existing name) | `{asset,capitalizedCost,capitalizedCostMinor,journalEntryId}` |

No representation header or magnitude negotiation. Existing numeric cents remain
Numbers; explicit Minor aliases add canonical decimal strings. Root asset fields
use MON-086 aliases. Cost `amount`/`amountMinor`, list `total`/`totalMinor` and
capitalization `capitalizedCost`/`capitalizedCostMinor` preserve identical units.
Nested journal headers contain no money; identifiers/counts/dates retain their
types. Bigint is used for sums and derived cost checks before the safe Number
bridge; no bigint reaches JSON or Drizzle number columns.

## Inputs, units and ranges

Bodies and MCP objects are strict. No coercion, unknown fields, localized digits,
fractions, exponent/whitespace strings, leading zeros or negative-zero aliases.
Invalid JSON reports 400. MCP also includes required `assetId`.

| Field | Contract |
|---|---|
| amount / amountMinor (cost only) | Positive integer cents, 1..9007199254740991; one required, both must agree; numeric strings rejected for amount |
| date | Required real Gregorian YYYY-MM-DD, years 0001..9999; not before purchase or latest construction cost |
| description (cost only) | Optional string, max 10000 characters; omitted stored null |
| sourceAccountId (cost only) | Required live active organization-owned base-currency account credited; distinct from CWIP |
| cwipAccountId | Optional live active organization-owned base-currency asset account; default saved account, then 1700 Assets Under Construction |
| assetAccountId (capitalize only) | Optional live active organization-owned base-currency asset account; default saved account, then 1500 Property, Plant & Equipment; distinct from CWIP |
| inServiceDate (capitalize only) | Optional same date format; defaults capitalization date and cannot precede it |
| idempotencyKey | Optional 1..128 ASCII letters/digits/dot/underscore/colon/hyphen; operation/organization/asset scoped |

Exact input strings parse int64 syntax but this number-compatible business path
rejects values above MAX_SAFE_INTEGER with 422 before writes. Aggregate/root/GL
derived totals must also fit. No schema/migration, int64 cutover or currency
rescaling occurs. Fixed cents match the existing asset UI/REST contract for all
currency codes; they do not enable IRR or establish currency-tagged asset history.
The editor now parses two-decimal cost text exactly; history display sums bigint.

## Posting and history policy

Mutations require both `isCwip=true` and `status=in_progress`, no capitalization
or disposal markers, zero accumulated depreciation and valuation surplus, no
valuation/depreciation history, and equal purchasePrice/netBookValue with residual
not exceeding cost. Saved category must be live and organization-owned.

Adding a cost posts DR CWIP / CR source, creates the history row, increases recorded
purchasePrice and netBookValue by the exact amount, and saves the holding account.
Costs cannot redirect a nonzero holding balance. Master editing also rejects
changing the CWIP account of a nonzero CWIP asset, including an opening basis
without tracked costs; an explicit remediation workflow is separate work.

Capitalization moves the **entire recorded cost**, including any opening CWIP
basis plus tracked costs, DR destination asset / CR saved holding account, and
marks the asset active. Cost and book value remain unchanged; the service anchor
defaults to capitalization date instead of the pre-construction purchase date.
Zero cost transitions produce no journal, but account/type/scope checks still
apply. Defaults are transactional and consistent in REST/MCP. A nonzero opening
basis requires its saved holding account: the caller must already have booked it
there. This path does not reconstruct, prove or silently create opening funding.

This corrects previous REST/MCP divergence: REST dropped opening basis when any
tracked costs existed, MCP defaulted a different CWIP account, and capitalization
did not enforce period locks. Existing implicit inconsistent history fails
explicitly rather than being rewritten or moved from guessed accounts.

Read/write preflight validates each positive safe cost/date, exact bigint total
not exceeding root cost, unique linked posted live organization-owned journal,
matching date/source/sourceId, two distinct scoped account legs, base currency,
identity legacy millionths and compatible exact rate metadata, equal exact
debit/credit totals and debit held in the asset's saved CWIP account. Missing
journals, foreign/deleted/unposted links, currency changes, redirects or corrupted
legs fail 422. Legacy identity journals may lack new nullable exact metadata;
they are accepted without rewriting. Historical counterpart accounts may be
inactive/deleted but must remain scoped and in base currency. New posting
accounts must be live/active. No stored asset currency/FX snapshot exists.

## Atomicity, concurrency and retries

Organization-first and asset row locks coordinate all adopted masters/lifecycle
operations; reads use a repeatable-read read-only snapshot. Period/fiscal-year
share locks protect legacy concurrent lock-row insertion, then transactional
assertNotLocked applies staff/advisor tiers and closed fiscal years. All writes,
default accounts, exact identity-rate journal lines, saved-response preflight and
audit commit or roll back together. Safe-but-changed returned totals/GL legs also
reject. Stale legacy snapshots continue to reject through lockAssetSnapshot.

Cost calls without a retry key represent distinct costs; callers should supply
one when retrying delivery. Keyed costs replay the saved audited result even
across numeric/Minor clients. Capitalization has a stable default retry key, so
identical unkeyed concurrent/repeated requests replay once. Different normalized
inputs under the same key return 409. Omitted service date equals explicit
capitalization date; account overrides are fingerprinted as supplied. Replay
requires current organization/permission/live-root checks and does not repost
into newly locked periods. Results are the original saved snapshots, not a new
current-state view. New keys on an already capitalized asset fail state checks.

## Errors and qualification

400: schema/JSON/date/state/alias errors. 401/403: authentication/permission.
404: missing/foreign/deleted asset. 409: changed retry payload, backwards cost
history or protected master change. 422: range/saved-history/account/currency/
period failures. Unexpected database/audit faults: 500, entire operation rolled
back. MCP uses the corresponding wrapTool classified result.

Pure and actual transport fixtures cover these contracts, legacy/Minor amounts,
maximum-safe posting, exact accumulation and opening basis preservation, zero
and no-tracked-cost capitalization, both tenant/custom-role and period tiers,
concurrent costs/capitalization, master protection/stale snapshots, malformed
history and whole-table audit/output/GL/default-account rollback.

Implicit opening funding/currency provenance, legacy remediations, historical
account semantics, large-history/table-lock performance, full-int64, browser
session/OAuth and independent accounting qualification remain MON-026/money and
release gates. No build/dev server, provider, deployment or IRR flag change.
