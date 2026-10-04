# MON-077 attempt 1 - exact inventory valuation and landed costs

## Identity and scope

2026-10-05, Asia/Tehran. Operator: coding-assistant. Entry HEAD 2109985,
master tracking origin/master, clean working tree. User requested the next task
and commit/push when fully complete. Controller validate/status/context/next
selected MON-077 and start claimed it. This evidence describes the implementation
before commit; it does not invent a commit or independent review.

Read root/nested instructions, START_HERE/controller/project/repository map,
backend role, task/dependency MON-011 evidence, ADR-006, source migration/API
sections and MON-076 handoff/evidence. Inspected actual valuation, landed cost
REST/MCP, schema, report, procurement/master stock writers and dashboard paths.
No external tax/provider/currency facts are used or asserted.

## Implementation and findings

The previous REST/MCP allocation implementations duplicated floating-point shares,
could allocate a different total than the component, rounded FIFO capitalized
unit costs and lost residual cents, pre-read drafts outside the transaction and
did not apply scoped source/period/audit checks consistently. Existing report
fields were purchase/sale price projections; they were not perpetual book value.
The dashboard expected purchasePrice and totalRetailValue although the API
returned unitCost and totalValue.

- `lib/api/landed-costs.ts` and `landed-cost-wire.ts` now own transactional scoped
  list/get/create/update/delete/allocation. Existing envelopes and legacy numeric
  major component inputs remain; additive amountMinor and response Minor aliases
  preserve exact stored units. Inputs/totals/aliases are checked before insert;
  source, domain, response and audit failure cannot commit partial writes.
- Landed allocation uses exact largest-remainder shares with stable PO ordering,
  checks every component total, rolls duplicate item lines up once, locks adopted
  writers and posts balanced base-currency inventory/clearing GL atomically with
  stock/layers/line allocations/status/audit. Repeated/concurrent posting has one
  winner. Allocated history cannot be edited/deleted. Period locks apply UTC today.
- Unsupported by_weight/manual, standard/exhausted stock, service lines,
  foreign-currency capitalization and inconsistent FIFO history fail explicitly.
  Supported legacy allocation still capitalizes current on-hand stock/open layers,
  not reconstructed original shipment quantities. Component account is source
  metadata; credit remains clearing 2160. These limits are documented contracts.
- `lib/money/inventory-cost.ts`, shared valuation/master preflight and MON-052
  bill-stock adapter retain exact FIFO residuals. Nullable remainingValue and
  consumption value preserve cents separately from original unitCost. Partial
  issues allocate current carrying value; final exhaustion consumes all residual.
  Historical null fields derive original saved products. Bill reversal rejects
  consumed/capitalized layers; procurement receipt divisibility restrictions remain.
- `lib/db/schema/inventory.ts` adds two nullable moneyInteger/bigint columns.
  Required `npx drizzle-kit generate` produced 0008_perpetual_scarlet_spider.sql,
  snapshot and journal entry. No backfill/rescale/history rewrite. Migration ran
  only in disposable test databases; the existing configured app DB was untouched.
- `inventory-valuation-report.ts`/`inventory-valuation-wire.ts` supply exact
  report products/aggregates, saved carryingValue/averageCost with aliases and
  owned layer/consumption history. Five REST route files delegate to shared
  services. Existing report price projections remain; book value is additive.
- Eight MCP tools cover landed CRUD/allocation plus valuation and layer history.
  New tool file registered in index; each operation uses wrapTool/direct Drizzle,
  explicit org AuthContext and described strict inputs. Actual full catalog checks
  find no duplicate names. No HTTP self-call or dev server was introduced.
- Dashboard/CSV use the correct API fields and exact currency-aware formatting;
  book value is separate from purchase price projection. Landed editor submits
  integer aliases without parseFloat and no longer offers unsupported methods.
- New contract registry, money README/manifest/test matrix, schema classifications
  and generated source inventory updated. MON-078 handoff names the new carrying
  values; no MON-078 or parent MON-024 acceptance is claimed.

## Acceptance mapping

1. INVENTORY_VALUATION_WIRE_CONTRACTS.md records all eight operation pairs,
   envelopes, inputs, outputs, fixed-two-decimal legacy major input, exact minor
   aliases, safe/int64 syntax ranges, quantity units, method-dependent bases,
   rounding, currency/posting rules, historical fallback and unsupported states.
2. `tests/integration/inventory-valuation-worker.ts` invokes actual REST handlers
   with hashed API keys/custom memberships and actual SDK in-memory MCP tools,
   including full catalog registration. It covers legacy/exact clients, all
   operations, custom read role, invalid/expired credentials, cross-org headers,
   foreign roots/sources/items/accounts and corrupt saved source references.
   PostgreSQL workflow assertions accompany pure transport/math tests.
