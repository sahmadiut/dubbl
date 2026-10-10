# ADR-006: explicit exact wire contracts and legacy safety

2026-10-02, Asia/Tehran. MON-011 technical foundation, split from MON-006.
Self-review only; no endpoint-wide cutover, human accounting or deployment approval.

## Current adoption status (2026-10-10)

The original foundation/adoption discussion below describes the MON-011 checkpoint.
MON-012 now records the completed bounded rollout in
[EXACT_API_BOUNDARY_CONTRACTS](../registries/EXACT_API_BOUNDARY_CONTRACTS.md).
MON-006 independently verifies storage/wire/public-client composition in
[SERIALIZATION_COMPATIBILITY_CONTRACTS](../registries/SERIALIZATION_COMPATIBILITY_CONTRACTS.md).
Named exact fields preserve documented units; public workflows retain their
explicit safe-number and narrower business limits. No generic public exact-mode
negotiation or numeric sunset has been introduced. MON-007/008 and independent
migration/accounting/IRR/release qualification remain separate.

## Representation and units

`lib/money/wire.ts` defines an explicit `legacy` / `exact` representation.
Existing shared REST helpers and MCP tools default to legacy. Never infer the
representation from magnitude, locale, currency or an undocumented request header.
The generic serializer handles nested bigint without modifying BigInt.prototype.
Legacy emits safe integer Numbers; unrepresentable bigint or unsafe/nonfinite
Numbers produce a classified `LEGACY_NUMERIC_RANGE` error (HTTP/MCP status 422),
not strings, rounded Numbers or null. Exact mode emits bigint integer strings and
preserves ordinary numbers such as counts and quantities. It rejects unsafe
Numbers too: stringifying an already-rounded Number cannot recover precision.

The money DTO explicitly carries currency and a canonical signed int64
`amountMinor` string. Legacy compatibility additionally includes `amount` as a
safe minor-unit Number; exact-only contracts omit the numeric alias. USD 1250,
IRR 1250 and negative refunds retain the integer 1250/-1250. Neither display
scales nor magnitude rescale data. Input accepts `amount`, `amountMinor` or both
with exact agreement. No implicit Number coercion of strings, leading zeros,
negative zero, decimal fractions, exponents, whitespace, localized digits or
out-of-int64 values. The explicit `legacyMoneyInput` bridge rejects a valid large
exact input before any legacy-number workflow can consume it.

FX DTO/input uses `rateExact` with `quote_per_base` direction. Legacy numeric
`rate` is positive int32 millionths. Both aliases must agree; the numeric field
is omitted in exact mode. Decimal precision uses the existing MON-004 positive
20-whole/18-fractional policy, normalized without Number conversion. Legacy DTOs
reject rates that cannot fit int32 millionths exactly; no rounding/inversion is
chosen by the wire layer. MCP's existing decimal-number `set_exchange_rate`
contract remains distinct and must receive a deliberate adapter in MON-012.

## Adoption and negotiation

This foundation changes `lib/api/response.ts` helpers, all tools using `wrapTool`,
and classification of transitional money-column ORM range failures. The new
`jsonResponse` / `wrapTool` representation argument is selected by server code,
not by a public client switch. Existing tools do not advertise exact mode yet.
Direct `NextResponse.json` and independent input schemas are still MON-012 work.
DTO schemas are reusable building blocks, not new public REST/MCP operations.
Exact callers must not be advertised until a real endpoint/tool has a tested,
documented exact contract and exact DB/business path. Do not use minor-unit alias
schemas on legacy major-unit prices, physical quantities, basis points or dates.

MON-012 must record each endpoint/tool's input/output units and aliases, errors,
capability/negotiation mechanism, org/role/period-lock/audit checks, and actual
supported business range. Apply guards before mutations; a serializer failure
after a handler returns cannot roll back previously committed writes. The Number
ORM/domain bridge intentionally remains limited until MON-007/008. Direct raw
SQL aggregate Number coercions and opaque JSON payloads need separate review.

## Deprecation window

Legacy numeric money and scaled-rate representations are technically deprecated
for new exact consumers, but remain supported wherever currently documented.
No sunset date, removal deadline or client opt-in is invented. Proposed minimum:
retain numeric compatibility through MON-010 and QA-001 qualification plus the
owner-approved client migration window, and remove only in authorized REL-004
contraction after usage/fixture evidence. An owner-approved actual window remains
pending; it does not block implementing compatible primitives or endpoint rollout.
No schema changes, migration runs, IRR enablement or deployment occur here.

Source: [API compatibility](../sources/SOURCE.md#api-backward-compatibility),
[migration](../sources/SOURCE.md#database-and-currency-migration), ADR-002/004,
MON-004 dependency evidence and inspected runtime REST/MCP/ORM adapters.
