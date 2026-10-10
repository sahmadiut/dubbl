# MON-006 final API and serialization compatibility

2026-10-10, Asia/Tehran. Independent parent acceptance combines the
[wire primitives](../docs/ADR-006-EXACT-WIRE-COMPATIBILITY.md) with the
[complete adopted endpoint inventories](EXACT_API_BOUNDARY_CONTRACTS.md).
It qualifies their composition and retains every operation's existing range,
authorization, transaction, idempotency and historical policy.

| Layer | Exact contract | Supported legacy behavior |
|---|---|---|
| Money input/DTO | Canonical signed int64 amountMinor, explicit currencyCode, unchanged stored units | Safe integer amount with an agreeing amountMinor; no string coercion or inferred scaling |
| Rate input/DTO | Positive ASCII rateExact, up to 20 whole/18 fractional digits, quote_per_base | Positive int32 millionths only when exactly representable; MCP set_exchange_rate retains its distinct decimal-number input |
| Shared JSON/REST/MCP adapters | Explicit server-selected exact mode emits nested bigint as strings; ordinary counts/quantities/dates keep JSON behavior | Default safe bigint becomes numeric; unsafe/nonfinite Numbers and incompatible bigint fail LEGACY_NUMERIC_RANGE/422 |
| Transitional money ORM | Raw SQL text may be parsed by an explicitly exact service | moneyInteger remains a safe-number bridge; genuinely unsafe retained int64 fails rather than rounding |
| Adopted public operations | Named Minor/Exact aliases and explicitly versioned opaque/snapshot contracts in the linked inventories | Existing numeric/major/fixed-two/native envelopes remain; tighter product/sum/sign/FX/provider bounds still apply |

## Client contract and deprecation

Clients select the documented fields of the owning operation. Exact strings are
not permission to post full-int64 money. Unsupported valid exact values fail
with LEGACY_NUMERIC_RANGE/422 before mutation. Malformed/out-of-int64/conflicting
aliases fail validation. A currency, locale, magnitude, Accept-Language or
undocumented header cannot select a different representation, rescale money,
remove the legacy numeric output or bypass business guards. Unsupported retained
money also fails explicitly during reads; it is never repaired by serialization.

Invoice unitPrice is currency-major numeric input, unitPriceExact is decimal
major text, and unitPriceMinor is raw saved currency minor text. Thus the same
1250 minor units mean 12.50 USD, 1250 IRR/JPY and 1.250 KWD, while the stored
integer always remains 1250. Journal/CSV legacy fixed-two fields retain their
separately documented units. Quantities, percentages, dates, counts, opaque
payload strings and native provider amounts are not interchangeable money aliases.

Numeric compatibility remains supported for documented clients. New exact
consumers should use named string fields. No sunset date, public generic exact
switch or numeric-client removal is introduced. ADR-006's proposed minimum
window still requires MON-010/QA-001 qualification and an owner-approved client
migration window; contraction remains authorized REL-004 work.

## Independent parent fixtures

serialization-compatibility.test.ts migrates a disposable loopback database and
executes a new worker with two separate assertions:

- A scratch SQL bigint/numeric table supplies exact text for nine signed money
  values, four currencies and three rates (108 combinations). Shared input/DTO,
  REST JSON and MCP wrapper adapters round-trip signed int64 edges, 10^-18 and
  the maximum 20/18 rate. Safe numeric clients retain their types; unsafe ORM/
  numeric bridges classify failures. This scratch table establishes transport
  capacity, not a full-int64 application workflow or new public endpoint.
- Actual API-key invoice handlers and all registered SDK MCP tools create/read
  128 documents across the four currencies. Numeric major, agreeing dual, exact
  major and exact minor prices preserve 1250, -1250 and 3000000000;
  exact major/minor prices also preserve both safe integer edges. Independently
  formatted expected prices and raw stored SQL integers agree across transports.
  Document/line/audit/organization snapshots prove no writes for malformed,
  conflicting, out-of-int64 and unsupported signed large input. Four genuinely
  unsafe retained SQL int64 values fail reads without changing storage. Locale
  and exact-looking headers leave numeric behavior and range guards intact.

The independent MON-012 event fixture is rerun alongside this parent: recognition
FX, GL, account details, P&L/budget, CSV, snapshot, public reads and HTML/UBL agree
for eight scenarios. Its whole-table negative snapshots additionally qualify
authentication, grants, organization isolation, locks and range failures.
Wire unit fixtures, FX, journal and four boundary-family integration fixtures
retain the deeper contracts. Actual final commands/results belong to the new
MON-006 evidence, not inferred from completed child status.

## Remaining qualification

MON-007/008 retain number-domain and full-int64 business cutover. Migration,
accounting, security, localization, production IRR and release gates remain
independent. No application schema/data migration, historical unit conversion,
production flag, provider call, deployment or standards certification changes.
No global BigInt.prototype patch is used. Generic serialization cannot undo
upstream Number rounding or roll back an already committed write; owning services
must continue preflighting their documented ranges within their transactions.
