# Journal lifecycle and bulk-import wire contracts

MON-036, 2026-10-02?03 (Asia/Tehran). Source, synthetic PostgreSQL and actual MCP SDK
fixtures; self-review, without production/human accounting/HTTP OAuth qualification.
Companion to [journal CRUD contracts](JOURNAL_WIRE_CONTRACTS.md).

## Boundary inventory

| Operation | Inputs and units | Outputs | Guards |
|---|---|---|---|
| REST `POST /entries/:id/post` | Draft UUID; no money body | `{entry}` with historical fixed-two-decimal leg strings, raw `debitAmountMinor`/`creditAmountMinor`, currency and saved FX metadata | `post:entries`, org/nondeleted header, old-date period/closed-year locks, active scoped dimensions; header lock and atomic status update |
| REST `POST /entries/:id/void` | Posted UUID, nonempty reason | Same `{entry}` contract; original remains posted with reversal/void metadata | `void:entries`, scoped header, old-date locks, historical scoped refs, qualified FX; atomic mirror/links |
| REST `POST /entries/recode` | Scoped filter, target account/center/project, `draftOnly=true`; no money fields | `{recoded,entriesAffected,lines}` counts and changed UUIDs | `edit:entries`, org/nondeleted headers, active scoped targets including empty selections, retained refs scoped, locks; row-locked atomic dimensions/timestamps |
| MCP `post_entry` | Draft `entryId` UUID | `{entry}` posted header; no monetary output | Shared direct-DB service, permission/locks/ranges/refs and audit |
| MCP `void_entry` | Posted UUID, nonempty reason | `{reversedEntry,reversalEntry}` original UUID and reversal header | Shared service; retained MCP `VOID-number` reference and colon-description convention; audit |
| MCP `set_auto_reverse_date` | UUID, canonical Gregorian date or null | `{entry}` updated header | `edit:entries`, org/nondeleted header, unreversed state, original/target locks and target >= original; transaction/audit |
| MCP `recode_entries` | Same described filter/target/draftOnly | Existing `{recoded,entriesAffected}` | Shared service; no amount decoding/math or HTTP self-calls |
| REST `POST /bulk/entries/preview` | Authenticated `{source,rows}`; `debit`/`credit` are fixed two-decimal money (`"12.50"` -> 1250); exact aliases already minor units | Existing preview/counts; parsed row `*AmountMinor` and summary `totalDebitMinor`/`totalCreditMinor`/`imbalanceMinor`; legacy totals remain minor-unit numbers | Read-only shape/date/alias/header/balance/range checks; account/locks qualified during import |
| REST `POST /bulk/entries/import` | `{fileName,source,post=false,rows}`, same REST units | `{job}`, 201; existing count semantics retained | `manage:entries`, plus `post:entries` when posting; strict wire/range checks before job, scoped account/lock preflight, atomic header/legs per group, audit |
| MCP `preview_journal_entries` (new) | Flat rows; `debit`/`credit` are integer cents (1250), exact aliases already minor units | Same previews and exact summary aliases | Read-only described SDK schema and shared pure adapter |
| MCP `import_journal_entries` | Flat rows with MCP cents contract, `post=false` | Existing `{jobId,totalEntries,processedEntries,errorEntries,posted,status,errors}` | Shared import service, permission/account/lock checks, transactions/audit |

REST paths relative to `/api/v1`. Existing tool files remain registered through
registerEntryTools/registerImportExportTools in index.ts; each MCP input field is
described. No public mode/header negotiation or legacy alias removal.

## Units, ranges and mutation policy

- Post/void/schedule use MON-035 DTOs and safe signed historical amounts/sums in
  +/-9007199254740991. REST decimal strings use exact bigint /100, retaining that
  legacy format for every currency; raw exact aliases never rescale. MCP header
  envelopes need no invented monetary aliases. Posting retains creation balance
  policy rather than performing another conversion/balance algorithm.
