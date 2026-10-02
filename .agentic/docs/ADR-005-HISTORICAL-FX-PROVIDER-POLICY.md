# ADR-005: historical FX and provider validation

2026-10-02, Asia/Tehran. MON-005 technical implementation policy by Codex,
self-reviewed. No human accounting, provider eligibility or production approval.

## Direction and precision

Quotes are quote units per one base unit. Preserve provider decimal lexemes from
JSON before using them: original JSON parsing validates syntax only; its numeric
values are discarded. The second lexical pass retains decimals as strings.
Bounded exponent expansion and the MON-004 positive 20-whole/18-fractional policy
apply before any quote is cached or stored. No binary floating-point rate math.

Cross quotes divide feed-to-quote by feed-to-base using bigint rational arithmetic,
half-up at 18 places. A reciprocal uses the same explicit policy. Zero/underflow,
overflow and excess input precision are rejected. These reference-rate policies
do not select signed monetary rounding for the remaining accounting consumers.

During legacy coexistence, sync rounds the original rational directly half-up at
six places, avoiding double rounding. It writes only a positive int32 millionths
value and rejects rounding error over one basis point (0.01%). Very small
reciprocals and high USD/IRR-like quotes are rejected and counted rather than
overflowing or materially distorting a posting. `rateExact` remains exactly the
stored six-place rate, consistent with migration guards; `providerQuote` retains
the original direct decimal or the 18-place cross quote for traceability. Provider
metadata never overrides the authoritative stored rate. Full-range string
contracts and accounting consumer cutover remain MON-006/007/008/010.

## Source validation and availability

Keep existing ExchangeRate-API, Frankfurter v1 and Open Exchange Rates adapters.
No CBI adapter or official Iranian quote is inferred. URLs are fixed HTTPS, with
redirects disabled, ten-second deadlines, no HTTP cache and a 256,000-byte
streaming response cap. Unknown provider configuration fails closed. Fetch/parse
errors and sync logs redact URLs, credentials and payloads.

Require the actual base, a valid Gregorian effective date, validated positive ISO
quotes and an identity base quote when supplied. Ignore non-cash/non-ISO symbols.
An invalid supported quote rejects the entire feed. Never substitute the request
base or today's date for omitted source metadata. Latest feeds must not be dated
in the future or older than seven days. Observations/imports are canonical UTC
timestamps, with at most five minutes of clock tolerance. Frankfurter v1 provides
a date; its observation timestamp remains null.

Provider contracts verified on 2026-10-02:
[ExchangeRate-API open endpoint](https://www.exchangerate-api.com/docs/free),
[Frankfurter v1](https://frankfurter.dev/v1/),
[Open Exchange Rates latest](https://docs.openexchangerates.org/reference/latest-json).
OXR remains USD-based to support its existing free-plan behavior; cross quotes
are derived locally. Frankfurter v1 is deprecated but documented to keep working;
this task retains the existing adapter rather than migrating to v2. Documentation
verification and synthetic tests are not live availability or jurisdiction checks.

Automatic changes over 20% of the last stored same-tenant/pair quote on or before
the feed date are rejected and counted. Quarantined baselines also reject an
automatic replacement. This is a conservative heuristic, not proof that an
initial quote or a small movement is economically correct. A legitimate larger
movement requires a role-authorized manual override. Manual rates retain the
existing numeric bounds, valid Gregorian dates and explicit 1:1 identity checks;
they may bypass the automatic movement heuristic. REST and MCP share validation
and clear obsolete provider metadata on override. MCP now records the audit via
the existing audit helper. No provider provenance is invented for old/manual rows.

## History, scope and concurrency

Refresh writes only `exchange_rate`. It never rewrites journal lines, document
amounts, dates or saved transaction rates. Org/base advisory transaction locks
serialize refresh workers, including initial empty rows. An atomic upsert guard
protects a concurrent same-day manual writer; old observations cannot supersede
newer same-day observations. Counts reflect actual returned writes. Historical
effective dates are retained rather than relabeled with the fetch date.

Historical lookups normalize currencies, validate dates, use latest direct then
inverse rows on/before the requested date and fail closed for quarantines or
unrepresentable legacy inverses. Only same-currency identity supplies 1:1.
The resolver factory captures one organization and lives only for a request or
batch. Request keys include organization/base/quote/as-of; resolved keys include
organization/base/quote/effective date/row ID/direction. Returned snapshots are
frozen, repeated reads within a batch reuse them, and new resolvers see updates.
No tenant-derived values or failures are cached globally. Public source feeds are
shared only inside one sync invocation, keyed by provider/base/effective date;
they contain no organization input, override or business rows.

## Migration and qualification limits

Generated migration `0007_steady_scarlet_witch` adds six nullable provider
metadata columns to `exchange_rate`, including two timestamptz columns. It
changes no original field, backfills no provider identity and removes no guard.
Apply together with the earlier FX expansion through the authorized migration
workflow. Applying it takes a schema lock; production rehearsal/authorization
remain required by the existing migration runbook. The configured app DB was not
migrated. Functional IRR remains disabled.

Synthetic tests qualify provider failure/poisoning, explicit arithmetic policies,
tenant/date caching, legacy coexistence, concurrent syncs, manual precedence and
actual invoice journal preservation. The invoice posting function still uses
legacy amount arithmetic; comprehensive exact posting, period-lock and
financial-report qualification remains MON-007/010 and QA. No new posting API,
historical-provider backfill endpoint, automatic fallback provider, statutory
accounting policy or deployment is introduced.
