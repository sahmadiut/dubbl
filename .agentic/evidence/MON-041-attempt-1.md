# MON-041 attempt 1 - exact quote contracts

## Identity

2026-10-03, Asia/Tehran. Operator: codex. Entry HEAD `541c299`; clean master at
entry. Verification recorded before the user-requested commit/push. Self-review
only; no independent human/accounting/security/deployment approval. Controller
selected and started MON-041 in the existing 95-task graph; no split or waiver.

Read root/nested instructions, START_HERE, controller/project/repository map,
backend role, task/dependency evidence, ADR-006, money manifest and source sections
database-and-currency-migration/api-backward-compatibility. Inspected actual quote
routes/MCP/schema/frontend payloads, invoice exact services/wire, shared error,
pagination, locks, numbering, references, pricing, tax, audit and fixture helpers.

## Implementation

- `quote-wire.ts`: described transport-specific schemas, Gregorian dates/UUIDs,
  decimal-major REST and integer-minor MCP prices with exact major/minor aliases.
  Price-first rounding, physical quantity, discounts, exclusive tax and products/
  sums use existing bigint primitives with safe-number output guards. Unknown
  fields fail explicitly; dimensions retain their own units. Header/line/contact/
  conversion billing responses gain monetary aliases without numeric type changes.
- `quotes.ts`: scoped direct-DB read/write services with organization/quote locks,
  share-locked references, atomic QTE/INV numbering, creation/replacement/deletion,
  status transitions and conversion. Saved money/balances/tenant/date references
  preflight before writes. Draft PATCH whitelist closes arbitrary DB-field writes.
  Existing headers, USD defaults, creation pricing tiers/windows/default item,
  header-only edits, historical inactive references and currency relabel behavior
  are preserved. Optional line replacement and cost-center persistence supported.
- Shared invoice reference/tax/price/number helpers are exported unchanged;
  decimal-ratio function receives an exported name with identical invoice math.
  Invoice write/lifecycle regression database workers pass.
- Milestone billing retains rounded hundredths/gross/discount/proportional tax;
  percentage retains independent original-line rounding. Default remaining billing
  allocates exact residuals in stable sortOrder/UUID order. Status becomes converted
  only at zero remainder, removing the old one-unit forgiveness. Remaining/requested
  REST error fields retain numeric compatibility plus exact aliases. Duplicate
  milestone lines, overbilling, zero rounded quantities and malformed JSON reject.
- All nine REST boundaries and nine registered MCP operations share the services.
  MCP gains draft delete parity; existing quote registration covers it. Every tool
  schema field describes inputs/units; no HTTP self-call. All writes use existing
  manage:invoices permission and strict period checks (conversion checks today too).
  Audit is awaited only after successful commit, under existing best-effort policy.
- REST send validates requested email before mutation; provider delivery follows
  committed state, consistent with invoice lifecycle. Existing no-PDF attachment
  behavior and MCP status-only send remain. No external provider request was made.
- Added actual operation/pure fixtures, quote contract registry, API/money docs,
  test matrix/manifest and refreshed source inventory. Removed the migrated quote
  route's deprecated money allowance; no allowance increase.

## Acceptance mapping

1. [Complete quote wire inventory](../registries/QUOTE_WIRE_CONTRACTS.md) documents
   each of nine REST/nine MCP boundaries, envelopes, inputs/outputs, legacy/exact
   aliases and agreement, major/minor/physical/basis-point units, rounding and safe
   ranges, defaults, error/status/lock/role policies and separate qualification.
2. `tests/integration/quotes-worker.ts` invokes actual authenticated handlers and
   actual registered MCP SDK callbacks against disposable migrated PostgreSQL.
   Legacy/exact/dual clients, USD/IRR/JPY/KWD, custom read-only permissions,
   conflicting org header versus API key, two tenants, all quote reference groups,
   legacy header edits/currency relabel, line replacement, price lookup, state,
   expiry, deleted records, locks and conversion are asserted.
