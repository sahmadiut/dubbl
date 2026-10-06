# Asset valuation and disposal contracts (MON-088)

2026-10-06; source-verified contract and synthetic PostgreSQL fixtures. Exact
aliases are additive on v1; no opt-in header, sunset, currency rescaling or
production/IRR enablement. Parent MON-026 retains integrated qualification.

## Boundaries

All paths below prefix `/api/v1/fixed-assets/{id}`. IDs are UUIDs in the
authenticated organization. Every operation requires `manage:assets`.

| REST POST | MCP tool | Money input | Response |
|---|---|---|---|
| `/revalue` | `revalue_fixed_asset` | `revaluedAmount` / `revaluedAmountMinor`, required via either alias | `{ revaluation, asset, journalEntryId }` |
| `/impair` | `impair_fixed_asset` | REST `revaluedAmount` / `revaluedAmountMinor`; MCP preserves `recoverableAmount` / `recoverableAmountMinor` | REST `{ revaluation, asset, journalEntryId }`; MCP preserves `{ impairment, asset, journalEntryId }` |
| `/dispose` | `dispose_fixed_asset` | `disposalAmount` / `disposalAmountMinor`, required via either alias | `{ asset, gainOrLoss, gainOrLossMinor, catchUpAmount, catchUpAmountMinor, netBookValueAtDisposal, netBookValueAtDisposalMinor, journalEntryId, catchUpJournalEntryId, surplusJournalEntryId }` |

MCP adds `assetId`; shared services use direct scoped Drizzle transactions.
Existing names, numeric cents and envelopes remain compatible. Disposal REST
adds the MCP gain/journal fields and exact carrying/catch-up fields. Asset detail
GET / `get_fixed_asset` now accepts negative impairment history and returns its
matching signed alias. Valuation and impairment outputs explicitly include
`previousCarryingAmount`, `revaluedAmount`, signed `changeAmount`, `surplusAmount`,
`impairmentAmount`, each with a matching `Minor` alias. Asset roots include the
MON-086 money aliases. Null journal IDs denote non-GL tracking or a zero posting.

## Input units and validation

All money stays fixed integer cents, bounded to 0..9007199254740991 for inputs
and +/-9007199254740991 for signed changes. Numeric inputs must be safe integers;
Minor aliases must be canonical nonnegative int64 strings within the same safe
bridge range. Either alias is required and dual aliases must agree. No floats,
numeric strings in numeric fields, leading zeros, whitespace, exponents,
localized digits, negative zero or implicit coercion. Larger canonical int64
aliases fail 422 before writes. Counts, UUIDs, booleans and dates are not money.
Dashboard major-unit text uses `assetCentsInput` to form exact cents strings,
retaining the existing fixed two-decimal presentation; no currency/locale change.

`date` is required, real Gregorian YYYY-MM-DD, on/after purchase/service and all
saved child or GL history. `idempotencyKey` is optional, 1..128 characters from
`[A-Za-z0-9._:-]`. Valuation `notes` is optional text of at most 10000 characters.
All schemas are strict and every MCP field describes units/expectations.
Malformed/empty JSON, unknown fields and unsupported account IDs reject.

Valuation allows optional `revaluationReserveAccountId` and
`impairmentExpenseAccountId`. Disposal allows optional `proceedsAccountId`,
`gainAccountId`, `lossAccountId`. IDs, including unused overrides, are validated
before persistence. New posting accounts must be live, active, scoped and in the
current base currency. Defaults are 3400 equity surplus, 5510 impairment/reversal,
1250 proceeds, 4300 gain, 5920 loss and 3100 retained earnings; creation occurs
inside the mutation transaction. Distinct nonzero posting legs cannot share an
account. Saved GL accounts may be inactive/deleted if still organization-owned
and in the recorded base currency; new use still requires active/live accounts.
No runtime account-type enforcement is added beyond those default definitions.

## Carrying-base and historical policy

