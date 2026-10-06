# Asset and category master wire contracts (MON-086)

2026-10-06, Asia/Tehran. Bounded contract adoption under MON-026; no financial,
production, IRR or full-int64 qualification. Source: actual route/schema/tool
inspection, ADR-006 and `tests/integration/asset-master-worker.ts`.

## Operations and envelopes

All ten pairs use `lib/api/asset-master.ts` directly via Drizzle and AuthContext.
REST uses authenticated API/session context; MCP uses context at server creation
and `wrapTool`. All operations require `manage:assets`, including reads. This
closes the previous REST-read/MCP permission mismatch. API-key organization wins
over a supplied organization header. No HTTP self-calls or negotiation headers.

| REST method/path | MCP tool | Returned payload |
|---|---|---|
| GET /api/v1/asset-categories | list_asset_categories | REST data/pagination; MCP categories/total/page/limit |
| GET /api/v1/asset-categories/{id} | get_asset_category | category, including scoped chart-account relations |
| POST /api/v1/asset-categories | create_asset_category | category; REST 201 |
| PATCH /api/v1/asset-categories/{id} | update_asset_category | category |
| DELETE /api/v1/asset-categories/{id} | delete_asset_category | success true |
| GET /api/v1/fixed-assets | list_fixed_assets | REST data/pagination; MCP assets/total/page/limit |
| GET /api/v1/fixed-assets/{id} | get_fixed_asset | asset, category, chart accounts, depreciation/revaluation/CWIP history and scoped journals |
| POST /api/v1/fixed-assets | create_fixed_asset | asset; REST 201 |
| PATCH /api/v1/fixed-assets/{id} | update_fixed_asset | asset |
| DELETE /api/v1/fixed-assets/{id} | delete_fixed_asset | success true |

Existing operation names and REST envelopes remain. Asset get/update/delete MCP
parity is additive. Root list MCP retains its existing assets/category envelopes,
and now returns the complete root row plus aliases. Detail adds CWIP costs,
previously omitted by REST despite the UI consuming them.

## Amounts and other units

Assets and category templates retain their existing fixed integer-cents contract.
These tables have no per-row currency or FX snapshot. No currency tag is invented,
no historical value is rescaled, and the dashboard retains its existing USD
two-decimal presentation. General currency/locale/regime conversion and implicit
base-currency history require subsequent qualification. A category residual is a
template amount, not a currency conversion instruction.

| Boundary fields | Input/output policy |
|---|---|
| defaultResidualValue / defaultResidualValueMinor | Create/update accept numeric cents or canonical cents string or agreeing pair; default zero only when both omitted on create |
| purchasePrice / purchasePriceMinor | Create requires numeric cents or canonical cents string or agreeing pair; immutable on update |
| residualValue / residualValueMinor | Create/update accept numeric/string/agreeing pair; create omission inherits category residual then zero; update omission retains |
| accumulatedDepreciation, netBookValue, revaluedAmount, revaluationSurplusBalance, disposalAmount | Read-only root cents fields add corresponding Minor strings; revaluedAmount/disposalAmount preserve null |
| depreciationEntries.amount, cwipCosts.amount | Detail integer cents add amountMinor |
| revaluations.previousCarryingAmount, revaluedAmount, changeAmount, surplusAmount, impairmentAmount | Detail cents add corresponding Minor strings; changeAmount and surplusAmount retain signed values |
| usefulLifeMonths / defaultUsefulLifeMonths | Positive whole months, 1..2147483647; category may be null; never money |
| defaultDepreciationRateBp | Nullable integer basis points, 0..100000; 2000 = 20%; template metadata, not an asset rate/override (no such asset column exists) |
| totalExpectedUnits | Nullable physical integer units, 0..2147483647; positive when selecting units_of_production |
| purchaseDate / inServiceDate | Valid Gregorian YYYY-MM-DD; service cannot precede purchase; create service null/omission defaults purchase; update null clears |
| account/category IDs | UUIDs; organization scoped; nullable account fields explicitly clear rather than inherit on create |
| page / limit | Positive integers, page <=1000000, limit <=200, defaults 1/50; deterministic ordering by date/name plus UUID |

