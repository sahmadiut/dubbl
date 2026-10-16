# Currency regime registry

Owner: MON-009, maintained by OPS-001. Verified 2026-10-16 (Asia/Tehran).
This catalogue is metadata, not executable monetary policy or production approval.

| Regime ID | ISO code | Display minor units | Effective from/to | Scale to previous | Official source / retrieval date | Decision status |
|---|---|---|---|---|---|---|
| irr-current-v1 (UUID per organization) | IRR | 0 | null / null (unspecified) | null (no predecessor) | Unicode CLDR 48, retrieved 2026-10-16 | Persisted display policy only; official=false |
| Future regime | unspecified | unspecified | unspecified | unspecified | pending official publication/verification | not enabled |

Ledger currency and optional toman display/input are different concepts. Historical posted values retain their original regime. Any reporting conversion must be explicit and versioned. Existing potentially mis-scaled IRR records need identified provenance and a separate remediation decision, not numeric-magnitude heuristics.

## Verified sources and limits

- [Unicode CLDR 48 supplemental currency data](https://raw.githubusercontent.com/unicode-org/cldr/release-48/common/supplemental/supplementalData.xml)
  explicitly records IRR digits=0, rounding=0. The current main data was also
  inspected and agrees. This is a display convention, not an assertion that
  statutory subdivisions do not exist or that a redenomination has begun.
- [Central Bank of Iran](https://www.cbi.ir/default_en.aspx) was queried on
  2026-10-16. The home page returned content, but follow-up retrieval and a
  currency detail page were unreliable. No usable primary-source operational
  cutover announcement, final technical/ISO treatment or effective date was
  established. Third-party reports do not authorize executable policy. This
  lookup does not establish the absence of an announcement.
- The [requirements](../sources/SOURCE.md#rial-and-redenomination-design) require
  fresh official verification before actual cutover. Do not turn a preparation
  window, circulation forecast or planned conversion into a guessed start date.

## Implemented contract

- [IRR metadata](../../lib/currency/irr-metadata.ts) pins the name, fallback symbol
  and zero fractional digits. Full, absent, throwing and partial ICU currency
  enumeration retain IRR. Absent DisplayNames cannot prevent list construction.
  Existing exact-ledger IRR scale remains zero. No amount is divided by 10 or 100.
  The existing global currency-create route uses currency-aware defaults and
  rejects any conflicting IRR decimalPlaces value; it cannot redefine that scale.
- [Schema](../../lib/db/schema/currency-regimes.ts) and
  [migration 0012](../../drizzle/0012_currency_regimes.sql) add an
  organization-owned catalogue with stable key, UUID, ISO code, inclusive
  Gregorian date bounds, display exponent, predecessor, exact numeric with 20/18-digit checks
  factor, source URL and verification date. Null bounds mean unspecified.
  Dates can overlap to describe coexistence; they never select a ledger unit.
- `scaleToPrevious` means **previous major units per ONE major unit of this
  regime**, not minor-unit multiplication and not FX. A predecessor and positive
  finite factor are required together. The predecessor must belong to the same
  organization. Read APIs return the factor as a decimal string. This task adds
  no report normalization or implicit conversion function.
- Existing organizations receive the baseline on migration; new organizations
  receive it atomically through an insert trigger. Regime updates and direct
  deletes reject; deleting the owning organization retains cascading cleanup.
  Policy changes require new versions. No public create/update/delete operation
  can manufacture an official regime. A future verified policy is added by a
  separately reviewed migration, with its own evidence.
- `GET /api/v1/currency-regimes?isoCode=IRR` and MCP `list_currency_regimes` use
  the same strict schema/service and `view:data` authorization. Only the authenticated
  organization is queried; organization overrides and unknown fields reject.
  Both return `{ regimes }`, ordered by ISO code and regime key. Queries are
  read-only and do not audit, seed or modify financial rows.

## History and rollout boundary

This is a metadata expansion before any monetary cutover. Existing financial
rows retain all original values, currencies and rates; the migration does not
backfill guessed historical regime IDs. Untagged historical records remain under
their existing saved-unit contract. There is no newly enabled alternative ledger
regime. Before one is activated, the separate cutover must persist explicit regime
snapshots on affected documents/ledger rows, distinguish provenance of old records,
and add explicit reporting conversion and migration/reconciliation acceptance.
Catalogue dates alone must never reinterpret a posted amount.

Toman input/display remains deferred by DEC-006; `IRT` is not added. No speculative
redenomination date or future factor is seeded. Integration fixtures alone insert
clearly labelled synthetic future policy in disposable databases to prove metadata
coexistence, exact-factor preservation and unchanged complete posted-row snapshots.
Those synthetic dates, decimal places and factors are not Iranian monetary facts.

The [rollout gate](../../lib/currency/rollout.ts) remains false; a premature
`IRR_PRODUCTION_ENABLED=true` request still rejects. See
[ADR-003](../docs/ADR-003-LOCALE-AND-CURRENCY-ROLLOUT.md). MON-009 completion does
not establish official legal policy, financial qualification, historical-data
remediation, production enablement or release approval.
