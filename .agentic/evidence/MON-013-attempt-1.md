# MON-013 attempt 1 — currency FX boundary adoption

## Identity

2026-10-02, Asia/Tehran. Operator: codex. Entry HEAD
`53a1da848bb814831acc38d0423cdc3a265b0a4b`, clean working tree at initial entry.
All changes remain uncommitted. Self-review only, no peer/human accounting,
client sunset or deployment approval. Fixture data is synthetic.

## Implementation and bounded scope

Controller validate/status/context selected MON-012. Read applicable root/nested
instructions, START_HERE, controller/project/repository map, backend role,
MON-011 dependency evidence, ADR-006, money manifest/registries, current FX
schemas, exact primitives, REST/auth/audit and direct-DB MCP source. Verified
520 v1 files (519 route files) and 55 MCP tool files. Split MON-012 according to the controller:
MON-013 currency FX, MON-014 core accounting, MON-015 auxiliary/report,
MON-016 public/opaque; MON-012 retains all original final integration criteria
and depends on the children, which inherit MON-011 without a dependency cycle.
Updated task index/coverage. No scope requirement or acceptance criterion was
silently removed, and other domain tasks were not implemented or marked done.

- Added `lib/currency/rate-wire.ts`: additive REST scaled-rate and MCP
  unscaled-decimal aliases, shared exact-string validation, agreement checks,
  same-currency identity, lossless coexistence guards and stored DTO validation.
  Valid exact rates outside positive int32 millionths/six-place storage fail with
  `LEGACY_NUMERIC_RANGE`/422 before writes, without rounding. Invalid/conflicting
  input is a validation error. Pending/quarantined rows retain legacy metadata
  and expose null exact values; authoritative inconsistent aliases fail closed.
- Both exchange-rate REST route files use `jsonResponse`. POST validates the
  entire 1–500 batch before inserts/upserts and returns normalized aliases with
  existing numeric fields/envelopes. PUT now has the previously missing overflow
  guard, accepts string aliases, validates stored pair identity, clears stale
  provider fields and audits updates. ID-based update/delete predicates include
  organization in addition to scoped lookups; deletion uses existing audit helper.
- Updated `lib/mcp/tools/currencies.ts`: original numeric `rateDecimal` stays
  unscaled, optional string `rateExact` accepts the same supported stored quote,
  independent direct-DB upsert guards/DTOs and clear tool/schema descriptions.
  Scoped deletions audit. Historical lookup exposes explicit null aliases and
  quote-per-base direction; description documents six-place legacy versus
  18-place exact inverse rounding rather than promising equality for inverses.
- Legacy `convert_amount` is explicitly limited to matching currency minor-unit
  scales, safe input/output integers and a safe signed intermediate product.
  Violations return 422 before Number multiplication; no exact-string amount
  contract or full-range/mixed-scale conversion is advertised. Existing small
  equal-scale preview behavior and signed rounding remain. No posting occurs.
- `lib/money/wire.ts` exports reusable rate field validators and precise legacy
  versus exact DTO overloads, and permits a specific compatibility-error message
  for unsupported conversion scale. Existing default error/code/serialization
  behavior is unchanged.
- Added unit and disposable PostgreSQL operation fixtures; corrected an existing
  migration test's stale message assertion to require the established compatibility
  class, `LEGACY_NUMERIC_RANGE` code and 422 status. The prior MON-011 change had
  replaced the old safe-number error wording. This strengthens classification
  verification without weakening rejection of unsafe storage reads.
- Added `FX_WIRE_CONTRACTS.md` with every operation in the slice, actual inputs,
  outputs, units, aliases, ranges, auth/organization/audit policy and exclusions.
  Updated public API reference, money README/manifest, test matrix and source
  inventory. Existing notices, schema, migration files and flags are unchanged.

Exact FX aliases do not enable unsupported high-rate storage or full-range
monetary consumers. Other route/tool/input/aggregate/opaque boundaries remain
MON-014/015/016 and parent MON-012/006 integration. Full domain/storage cutover
remains MON-007/008. Global ISO currency metadata is nonmonetary and unchanged.
FX reference edits do not rewrite posted journals; earlier saved-rate preservation
integration tests also pass. Existing best-effort audit delivery is retained,
not upgraded to a transactional delivery guarantee.

## Acceptance mapping

1. [FX operation inventory](../registries/FX_WIRE_CONTRACTS.md) covers GET/POST
   exchange-rates, PUT/DELETE by ID and all six currency tool registrations,
   including unchanged ISO listing and explicitly legacy-only conversion. It
   names normalization/alias semantics, null quarantine behavior, output
   envelopes, authorization, org predicates, audits and unsupported ranges.
   Public API reference includes a synthetic exact-string request and explains
   the distinct REST/MCP numeric units and 422 behavior.
