# MON-071 attempt 1 - bounded tax rate/profile contracts

## Identity and scope

2026-10-04, Asia/Tehran. Operator coding-assistant (Codex), repository
D:/Projects/dubbl, master, entry HEAD c66ec6d, clean tree. User authorized the
next task and commit/push on completion. Controller validate/status/context/next
selected MON-071; claimed with start --owner coding-assistant. One task only.
Read root/nested AGENTS, START_HERE/controller/project/map/backend role,
MON-011 dependency review, ADR-006, task/parent context and actual source.

No schema, stored units, country catalogue rates, IRR flag, tax calculations or
tax-period/report rules change. MON-072 keeps filing/settlement; MON-029 reports
including 1099; MON-073 approval conditions and MON-022 combined acceptance.

## Implementation and findings

- Added tax-rate-wire.ts strict described input schemas and stored DTO guards.
  Header/component/jurisdiction rates remain numeric int32 basis points
  0..2147483647; input recovery share 0..10000. These dimensionless integers need
  no money/FX string aliases. Unknown aliases, fractions, unsafe/nonfinite
  numbers, strings, invalid country syntax/UUIDs and malformed JSON reject.
  Pure tests explicitly verify both legacy and exact serializer modes.
- Replaced duplicated rate REST/MCP writes with tax-rates.ts shared direct DB
  services. Scoped live rates and active owned component chart accounts are
  validated; org locks serialize defaults, partial patches and replacement.
  Components/headers/default clearing and required audit commit atomically.
  Saved invalid numeric inputs fail on reads and before patches. Delete preserves
  historical rows/components while clearing deleted default flags.
- Profile endpoints/tools share tax-profile-contracts.ts. Existing catalogue,
  recommendation/regime fallback, units, matching criteria and chosen default
  are preserved. Entire batch/required audit commits under the org lock;
  concurrent applies skip duplicate keys and never create multiple defaults.
  Lazy empty-list/onboarding seeding retains best-effort semantics, now carries
  real actor context and has shared REST/MCP list behavior.
- Found existing country-as-entity_id audit using GB against a UUID column;
  use org UUID and store country in changes. Audit failure now rolls back seeding
  instead of being lost after committed writes. No claim of current statutory
  accuracy is made about the unchanged stored catalogue.
- Jurisdiction REST previously lacked write permission/audit and MCP parity.
  lookup.ts now validates bounded values, requires manage:tax-rates for writes,
  scopes mutations and audits transactionally. Explicit NULL-key matching under
  org lock avoids nullable unique-index duplication. Historical duplicates remain
  untouched; deterministic latest-update/UUID ordering selects a row. Lookup
  keeps exact case-sensitive stored keys and optional any-match filters.
- Added tax-rates.ts and tax-lookup.ts tool registration in index.ts: existing
  three rate tools retain their compact/list/header output contracts; new
  get_tax_rate/delete_tax_rate and three jurisdiction tools complete parity.
  All ten adopted tools use strict described schemas, AuthContext, direct DB
  services and wrapTool. Existing period and 1099 tools remain separately owned.
- Registry TAX_RATE_PROFILE_WIRE_CONTRACTS.md documents every operation/envelope,
  units/ranges/alias absence, defaults/patch/retry behavior, errors, scope,
  compatibility corrections and qualification limits. Updated MONEY_MANIFEST,
  money README, TEST_MATRIX and refreshed lexical MONEY_BOUNDARIES inventory.

## Acceptance mapping

1. Registry operation table and range/scope sections cover all rate CRUD,
   components, profile catalogue/apply and cached lookup/save/delete boundaries.
   All percentages stay numeric; unsupported aliases reject. Date/timestamp/
   account identifiers retain their own units and no conversion is applied.
2. tests/integration/tax-rate-contracts-worker.ts invokes actual REST handlers,
   actual API-key/custom-role auth, and registered MCP SDK clients via linked
   InMemoryTransport against migrated disposable PostgreSQL18. Two organizations,
   spoofed tenant headers, viewer/custom-manager roles, expired/invalid keys and
   active/foreign/inactive/deleted component accounts exercise isolation.
3. Pure schemas/DTOs plus actual DB snapshot assertions qualify invalid inputs,
   stored negative rate/component/jurisdiction values, int32 maximum and strict
   fields. Concurrent creates retain one default; two profile applies create one
   batch; NULL-key jurisdiction upserts reuse one row. Audit-trigger faults roll
   back rate create/update/delete, components/defaults, profile batches and cache
   save/delete. No bigint or floating precision enters these basis-point paths.

## Verification

All commands from repository root. Installed dependencies, existing ignored
Next/MDX generated sources. PostgreSQL18 binaries used to initialize a new
synthetic trust-auth cluster under a unique temp directory on 127.0.0.1:55471.
Explicit TEST_DATABASE_URL supplies only synthetic fixture identity. withDatabase
creates/drops random dubbl_ci_* databases, applyCurrent runs committed migrations;
no configured .env target is migrated/reset. No credentials printed/persisted.

| Command/check | Actual result | Limit |
|---|---|---|
| Controller validate/status/context/next/start | Success, valid 123-task graph, MON-071 selected | Structure only |
| npm test | 210/210 passed, exit 0 | Pure tests, not entire product qualification |
| node --import tsx --test tests/tax-rate-wire.test.ts tests/integration/tax-rate-contracts.test.ts | Final 5/5 passed, exit 0 | Actual handler/SDK DB fixtures, no genuine HTTP/session/OAuth server |
| Targeted tax plus tests/integration/organization-settings.test.ts and bank-rules.test.ts | 7/7 passed including four tax pure groups and three PostgreSQL suites | Existing synthetic organization session/email seam; no delivery/auth UI qualification |
| npx tsc --noEmit | Exit 0 | No full build; installed/generated sources |
| npm run lint | Exit 0, 146 baseline warnings, no errors | Existing warnings outside changed scope |
| npx eslint on all changed/new TS paths | Exit 0, clean | Changed source and fixtures |
| money_inventory.py --write, then without --write | Exit 0; 410 columns, 1546 scanned paths, 1250 consumers, 24350 occurrences | Lexical queue, not complete dataflow proof |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0; all columns/source hashes/lines verified | Source metadata only |
| node .agentic/scripts/verify_legacy_money.mjs | Exit 0; 9 checks | Legacy import gate only |
| git diff --check | Exit 0 | Only existing Git CRLF checkout notices |
| Disposable DB cleanup count / pg_ctl stop | Zero dubbl_ci_* databases; server stopped successfully | Temp cluster files retained outside repo |

Exploratory failures were fixed and are not counted as passing: initial types
found required audit user_id could not accept null; seeding now requires actual
actor context and organization settings passes it. First SDK fixture found
removeDefault schemas lost field descriptions; explicit descriptions restored.
Second actual profile fixture found country text invalid for UUID audit column;
fixed to org UUID. Final assertions pass with strict schemas/rollback preserved.

No full build, dev server, Docker, configured/production DB migration, provider,
tax-law refresh, screenshot, currency flag or deployment action occurred.
PostgreSQL16, genuine session/OAuth/network transport, historical duplicate/data
remediation and independent human accounting/security qualification remain open
at their respective gates. Existing read-time seeding exception is retained;
rate creates have no generic request-idempotency key.

## Review and handoff

Actual implementing-assistant self-review in MON-071-review-1.md; no invented
independent/human approval. No unresolved bounded-slice blocker. Complete all
three criteria, submit/self-review/done, validate/status, commit and push as
authorized, verify clean synchronized master and stop. Next MON-072; parent
integration criteria remain unchanged.