- Reversal swaps raw stored debit/credit and preserves saved rate, currency tag,
  dimensions and links. Already-base automated amounts are not converted again.
  Saved FX is read with SQL `rate_exact::text`, never current rates or numeric JSON.
  Mirror/changed recode lines require matching positive int32 millionths
  (0.000001..2147.483647), quote_per_base, format 1, status `exact` and current
  `legacy_scaled_1e6:transaction` provenance. Unqualified metadata fails 422 so
  the coexistence trigger cannot silently repair history. Post/schedule update
  headers only and can retain null historical FX; inconsistent nonnull FX fails.
- Recode selects dimensions/text FX only: untouched int64 money stays unchanged,
  without full-int64 posting/report support. Draft-only default and explicit
  false posted inclusion retain the existing audited reclassification policy.
  Same-org historical inactive/deleted dimensions remain available for mirroring
  or retaining history; new post/import/target choices require active refs.
- Import `debitAmountMinor`/`creditAmountMinor` are canonical nonnegative int64
  strings. Values/group sums must fit 0..9007199254740991; dual aliases agree after
  the explicit REST decimal conversion or directly against MCP cents. Omitted
  sides default to zero; REST blank decimals also remain zero. Exact syntax
  rejects signs, leading zeros, localized digits, fractions and exponents.
- REST source enums quickbooks/xero/freshbooks/wave/custom retain fixed-two-place
  decimal semantics. Source preprocessing normalizes existing date formats, then
  validates canonical dates. Amount text supports plain decimals, valid US comma
  thousands, European dot-thousands/comma-decimal groups, and leading $, euro,
  pound or yen symbols. Negatives/parentheses, extra fractional digits, malformed
  grouping and trailing junk now fail rather than round/truncate. Decimal strings
  support through `90071992547409.91`. Numeric decimals are conservatively capped
  at `2^45 - 1` major-format units, keeping adjacent hundredths distinguishable
  before JSON decoding; larger amounts require text or exact minor-unit aliases.
- Imported legs retain existing USD/1:1 defaults. No currency/FX fields, source/
  locale-based scaling or currency-aware major-unit import is advertised. Exact
  aliases preserve raw units; production IRR remains disabled.
- Malformed shape/date/money/alias import fails before job/audit/financial writes
  (REST 400/MCP isError); unsupported valid int64/decimal workflow ranges fail
  LEGACY_NUMERIC_RANGE/422. Preview never writes: REST retains per-row errors,
  while SDK validates MCP row shapes before the handler; overflow fails 422.
- Business-invalid groups (balance/zero/line count/both sides/header mismatch/
  unavailable account/posting lock) retain partial-job behavior: no financial
  write for that group, job errors recorded and valid groups commit independently.
  Storage failure rolls back each header/legs. Legacy processedRows/errorRows
  count entry groups; totalRows counts input lines. Partial success is completed,
  all-group failure is failed; empty import now fails validation.
- Account codes use literal case-insensitive equality, not ILIKE wildcards;
  ambiguous case variants fail. Authentication org overrides arbitrary org
  headers. Lifecycle response serialization is inside the transaction, so a
  response-range failure cannot commit the status/reversal mutation.

## Qualification and limits

Pure journal-import-wire fixtures cover valid decimals, safe edges, REST/MCP units,
aliases, conflicts, syntax/ranges, sums, preview and dates. The actual migrated
PostgreSQL journal-lifecycle-wire worker invokes all five REST/six MCP operations:
legacy/exact/dual clients, above-int32/safe-max, rates/base amounts/dimensions,
both tenant directions, API keys/custom roles, period/closed-year locks,
dates/order/state, unsafe history/sums, null FX, inactive historical reversal,
literal accounts, partial imports, before/after snapshots, reversal/import leg
faults, failure after one recode succeeds, and exactly one concurrent void mirror.

No HTTP/session/OAuth/browser/provider/production DB/deployment, schema or flag
change. Existing import retries create another job; no new cross-request import
idempotency. MAX+1 allocation across different concurrent entries/imports,
reference/lock races, interrupted job finalization and best-effort audit durability
remain domain/QA gates. Scheduled auto-reversal and shared document reversal
automation are unchanged; exact domain/scheduled qualification remains MON-007/QA,
recurring templates MON-037 and parent integration MON-018.