Purchase cost and existing accumulated depreciation remain unchanged by
valuation. Starting carrying amount is cost minus accumulated depreciation.
Ordered valuation rows must chain their previous/new carrying amounts and exact
splits; current NBV equals the latest carrying amount and root surplus equals
the sum of signed equity changes. Revalued amount is the latest valuation target.
For disposal, adjusted gross cost = current carrying + accumulated depreciation,
which includes prior valuation changes. Gain/loss = proceeds - carrying after
any actual catch-up charge. All intermediates/sums/splits use bigint; every saved
amount/GL leg/output must fit the safe numeric bridge, even when inputs fit.

Upward changes first reverse available net negative P&L impairment, then increase
equity surplus. Downward changes first consume equity surplus, then recognize
negative P&L impairment. Saved splits must equal those available balances;
losses/reversals may never produce negative surplus or net positive P&L reversal.
New impairment uses the same signed policy through both transports. The former
MCP path stored positive impairment losses and could allocate recovery to the
wrong balance. Such inconsistent history fails 422 and is never silently repaired.

Depreciation rows must have valid dates/money, not exceed root accumulated
depreciation and precede valuation history. Historical journals must belong to
the asset/organization, be posted and balanced, and use the current base and
lossless 1:1 rate. Linked child rows also require matching source, date, amount
and an unreversed journal. Original journals are never rewritten. Mixed currency,
unexplained root/history differences and unsupported chronology fail closed.
Every new GL line stamps base currency and exact 1:1 quote-per-base rate; the
existing FX sync supplies `legacy_scaled_1e6:transaction` provenance.

Depreciation and depreciation rollback after valuation remain explicitly
unsupported: MON-087 guards still reject revalued assets. This slice establishes
valuation/disposal carrying math without inventing a new remaining-life/usage
schedule. MON-026 retains that integration and implicit currency history.
Revalued and usage-driven assets receive no implicit disposal catch-up. Ordinary
time-based active assets book one monthly charge only if the month is unbooked;
this is not multi-month arrears or disposal-date proration. Both depreciation
accounts must be configured or absent; positive accumulated depreciation with GL
requires its removal account. All depreciation accounts absent supports non-GL
tracking; catch-up still saves a schedule row and updates totals consistently.
CWIP must be capitalized first; disposed assets reject new actions. Surplus is
transferred to retained earnings on GL disposal and root surplus becomes zero.

## Atomicity, retry and errors

Organization-first and asset row locks serialize adopted master/depreciation/
lifecycle writers. Legacy CWIP snapshot locks reject stale values. Same-day new
valuation timestamps are strictly ordered under the asset lock, avoiding the
transaction-start timestamp order of concurrent requests. SHARE table locks on
period_lock/fiscal_year protect the transactional staff/advisor and closed-year
checks, including missing rows. This can delay period edits across organizations.

Optional valuation retry keys are scoped by organization, asset and operation
in audit JSON. Fingerprints use resolved money, date, notes and overrides, so
numeric and Minor clients replay across transports. Conflicts return 409. Without
a key, equal valuation targets fail direction checks rather than repost. Disposal
has a stable default `disposal` key; identical unkeyed requests replay, conflicting
inputs reject. A different explicit key after disposal rejects the terminal state.
Committed keyed replay remains readable even if its period is later locked;
it never posts again. Keys are action-scoped, not a general external API cache.

History, default accounts, GL lines, totals, output preflight and awaited audit
commit together. Faults roll back everything. Syntax/direction/state/date errors
return 400, auth 401/403, missing/foreign assets 404, chronology/retry conflicts
409, unsupported saved money/history/accounts/periods 422, unexpected faults 500.
MCP uses wrapTool with matching classified statuses where applicable.

## Qualification limits

No schema edit/migration, application-database reset/migration, dev server, full
build, deployment or currency flag change. Tests use migrated random databases
on an explicit local PostgreSQL test server and synthetic API keys/MCP identity.
No browser/session/OAuth/real-provider/native accounting review is claimed.
Per-asset currency snapshots, post-valuation depreciation schedules, full-int64
business consumers, large-history performance and independent financial review
remain MON-026/money/release gates. Legacy inconsistent histories need a separate
reviewed remediation, never magnitude-based repair.