3. Full saved-table snapshots remain unchanged after input/permission/source/
   range/state/lock failures and four injected audit rollback families. Exact
   allocated totals, balanced GL, FIFO residual exhaustion across multiple
   layers, average receipt integration, duplicate item rollup, safe values beyond
   int32, unsafe saved int64/aggregates and one-winner concurrent allocation
   are asserted. Pre-0008 layer migration preserves original columns unchanged.

## Actual verification

All commands ran in D:/Projects/dubbl with installed dependencies and existing
generated Next/MDX sources. PostgreSQL 18 ran in a newly initialized temporary
localhost trust cluster with synthetic data, on port 55477. No credentials were
printed from .env; no app database dump, reset or production write occurred.

| Command/procedure | Actual result | Qualification limit |
|---|---|---|
| Controller validate/status/context/next/start | Exit 0; valid 128-task graph | Orchestration only |
| npx drizzle-kit generate | Exit 0, two-column migration 0008 | Generation is not deployment |
| Initial pure/new PostgreSQL tests | Exit 0, 4/4 | Before expanded negative coverage |
| Expanded valuation + inventory/catalog/master/movement/receipt tests | Exit 0, 9/9 | Actual scoped workflow fixtures |
| Valuation + bill lifecycle + migrations/pure checks | Exit 0, 10/10 | Ledger preservation/idempotent migration/rollback |
| Broad simultaneous 8-file integration run | Exit 1, 8 pass/6 fail | PostgreSQL default lock-table shared memory exhausted during parallel migrations; logged below |
| Final same 8 files with --test-concurrency=2 | Exit 0, 14/14 | Includes MON-048/052/074/075/076, migration suite and this slice |
| Final pinned pre-0008/new valuation/pure rerun with --test-concurrency=2 | Exit 0, 5/5 | Includes standard/service/zero-cost/stored-weight negatives and pinned 0007 historical migration |
| npm test | Exit 0, 227/227 | Full pure suite |
| npm run lint | Exit 0, 0 errors/143 existing warnings | Same count as previous task |
| Final changed-file ESLint via execFileSync argv | Exit 0, 23 files, 0 errors/1 preexisting unused router warning | Full lint already contains this warning |
| Final pnpm exec tsc --noEmit | Exit 0 | No full build or new generated runtime |
| money_inventory.py --write; money_inventory.py; verify_money_inventory.mjs | Exit 0, 412 columns/1265 source consumer hashes | Conservative lexical inventory, not transitive proof |
| verify_legacy_money.mjs | Exit 0, 9 checks | No new deprecated money consumer |
| git fetch origin; rev-list HEAD...origin/master | Exit 0, 0 ahead/0 behind before commit | Commit/push follows closure |
| pg_database fixture count; pg_ctl stop | Zero fixture databases; exit 0 shutdown | Only newly created temporary cluster |
| git diff --check; controller validate | Exit 0 | LF/CRLF notices, no whitespace error |

Initial typechecks found an incorrect jsonResponse import and nullable generic
DTO intersections inferred as never. Correct shared import and explicit omitted
field types repaired them; final typecheck passed. First changed-file lint command
had PowerShell/pnpm array argument flattening and did not lint files; final direct
Node execFileSync argument vector succeeded (one existing router warning).

The broad parallel migration failure is an actual environment limit, not waived
acceptance: PostgreSQL logged `out of shared memory` with max_locks_per_transaction
hint during six concurrent fresh migrations. Reduced test-file concurrency gave
all 14 checks a clean rerun without changing application/migration code or test
assertions. The existing failed-migration test deliberately produces its own SQL
error and verifies rollback; that expected error is separate from this failure.

## Review and remaining qualification

See MON-077-review-1.md for implementing-assistant self-review. No separate agent,
human financial/security sign-off, live browser/session/OAuth transport, PostgreSQL
16/CI clean install, build/dev, Docker, provider call or production deployment
is claimed. Dashboard layout and API field/CSV alignment were inspected in source;
no visual runtime check is claimed. Full-int64 ORM/business range, current currency
regime rollout, IRR enablement, complete restore/migration and release gates remain
their assigned tasks. Stock transfer/assembly/cost-method changes and historical
FIFO remediation retain MON-078/024 and qualification scope; no silent rewrites.

## Handoff

All three bounded MON-077 criteria are supported by the registry and actual checks.
Close through honest self-review, validate/status, commit and push as the user
requested, then stop. Next task MON-078. Required migration 0008 is committed with
schema; applying it to other targets remains their authorized migration workflow.
