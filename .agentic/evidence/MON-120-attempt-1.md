# MON-120 attempt 1 - dashboard layout contracts

## Identity

2026-10-08, Asia/Tehran. Operator codex; self-review only. Entry master HEAD
6e09f68aa844ba18c104253c2ddc7d8b0fdba23e, clean working tree. Controller validate,
status and next selected MON-120, claimed through start --owner codex. Changes
are uncommitted at evidence creation; no human/peer or deployment approval claimed.

## Implementation

Read root/nested instructions, controller/project/repository map, task, backend
role, MON-011 foundation evidence, ADR-006 and money manifest. Current repository
state superseded the memory handoff for previously completed MON-107.

Both layout REST routes now call shared lib/api/dashboard-layouts.ts CRUD. Added
lib/api/dashboard-layout-wire.ts and five direct-DB MCP tools in
lib/mcp/tools/dashboard-layouts.ts, registered in index.ts. The explicit boundary
matrix, units, ranges, aliases, errors, defaults and ownership policies are in
registries/DASHBOARD_LAYOUT_WIRE_CONTRACTS.md; MONEY_MANIFEST and generated source
inventory are refreshed. No schema file changed or migration is needed.

Opaque widget/config JSON preserves legacy safe numbers, exact strings, custom
widget identifiers, fractional/negative grid coordinates and independently set
default flags. This layer does not guess money units, generate aliases or require
opaque amount/amountMinor fields to agree. Numbers must be finite and within the
JS safe magnitude; arbitrary precision is carried in strings. JSON value count,
depth and serialized byte limits apply across the complete payload. Invalid
shapes, unknown input fields, malformed REST JSON, empty PATCH, non-JSON values
and unsafe numbers fail before writes. Stored shape/config/timestamps validate
before output or PATCH/DELETE. Transactions and owned row locks ensure an updated
result that exceeds combined size limits rolls back, including updatedAt.

SQL isfinite checks prevent the observed Drizzle/JS infinity+0000 date misparse.
The config validator preserves own __proto__/constructor/prototype JSON keys;
the initial z.record parser silently discarded __proto__. Actual REST/MCP
round-trip fixtures cover the replacement. No object prototype is modified.

All rows retain organizationId plus userId ownership. Foreign organization (same
user) and same-organization different user receive empty lists/404. Personal
layout CRUD retains member access, including a trusted context with no financial
data grants. Authentication continues through existing API-key/session or MCP
server AuthContext; no new financial authorization or posting is introduced.

## Acceptance mapping

1. Contract registry maps all five REST/MCP pairs, full envelopes, geometry units,
   opaque exact-string treatment, supported ranges and rejection behavior. SDK
   tool discovery asserts registrations and described input fields.
2. Actual migrated PostgreSQL fixtures invoke API-key REST handlers and MCP SDK
   linked transports, including registerAllTools. Legacy numeric and exact string
   configs round-trip through create/read/list/update/delete, without rescaling.
   Fixtures cover malformed credentials on every REST operation, ownership on
   list/detail/update/delete, unknown IDs, member access and ownership spoofing.
3. Unit fixtures cover cycles, accessors, non-JSON types, sparse/named arrays,
   numeric edges, strict shapes and aggregate limits. Operation fixtures snapshot
   dashboard_layout before rejected inputs, corrupt saved layouts, unsafe saved
   JSONB, infinite timestamps and combined-output overflow. Snapshots remain
   identical after rejection; stored invalid values are neither repaired nor
   deleted. Unsupported numbers yield classified LEGACY_NUMERIC_RANGE errors.

## Verification

All commands ran in D:/Projects/dubbl. A task-created PostgreSQL 18 cluster used
synthetic trust role task_mon120 at 127.0.0.1:55520, UTC. TEST_DATABASE_URL was
explicitly scoped to this cluster. Harnesses created/migrated/dropped randomly
named dubbl_ci_ databases; application DATABASE_URL was not read or used. The
cluster was successfully stopped after tests; temporary data remains outside repo.

| Actual command/procedure | Result | Scope |
|---|---|---|
| node --import tsx --test --test-concurrency=1 tests/dashboard-layout-wire.test.ts tests/integration/dashboard-layouts.test.ts tests/integration/dashboard-data.test.ts | Exit 0, 5/5 | CRUD and adjacent data-widget regression, after finite timestamp fix |
| node --import tsx --test --test-concurrency=1 tests/dashboard-layout-wire.test.ts tests/integration/dashboard-layouts.test.ts | Final exit 0, 4/4 | After opaque key preservation change; includes full registration |
| node --import tsx --test --test-concurrency=2 tests/*.test.ts | Final exit 0, 346/346, no skips | Complete unit suite after final source changes |
| pnpm typecheck | Final exit 0 | MDX and tsc; no Next build |
| pnpm exec eslint on three new modules, index, two routes and three test files | Final exit 0, clean | Every changed code file |
| python .agentic/scripts/money_inventory.py --write | Exit 0 | 415 columns, 1831 files, 1374 consumers, 25993 occurrences |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0 | All Drizzle columns/source hashes/occurrences verified |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0, 9 checks | Money lint gate regressions |
| python .agentic/agent.py validate | Exit 0, valid 173 tasks | Structural controller validation |
| git diff --check | Exit 0 | Whitespace check; LF/CRLF notices only |
| pg_ctl stop for task cluster | Exit 0, stopped | Fixture resource cleanup |

Initial expanded fixture had a missing array bracket; corrected before final
verification. The subsequent infinite-timestamp assertion failed (200 vs 422),
demonstrating adapter misparsing; added SQL finite checks and reran successfully.
Self-review found z.record key omission; final fixtures now assert key preservation.

No full build, dev server, browser screenshots, full integration suite, schema
generation, application migration, provider call or deployment was run. Existing
stored layouts outside the documented JSON limits require explicit remediation.
Generic provider/import/export/history qualification and parent integration remain
their own tasks; IRR production flags remain governed by existing qualification.

## Review and handoff

Actual self-review is evidence/MON-120-review-1.md. No remaining blocker in this
bounded task. Controller completion and task-owned commit/push follow evidence
creation. Query next after done and stop without starting it. MON-105 retains
combined integration acceptance.
