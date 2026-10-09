# MON-124 attempt 1 - safe invoice party snapshots

## Identity and scope

2026-10-10, Asia/Tehran. Operator: codex. Entry HEAD
`0e12b9b7` on master; clean working tree. User requested completion and push of
the next task. Controller selected MON-034; source inspection found independent
invoice snapshot, remaining opaque/admin, public signing and SSR/PDF workflows.
Created MON-124..127 and split MON-034 with the controller. MON-034 retains all
original criteria and final integration acceptance. This delivery completes only
MON-124. Self-review only; no independent accounting, security or human approval.

Fixtures ran on an isolated synthetic PostgreSQL 16 cluster bound to loopback
port 56124 with explicit TEST_DATABASE_URL and CREATEDB. The integration harness
created, migrated and dropped a random disposable database for each run. No
application database, real email/provider or production data was used.

## Implementation

- Shared `invoice-snapshot-wire.ts` defines strict REST/MCP correction schemas,
  UUID validation, allowed party text fields and object/nonempty/range rules.
  Shared `invoice-snapshots.ts` projects status and party JSON only, scopes live
  invoices to AuthContext and enforces view:data/manage:invoices permissions.
- Both existing REST handlers and existing MCP operations use that service.
  Full strict MCP objects prevent unknown fields being silently stripped.
  REST uses guarded JSON responses and reports malformed JSON as 400.
- Historical JSON is read as SQL text and numeric tokens checked before parsing.
  Normalized decimal coefficients/exponents must equal the resulting Number's
  JSON value; values such as 1.0000000000000001 and 9007199254740990.5 reject even
  though default pg JSON decoding would already round them into safe-range values.
  Opaque historical exact strings, identifiers, decimal metadata and their units
  are preserved; no inferred aliases or money scaling. Unsafe history is retained
  and rejected, not silently repaired.
- Corrections lock organization, invoice and signature rows, merge the current
  saved state and atomically write a literal before/after invoice audit. Signed
  history rejects with 409; draft corrections reject with 400. Signature row locks
  conflict with the existing public signer update. Organization-first ordering
  matches lifecycle writers and avoids an audit-FK/child-row deadlock.
- Added `INVOICE_SNAPSHOT_WIRE_CONTRACTS.md`, MONEY_MANIFEST handoff, source/task
  traceability and regenerated money boundary source hashes. No schema/migration,
  totals/lines/posting changes, currency-history rewrite or IRR flag change.

## Acceptance mapping

1. The registry maps both REST/MCP read/correction pairs, allowed inputs, response
   envelope, permissions/errors, units, lack of new money input/aliases, legacy
   safe numeric range and exact-string preservation. Opaque fields never acquire
   financial semantics based on their names. Signed and unsupported history remain
   immutable through this correction boundary.
2. `invoice-snapshots-worker.ts` invokes the actual REST handlers and full registered
   MCP SDK using linked transports. Fixtures verify old safe numeric values,
   full-int64/tiny-FX literal strings, identifier leading zeros, nullable snapshots,
   successful corrections and envelope parity. Two organizations, spoofed header,
   foreign/deleted/missing IDs, denied custom grants overriding owner role and
   invalid REST authentication demonstrate authorization and tenant isolation.
3. Invalid IDs/JSON/unknown fields/empty objects/null or numeric text fields and
   monetary input fail without changing invoice/signature/audit snapshots. Unsafe
   nested Numbers, unsupported saved root shapes and lossy safe-range decimal
   tokens produce 422 LEGACY_NUMERIC_RANGE without mutation. Unsupported unrelated
   invoice totals are not decoded by this party-only projection. Concurrent
   REST/MCP corrections preserve both changes; held organization then invoice
   locks prove lifecycle lock order, and a held signing row proves correction waits
   and rejects committed signed history. Injected audit failures roll back both
   REST and MCP corrections, including updatedAt. Signed subsequent edits reject.

## Verification

All commands ran in `D:/Projects/dubbl`; actual exit codes were zero unless noted.

| Command/procedure | Result | Limits |
|---|---|---|
| Controller validate/status/context/next/start/split | Passed; MON-124 selected after split; 177 structurally valid tasks | Tracker is not product qualification |
| `node --import tsx --test tests/integration/invoice-snapshots.test.ts` with explicit loopback TEST_DATABASE_URL | Final fixture 1/1 passed, no skips; includes real SQL lock waits and rollback | Local disposable PG16, actual handlers/SDK; no dev HTTP server |
| `pnpm test` | 364/364 passed, no skips | Completed before final snapshot-only numeric preflight/lock-order refinements; final integration below covers those refinements |
| `pnpm typecheck` | Final run passed after all source/test edits | No full build |
| `pnpm exec eslint` on both new services, snapshot route, invoice MCP and both new fixture files | Final run passed clean | After all source/test edits |
| `pnpm lint` | Passed; 0 errors, 105 existing warnings, none in changed files | Whole-repo run before final numeric preflight/lock-order refinements; final changed-file lint passed afterward |
| `python .agentic/scripts/money_inventory.py --write` | 415 columns, 1905 scanned files, 1413 consumers, 27223 occurrences | Lexical source inventory, not accounting proof |
| `node --import tsx .agentic/scripts/verify_money_inventory.mjs` | 415 Drizzle columns, 1413 consumer hashes and source lines verified | Final source inventory |
| `node --import tsx .agentic/scripts/verify_legacy_money.mjs` | All 9 gate regressions passed | No new grandfathered arithmetic |
| `python .agentic/agent.py validate`; `git diff --check` | Passed | Re-run on final controller/staged state before commit |

Initial fixture and typecheck failed because the synthetic invoice insert omitted
required contactId. Added owned synthetic contacts; all subsequent fixture/static
runs passed. Review added SQL-text decimal preflight after identifying the pg
decoder rounding risk, and organization-first locks with a held-lock fixture.
The final integration run passed after both refinements. No failed check is
claimed as passed and no unawaited process is used as evidence.

No full build, dev server, Docker, deployment, production migration, broad DB
reset, live provider call or independent financial qualification was run. The
temporary cluster is stopped after verification. Production release/full-range
financial consumers and historical remediation remain their assigned tasks.

## Review and handoff

See `MON-124-review-1.md` for identified self-review findings and boundaries.
MON-124 has no remaining blocker. MON-125 is next; public signing token/SSR and
signature management remain MON-126, SSR/PDF bridges MON-127, complete ownership
inventory/combined integration MON-034. No parent completion is implied.
Commit/push and remote-SHA verification follow controller completion; this evidence
does not invent a future commit SHA or remote CI outcome.