3. Pure and actual fixtures guard malformed/conflicting aliases, invalid dates,
   unsafe input/product/header sums, safe-max and int32-plus values, unsafe saved
   header/line/contact, foreign saved references and unsupported pricing currencies.
   Complete quote/line/invoice/line/sequence/audit snapshots stay unchanged on
   rejected operations. Forced quote-line insert failure rolls back create and
   replacement; header failure rolls back delete; final quote update failure rolls
   back generated invoice/lines/sequence. Concurrent send/full-convert yields one
   success; concurrent create yields distinct numbers. One-unit rounding example
   bills 1 then precisely 2 across three original one-unit lines. No bigint crashes,
   silent unit/precision loss or unsafe-number JSON fallback is accepted.

## Verification

All commands ran in `D:/Projects/dubbl`. Separately initialized synthetic
PostgreSQL 18.6 cluster `D:/Temp/dubbl-mon041-pg-fe70f67870f9457fa5d8dd7fbbda06b2`,
loopback port 55451, synthetic dubbl_ci role, no provider credentials. Explicit
TEST_DATABASE_URL selected only that server. Harness migrates and drops randomly
named dubbl_ci_* databases; configured app DB/.env were not read or changed.

| Actual command/procedure | Result | Limits |
|---|---|---|
| Controller validate/status/context/start | Exit 0; valid 95-task graph, MON-041 selected | Workflow only |
| Initial quote operation wrapper | Exit 0; 1/1 worker | Actual REST authentication and SDK callbacks |
| `node --import tsx --test --test-concurrency=1 tests/*.test.ts` | Exit 0; 120/120 passed | Includes three quote groups |
| `node --import tsx --test --test-concurrency=1 tests/integration/quotes.test.ts tests/integration/invoice-writes.test.ts tests/integration/invoice-lifecycle.test.ts` | Exit 0; 3/3 workers | Expanded quote fixture and invoice regressions on migrated DBs |
| `npm run typecheck` | Exit 0; MDX generation and tsc | No Next build/dev |
| Targeted eslint of quote services/routes/tools/unit/integration files | Exit 0, clean | Adopted code |
| `npm run lint` | Exit 0; 0 errors, 159 existing warnings | No new warnings |
| `npx fumadocs-mdx` after API documentation edit | Exit 0 | Ignored generated collections |
| Inventory --write/reproducibility and verify_money_inventory.mjs | Exit 0; 410 columns, 1365 paths, 1132 consumer hashes, 21973 occurrences | Source/Drizzle verification |
| Fixture database count and pg_ctl fast stop | Count 0; exit 0, server stopped | Synthetic cluster only; files retained |
| `python -m unittest discover -s .agentic/tests -v` with unique D: TEMP/TMP | Exit 0; 32 run, 31 passed, 1 Windows symlink privilege skip | Workflow only; Linux CI must execute symlink case |
| `git fetch origin` and divergence check | Exit 0; 0 ahead / 0 behind at entry HEAD | Before requested commit/push |
| `git diff --check` | Exit 0 | Line-ending notices only |

Initial pure fixture incorrectly expected 619 for half-quantity milestone net/tax;
actual legacy discount-first/proportional-tax rounding is 618. Corrected the test
expectation and the full unit suite passes. Expected database fault-injection
500 errors are asserted with unchanged snapshots, not failed checks. No failure
is omitted from the fixture outcome.

## Review and handoff

Actual self-review is recorded in MON-041-review-1.md. No remaining slice blocker.
The user requested commit and push after completion; task/controller closure and
Git operations follow verification. MON-019 retains combined integration after
its children; next task is MON-042 exact credit-note contracts.

No schema edit/migration generation, configured DB migration, full build/dev,
Docker, screenshot, rollout/provider/configuration/deployment change. Full int64
business paths, UI/session/OAuth/PDF/provider/email qualification, external public/
import/recurring writers and concurrent period/config changes remain separate
gates. Exact aliases coexist with safe numeric fields; IRR remains disabled.
Existing conversion plan/credit/approval behavior and best-effort audit policy
are preserved. Valid repeated creates/partial bills intentionally create new
documents; no request-idempotency guarantee or financial approval is invented.
