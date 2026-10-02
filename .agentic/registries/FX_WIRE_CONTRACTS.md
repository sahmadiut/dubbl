# Currency FX wire contracts

Source-verified MON-013 slice, 2026-10-02, Asia/Tehran. This inventory covers the
two v1 exchange-rate route files and six registered operations in
`lib/mcp/tools/currencies.ts`. Other REST/MCP domains remain MON-014/015/016;
MON-012 and MON-006 retain combined integration acceptance. No implicit header,
version, locale or magnitude negotiation is used.

## Adopted rate contract

Exact clients may supply `rateExact` as an ASCII quote-per-base decimal string
instead of the legacy numeric input. Strings normalize trailing zeros. REST
`rate` is **integer millionths**; MCP `rateDecimal` is an **unscaled decimal
number**. If both aliases are supplied they must agree exactly. Optional
`rateDirection` defaults to the sole supported `quote_per_base` value. Currency
codes normalize through the existing ISO schema; dates are valid Gregorian
YYYY-MM-DD. A same-currency write must equal 1.

Current business/storage support is positive int32 millionths: 0.000001 through
2147.483647, at most six nonzero fractional places. Exact string parsing permits
the MON-004 20-whole/18-fractional policy, but a valid rate outside coexistence
fails with `LEGACY_NUMERIC_RANGE`/422 **before any rate/audit write**. Malformed,
missing, conflicting, negative, zero, inverted-direction or invalid numeric
inputs are validation errors (REST 400; MCP schema/tool validation error).
No rounding, inversion or rescaling is applied to writes. Exact aliases do not
enable large-value posting or full-range FX storage.

Stored-row responses retain numeric `rate`, all original metadata/envelopes,
normalized string `rateExact` and `rateDirection`. Authoritative exact rows must
have matching aliases and supported format/direction; inconsistencies fail with
422 rather than silently replacing a rate. Pending/quarantined rows retain their
legacy value/status and expose null `rateExact`, never an inferred 1:1 rate.
MCP retains numeric `rateDecimal` as a presentation alias. Shared `jsonResponse`
and `wrapTool` guard serialization without a bigint prototype patch.

| Boundary | Input and returned envelope | Scope/policy and support |
|---|---|---|
| GET `/api/v1/exchange-rates` | Validated currency/date filters and existing pagination; `{data: storedRate[], pagination}` | AuthContext organization filters both rows and count; numeric rate plus exact metadata |
| POST `/api/v1/exchange-rates` | `{rates: [{baseCurrency,targetCurrency,date,rate?,rateExact?,rateDirection?,source?}]}`, 1–500 rows; 201 `{exchangeRates: storedRate[]}` | `manage:tax-config`; validates entire batch before insert/upsert; conflict key contains organization/pair/day; manual source and cleared provider metadata; existing audit helper per saved row |
| PUT `/api/v1/exchange-rates/[id]` | `{rate?,rateExact?,rateDirection?}`; `{exchangeRate: storedRate}` | `manage:tax-config`; organization on lookup **and mutation**; validates stored same-currency pair before update; manual source, cleared provider metadata, update audit; foreign/missing ID 404 |
| DELETE `/api/v1/exchange-rates/[id]` | ID; `{success:true}` | `manage:tax-config`; organization on lookup/mutation; deletion audit; foreign/missing ID 404 |
| MCP `list_exchange_rates` | Optional pair/date/limit filters; `{rates: storedRateWithDecimal[]}` | Context organization scoped; valid date filters; 1–200 limit |
| MCP `set_exchange_rate` | Pair/day plus `rateDecimal?`, `rateExact?`, `rateDirection?`; `{exchangeRate: storedRateWithDecimal}` | Same coexistence range, role, manual provenance and org/pair/day upsert as REST; direct Drizzle, create/upsert audit |
| MCP `delete_exchange_rate` | ID; `{success:true}` | Role, organization on lookup/mutation, deletion audit; foreign/missing ID error; preserves existing generic MCP not-found error behavior |
| MCP `get_exchange_rate` | Pair/as-of day; requested pair/day, nullable `rate`, `rateDecimal`, `rateExact`, direction and resolved source/date/provider metadata | Organization-scoped historical resolver; no future rates; direct quotes unchanged; inverse numeric rate half-up at six places and exact string half-up at 18 places, so inverse aliases intentionally differ in precision; missing/quarantined/unrepresentable quotes return null aliases |
| MCP `convert_amount` | Existing safe integer `amountMinorUnits` and pair/day; numeric input/output minor units and scaled rate | Explicit **legacy-only** preview; no exact-string amount input. Both currency minor-unit scales must match, and signed `amount * rate` must fit a safe integer before Number multiplication. Preserves existing ties toward positive infinity, including refunds. Violations return classified 422. Currency-aware full-range conversion remains MON-007/008; no posting occurs |
| MCP `list_currencies` | Optional text search; `{currencies}` | Global ISO reference metadata, no money/rate amounts; unchanged. Descriptions/scales are not production IRR qualification |

FX reference edits do not themselves post/rewrite ledger history or close periods.
Existing posted rates remain untouched. Period locks/idempotency on financial
posting remain their domain workflows. Upserts remain org/pair/day keyed;
DELETE retains existing success semantics after a matching scoped lookup.
Audits use the existing best-effort `logAudit` helper; atomic audit delivery is
not newly promised. Fixture auth uses actual hashed synthetic API keys/member
roles and two organizations. Registered MCP validators/handlers are exercised
against PostgreSQL; HTTP OAuth/session/transport and frontend qualification are
not claimed.

`app/api/currencies/route.ts` is global nonmonetary ISO-reference GET/POST and is
unchanged. Tax `rate` fields are basis points, not FX; payroll/journal/consolidation
FX envelopes belong to MON-014/015. Provider ingestion and saved historical
quotes retain MON-005 policy. Full direct-JSON/opaque/public inventory remains
MON-016 and parent integration. Legacy compatibility has no approved sunset date;
retain ADR-006's qualification/owner-window gates. No schema/migration or
production flag changes are part of this slice.