2. `tests/rate-wire.test.ts` has five groups covering old/scaled and exact clients,
   MCP decimal units, normalized aliases, six-place/int32 boundaries, conflict/
   missing/syntax/direction errors, date/currency/same-pair rules and stored DTO
   consistency/quarantine. `tests/integration/fx-wire.test.ts` launches the actual
   handler worker on a freshly migrated disposable PostgreSQL DB. The worker
   calls real REST exports through actual hashed API-key/member auth, and real
   registered MCP validators/handlers with owner/member contexts for two tenants.
   Covers numeric-only/exact-only/agreed PUT/POST/upsert clients, API-key scope
   despite a conflicting org header, unauthenticated/role denial, tenant reads,
   foreign-ID mutation rejection, metadata clearing/audits, historical direct/
   inverse/missing quotes and guarded preview conversion.
3. Actual DB/audit snapshots before/after invalid bulk/PUT/MCP requests show no
   rate/audit mutation: conflicts, unsafe legacy integers, exact high/tiny/
   excessive-scale rates, invalid direction and same-currency edits fail before
   writes. Valid rate aliases normalize without changing quote units; IDs/day
   and numeric envelopes are preserved. Both adopted routes use guarded JSON;
   shared nested-bigint contracts continue to pass. Full 19-case PostgreSQL suite
   preserves migration checksums, int64 storage rejection, saved journals and
   provider/manual policy. No global adoption/full-range posting is inferred.

## Verification

All commands ran at `D:/Projects/dubbl`.

| Actual command/procedure | Result | Limits |
|---|---|---|
| `python .agentic/agent.py validate/status/context`, start/split/child selection | Exit 0; 66 tasks after split | Structural workflow checks, not financial proof |
| `node --import tsx --test tests/rate-wire.test.ts tests/money-wire.test.ts` | Exit 0; 18/18 | Focused pure/schema/transport contracts |
| `node --import tsx --test tests/integration/fx-wire.test.ts` | Exit 0; 1/1 worker case with numerous assertions | Actual PostgreSQL, REST exports and registered tool validators/handlers; no HTTP MCP transport |
| Final `npm test` | Exit 0; 88/88 | All unit suites after final code edits |
| Final `npm run test:integration` | Exit 0; 19/19 | Existing migration/storage/provider/journal suites plus FX boundary worker |
| Final `npx tsc --noEmit` | Exit 0 | Existing generated Next/MDX sources; no build |
| `npm run lint` | Exit 0; 0 errors, 167 existing warnings | Same warning count as MON-011 |
| Final `npx eslint lib/currency/rate-wire.ts lib/money/wire.ts lib/mcp/tools/currencies.ts app/api/v1/exchange-rates tests/rate-wire.test.ts tests/integration/fx-wire.test.ts tests/integration/fx-wire-worker.ts tests/integration/money-bigint.test.ts` | Exit 0, clean | Covers final code/schema-sharing and assertion edits after full lint |
| `python .agentic/scripts/money_inventory.py --write`, then without | Exit 0; 410 columns, 1,311 scanned files, 1,095 consumers, 21,261 occurrences | Conservative source inventory, not transitive dataflow proof |
| `node --import tsx .agentic/scripts/verify_money_inventory.mjs` | Exit 0 | All exported Drizzle numeric/JSON columns, consumer hashes and lines match |
| Dedicated fixture server cleanup count; `pg_ctl -m fast -w stop` | 0 fixture DBs; exit 0, stopped | Only the synthetic cluster started by this task |
| `git diff --check`; final controller validate | Exit 0 | LF/CRLF notices only; structural validation |

Reused the previously stopped synthetic PostgreSQL 18 cluster at
`C:/Users/Sajjad/AppData/Local/Temp/dubbl-mon004-pg-89fe1b0e6cb2412a81591f2d274dc049`
on loopback port 55440, with explicit synthetic `dubbl_ci` CREATEDB connection
and PG_BIN. Fixtures create/drop randomly named dubbl_ci_* databases and do not
migrate/reset the existing connection database. The configured application DB
and production were not connected or migrated. No secrets were read/printed.

Initial typecheck exposed rate DTO union inference; explicit overloads now
express the default legacy numeric field. Initial worker attempts found a
missing fixture function brace and an unsupported synthetic viewer role;
corrected the fixture to the actual member role. The first full integration
run was 18/19 due to the stale `/safe-number/` assertion described above;
final run is 19/19 after replacing that wording check with stable classification.
All fixture databases were cleaned even on failures. No failures are represented
as passing evidence and no completed task evidence was rewritten.

No full build, unrequested Next dev server, Docker, schema generation, configured
DB migration, live rate/provider call or deployment was run. HTTP/OAuth/session
MCP and frontend/browser behavior, production/PostgreSQL 16 qualification and
human financial review remain unverified/outside this bounded slice. Functional
IRR remains disabled and no client sunset date is invented.

## Review and handoff

See `MON-013-review-1.md` for actual self-review findings. No remaining scoped
blocker. Next is MON-014; inspect and bound the core accounting REST/MCP contracts
before claiming a domain-wide rollout. MON-012/006 retain integration acceptance.
Changes remain uncommitted for owner review; no deployment requested or performed.
