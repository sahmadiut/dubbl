# MON-054 attempt 1 - procurement setting contracts

## Identity and scope

2026-10-04, Asia/Tehran. Operator: coding-assistant. Entry HEAD `f3444c7`, clean
master tree. User requested the next task and commit/push after full completion.
Controller validate/status/context selected MON-054; start claimed it. Read root
and nested instructions, START_HERE/controller/project/repository map, backend
role, task/parent scope, MON-011 attempt/review, ADR-006, source migration/API
compatibility sections, manifest and actual settings/schema/UI/matching/MCP code.
Self-review only; no human/peer approval is represented.

## Implementation

Actual REST supported GET/PUT; the task describes GET/PATCH. Added PATCH and kept
PUT's partial-upsert compatibility for the existing UI. Introduced shared control
schema/DTO and services, replacing duplicated REST/MCP reads and writers. Existing
tool names move into a dedicated registered procurement-settings tool file.
No extra money aliases apply: bounded integer basis points are dimensionless
controls. 500 remains 5%, and range 0..100000 plus exact booleans is unchanged.
Unknown-key stripping, empty/omitted fields, numeric values, metadata and defaults
remain compatible; documented unknown aliases never act as controls.

Input validation precedes mutation; saved controls and response serialization
validate inside the write transaction. Organization-unique conflict upsert changes
only supplied controls, so first/existing concurrent partial saves preserve
disjoint fields. Audit and settings commit together; MCP now records scoped actor
and supplied changes as well. Audit failure rolls back insert/update. Read/default
paths do not mutate. Stored controls and matching readers reject unsupported
history; explicit valid replacements can repair it without silent rescaling.
Malformed JSON is a 400, not an internal error. Writes enforce manage:bills and
custom permissions; all scope comes from authenticated context.

Changed application paths: app/api/v1/procurement-settings/route.ts,
lib/api/procurement-settings{,-wire}.ts, lib/api/procurement.ts,
lib/mcp/tools/procurement-settings.ts, purchasing.ts and index.ts. New pure and
integration fixtures cover this slice. Added PROCUREMENT_SETTING_WIRE_CONTRACTS,
updated MONEY_MANIFEST/TEST_MATRIX and refreshed the lexical inventory. No schema
change, migration generation, monetary arithmetic rewrite or UI change.

## Acceptance mapping

1. PROCUREMENT_SETTING_WIRE_CONTRACTS inventories all GET/PATCH/compatible PUT and
   corresponding tools: input/output fields, numeric basis-point range, boolean
   flags, defaults, omissions, metadata, unknown keys, absence of money/FX aliases,
   errors, permissions, atomicity, repeat/concurrency and qualification limits.
2. procurement-settings-worker runs actual handlers/API-key/custom roles and
   full registered SDK transports in a freshly migrated disposable database.
   It establishes legacy PUT/additive PATCH/read parity, exact-client numeric
   controls, range endpoints, no-write defaults, metadata/omission/false behavior,
   invalid/expired keys, custom-role allow/deny and read access, conflicting org
   headers/body scope, USD/IRR/KWD independence, initial/existing concurrent
   disjoint writes, stable identity/repeats and scoped REST/MCP audits.
3. Pure tests reject malformed types, coercion, range/fraction/nonfinite/bigint
   input and unsupported history. Actual operations snapshot settings/audit for
   invalid input/roles/history and injected failures, proving no committed
   mutation. Stored controls reject through both transport reads and match helper;
   explicit repair succeeds. 500-basis-point matching edge and GRN blocking tests
   show controls retain their consumed units. Responses keep numeric/boolean
   values and ISO timestamps. Audit failure tests cover REST existing update and
   MCP initial insert rollback. Bill lifecycle and PO regression fixtures pass.

## Actual verification

All commands ran at D:/Projects/dubbl with installed dependencies. PostgreSQL 18
synthetic cluster: D:/Temp/dubbl-mon054-pg-6dd18d1492864debb276f11349f62e3a,
loopback port 55464, synthetic dubbl_ci trust-auth role. initdb/hidden pg_ctl
startup and readiness passed. Explicit TEST_DATABASE_URL/PG_BIN selected that
server; harness created/migrated/dropped random fixture databases. Provider keys
were blank in workers. The initial configured local role attempt to CREATE
DATABASE was denied; no permission increase or configured-target migration/reset
occurred. Environment credentials were not printed or persisted in evidence.

| Command/procedure | Actual result | Limit |
|---|---|---|
| Controller validate/status/context/start MON-054 | Exit 0; valid 104-task graph, selected task | Structural only |
| node --import tsx --test tests/procurement-settings-wire.test.ts | Exit 0; 2/2 | Pure contracts |
| Temporary-cluster node --import tsx --test tests/integration/procurement-settings.test.ts tests/integration/bill-lifecycle.test.ts tests/integration/purchase-orders.test.ts | Exit 0; 3/3 | Actual handler/SDK/PostgreSQL contracts and adjacent workflows |
| npm test | Exit 0; 166/166 | Full unit suite |
| Final pnpm typecheck | Exit 0; MDX generation and tsc --noEmit | Installed dependencies; no full build |
| pnpm lint | Exit 0; 0 errors/155 existing warnings | Same warning count as MON-053 |
| Final npx eslint of all ten affected TypeScript files | Exit 0; clean | Includes type-only fixture correction |
| money_inventory.py --write then verification | Exit 0; 410 columns/1441 paths/1186 consumers/23019 occurrences | Lexical/source work queue |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0; Drizzle/source hashes/lines verified | Metadata only |
| node .agentic/scripts/verify_legacy_money.mjs | Exit 0; 9 regression checks | No new deprecated money helper use |
| pg_isready; remaining fixture DB query; pg_ctl -m fast -w stop | Ready during tests; 0 remaining fixture databases; shutdown exit 0 | Synthetic cluster files retained outside repository |
| git fetch origin; git rev-list --left-right --count HEAD...origin/master | Exit 0; 0 ahead/0 behind before commit | Authorized commit/push follows closure |
| git diff --check; controller validate | Exit 0; structurally valid | Line-ending notices only |

Initial apply_patch was rejected for duplicate target operations and applied no
changes; corrected the patch. Initial inline PowerShell-to-node quoting failed
before the DB suite; a here-string launcher resolved it. The configured role
lacked CREATEDB as documented; a separate temporary cluster supplied the fixture
environment. Initial typecheck found map inference widening fixture member.role
to string; an explicit literal corrected it. Final checks passed after correction.
No failed attempt is represented as a passing run.

No full build, dev server, Docker, live provider, browser/session/OAuth check,
configured-target migration, deployment, schema edit or IRR enablement occurred.
Fixture migrations establish test setup, not production migration qualification.
Broader match arithmetic and financial/security/release gates remain assigned.

## Review and handoff

See MON-054-review-1 for implementing-assistant self-review. No slice blocker.
MON-020 retains its original combined procurement acceptance after its children;
controller selects further work. Close via acceptance/submit/self-review/done,
validate staged content, commit and push as authorized, then stop after this task.
