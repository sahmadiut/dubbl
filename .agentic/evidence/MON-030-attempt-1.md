# MON-030 attempt 1 - public payment-link and portal JSON

## Identity

2026-10-02, Asia/Tehran. Operator/reviewer: coding-assistant (Codex), self-review.
Entry HEAD 9d7933430baa7262a909e721b53a6842f9353909, clean tree. During this
turn an external commit recorded initial implementation as 81be3e1; this assistant
did not issue a commit. Final validation refinements, documentation and evidence
remain uncommitted. No independent/human/accounting/production approval claimed.

## Implementation and bounded scope

Read root/.agentic instructions, START_HERE/controller/project/repository map,
backend role, MON-011 dependency evidence and ADR-006, money manifest, source
migration/API sections and actual REST/MCP/DB code. Controller selected MON-016.
Source inspection verified independently sized public JSON, provider/webhook,
backup/restore, generic import/export and opaque/SSR/signing workflows. Split into
MON-030..034 through the documented workflow; MON-016 retains original unchecked
integration criteria and depends on all children. Completed only MON-030.

- `lib/api/public-money-wire.ts` adds aliases only for explicitly identified money
  fields, preserving numeric values/quantities/percentages and guarding safe range.
  Statement prefix/final sums use bigint; mixed invoice currencies fail 422.
- `lib/api/public-portal.ts` shares scoped direct-DB token services across eight
  REST handlers and seven new MCP tools. Reads check active/unexpired grants,
  matching undeleted contact ownership, document organization/contact/deletion.
  Payment-link paid/draft/void behavior and all existing success envelopes remain.
- Public routes use the bearer token grant, independently of arbitrary org headers.
  New MCP tools additionally scope by AuthContext.organizationId and enforce
  view:data for reads/manage:invoices for acceptance. All schema fields describe
  expectations. SDK registerTool accepts strict Zod object schemas, ensuring
  unsupported aliases are rejected rather than silently stripped. Registered in
  `lib/mcp/tools/index.ts`; tools use wrapTool without HTTP self-calls.
- Invoice view activity follows DTO/serialization preflight. Quote acceptance
  uses a row lock, organization/contact/sent/deletion predicates and expiry checks.
  Monetary preflight, scoped status update, response preflight and portal activity
  insert share one transaction. Both public acceptance routes now reject draft,
  expired/deleted/foreign-contact quotes; historical approve formerly lacked these
  protections. Replay fails without another mutation. No ledger amount is changed.
- Strict acceptance inputs allow no body or {} only, rejecting amounts/FX/unknown
  fields, malformed JSON and invalid UUIDs before writes. Existing approve ID/status
  envelope remains; accept returns updated quote with monetary aliases.
- Added public API documentation, money README, operation registry, test matrix,
  task/source traceability and refreshed machine inventory. Full-range business,
  provider/backup/opaque/rendering and public frontend/PDF behavior remain assigned.

No schema/migration, application database migration/reset, immutable history rewrite,
IRR enablement, sunset, deployment, full build or dev server action.

## Acceptance mapping

1. [PUBLIC_PORTAL_WIRE_CONTRACTS](../registries/PUBLIC_PORTAL_WIRE_CONTRACTS.md)
   enumerates eight REST and seven MCP operations, inputs/envelopes, each monetary
   alias, unit/currency inheritance, quantities/basis points, signed safe-number
   range, errors, mutation ordering and exclusions. API docs expose the contract.
2. Two pure fixture groups and actual PostgreSQL worker cover old numeric and
   exact-string reads, all operations, USD/IRR/JPY/KWD unchanged integers, signed/
   int32-exceeding/safe-edge values, actual MCP SDK client/strict schema behavior,
   token revocation/expiry, custom permissions, header independence and tenant/
   contact isolation. This is real DB/SDK operation evidence, not mocked queries.
3. Invalid aliases/JSON/UUID, sent/expiry/deletion/scope/replay failures and raw
   unsafe history leave activity/status unchanged. Statement sums/prefixes and
   mixed currencies fail 422. An actual temporary PostgreSQL activity trigger
   raises after the status update, proving rollback of both status/activity writes.
   Raw unsafe quote total remains the original string with sent status; no rounded
   repair or post-commit serializer failure. Monetary values are never rescaled.

## Verification

All commands ran in D:/Projects/dubbl. Synthetic PostgreSQL 18.6 cluster created
at D:/Temp/dubbl-mon030-pg-013c99a55f684bc78a766346c2d1de2c, loopback port 55443,
password-free dubbl_ci role. Fixtures migrate/drop only random dubbl_ci_* databases.
Cluster is stopped; its temporary data directory is retained.

| Actual command/procedure | Result | Limits |
|---|---|---|
| Controller validate/status/context/start/split | Exit 0; valid 84-task graph | Structural validity only |
| `node --import tsx --test tests/public-money-wire.test.ts` | Exit 0; 2/2 groups | Pure aliases/statement arithmetic |
| Initial configured local role fixture launch using DATABASE_URL in-memory as TEST_DATABASE_URL | Exit 1; CREATEDB denied before fixture creation | No privileges/schema/data changed; no credentials printed |
| Separate installed initdb/pg_ctl start | Exit 0 | Synthetic isolated cluster, not configured DB |
| Final `node --import tsx --test tests/integration/public-portal-wire.test.ts tests/integration/contact-wire.test.ts tests/integration/budget-wire.test.ts` with synthetic TEST_DATABASE_URL | Exit 0; 3/3 workers | Public contracts plus contact/budget regressions; actual SDK over in-memory transport |
| `npm test` | Exit 0; 98/98 | All repository unit groups |
| Final `npx tsc --noEmit` | Exit 0 | Before documentation-only MDX change |
| Final `npm run typecheck` | Exit 0; MDX generation and tsc | Includes new API documentation; no build |
| `npm run lint` | Exit 0; 0 errors/167 existing warnings | Same preexisting warning count |
| Targeted eslint on new services/tools/unit/integration files | Exit 0; clean | Earlier targeted run; full final lint also passed |
| `python -m unittest discover -s .agentic/tests -v` with unique D: TEMP/TMP root | Exit 0; 32 run, 31 pass/1 Windows symlink privilege skip | Linux CI must run symlink case |
| Inventory `--write`, reproducibility check, Drizzle/hash verifier | Exit 0; 410 columns, 1326 scanned files, 1104 consumers, 21510 occurrences | Conservative lexical inventory only |
| psql SHOW server_version / remaining fixture DB count / pg_ctl fast stop | 18.6 / 0 / exit 0 | No temporary server left running |
| `git diff --check` | Exit 0 | LF/CRLF notices only |

Initial typecheck found nullable contact currency, incorrect organization currency
property and inferred SDK result/Response union types; fixed with actual
defaultCurrency metadata, explicit result typing and unchanged statement units.
An initial worker compared whole pg Result objects (including parser functions);
corrected the fixture to compare returned rows. Final checks pass after repairs.

## Review and handoff

See MON-030-review-1.md for actual self-review. No blocker remains for this bounded
slice. MON-016/012/006 integration stays blocked on remaining children; controller
next after completion is MON-018 journals. HTTP OAuth/session/browser, PostgreSQL
16 hosted CI, complete statement/accounting qualification, provider limits and
production rollout are not claimed. Existing frontend/PDF /100 behavior remains
MON-008 and localization work, not silently marked correct here.