Both clients receive safe numeric amounts and matching canonical Minor strings.
Supported money range is 0..9007199254740991; signed history aliases use
-9007199254740991..9007199254740991. Exact int64 syntax is parsed, but valid larger
inputs fail with `LEGACY_NUMERIC_RANGE`/422 before a Number workflow or mutation.
Numbers must be safe integers. Aliases reject exponents, decimals, whitespace,
leading zeros, localized digits, negative zero, negatives where unsupported and
out-of-int64 values. Null is allowed only on documented nullable fields. No
automatic exact-only mode or public full-int64 promise.

Create/update schemas are strict and every MCP field is described. Unknown
fields (including cost updates, lifecycle totals and currency) fail instead of
being silently stripped. List filters validate booleans/enums/UUIDs; REST accepts
the same 200-row bound as MCP, expanding the old 100-row clamp. Root saved money,
dates, useful life, physical units and template basis points fail closed outside
the supported representation. Nested child reads add aliases explicitly, never
guess money fields recursively.

## Defaults, history and transaction behavior

On create, omitted residual/life/method/convention/posting accounts inherit the
category; explicit values win. Explicit null account fields clear defaults.
Category must be live and organization owned. Method/convention fallback is
straight_line/full_month; life is required directly or through category.
Category updates do not rewrite existing assets. Category reassignment updates
the association only. Zero-cost and CWIP records remain supported; CWIP starts
in_progress. Acquisition creation does not post a journal.

Residual plus accumulated depreciation is compared to cost using bigint, without
a lossy intermediate sum. Economic settings cannot change when depreciation,
valuation or CWIP history exists, or after disposal/capitalization. CWIP state
cannot be toggled by a root patch; its lifecycle operation owns capitalization.
Name/description/tag/category metadata can change without rewriting child rows.
Deletion is soft and preserves all child and journal history. Deleted categories
remain readable through existing asset associations, but cannot be used for new
assets. Reads allow organization-owned inactive/deleted historical account rows;
writes validate all retained/changed posting accounts as live and active.

Detail account/category/journal joins check organization before returning data;
malformed foreign links fail with 422 rather than exposing foreign details.
Ordinary missing, deleted or foreign root IDs fail 404. New foreign/inactive/deleted
posting links fail 404. Validation is 400, permission denial 403, missing/expired
API authentication 401, conflicting lifecycle/economic-history update 409.

Master writes lock organization first, then category/asset and account rows.
DTO preflight and awaited audit insert happen inside the mutation transaction;
unsafe returned rows and audit failures roll back the entire operation. Master
updates/deletion serialize; two concurrent deletions have one successful result.
There is no newly advertised idempotent-create key: retries can create another
record, as before. Metadata-only operations do not post or alter journals, so do
not apply ledger period locks. MON-087..090 own period locks/idempotency for their
financial posting workflows. Unadopted lifecycle writers do not yet participate
in these master locks; MON-026 retains cross-writer concurrency acceptance.

## Verification and limits

Five pure groups cover safe/maximal amounts, canonical aliases, unsupported
ranges, date/query rules and cents presentation. Actual migrated PostgreSQL
fixtures exercise all ten pairs with legacy/exact/dual clients, API-key/custom
roles, expired/invalid credentials, two tenants, category/default/clear behavior,
signed/nullable history, scoped joins and no-mutation snapshots. Injected audit
failure covers all six writes through each transport; post-insert unsafe money
proves rollback before response. Concurrent deletion preserves history.

Master editors use exact two-decimal input, reject fractional months and excess
percentage precision, display maximal-safe cents without Number division, and
sum loaded list rows with bigint. UI totals still describe loaded rows (existing
pagination behavior); full-dataset/performance and browser interaction remain
unqualified. No new browser screenshot requirement is introduced.

MON-087 depreciation/conventions/rollback, MON-088 valuation/impairment/disposal,
MON-089 CWIP/capitalization and MON-090 loan/schedule/payments retain their writers,
calculations, UI financial-action input and ledger acceptance. Parent MON-026
retains combined/cross-writer/base-currency history qualification. No schema,
migration, posted history, production database, provider or rollout flag changed.
