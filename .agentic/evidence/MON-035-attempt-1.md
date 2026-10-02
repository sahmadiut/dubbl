# MON-035 attempt 1 - journal CRUD contracts

## Identity

2026-10-02, Asia/Tehran. Operator: codex. Entry HEAD `3691c9a1ee8649f4a927e5a592e126c662b7c39d`,
clean working tree. Changes are uncommitted. Self-review only; no independent
peer/human/accounting/deployment approval is asserted.

Controller selected MON-018. Read root/nested instructions, START_HERE/controller/
project/repository map, MON-011 evidence/review, ADR-006, money manifest and source
migration/API sections. Actual source has independent entries CRUD, post/void/
recode and bulk import/preview writers, plus recurring template CRUD/pause/run and
generation. Per controller instructions, split MON-018 into MON-035 CRUD, MON-036
lifecycle/import and MON-037 recurring/generation. Original parent scope and all
acceptance criteria remain unchecked; it now depends on all three children.
This attempt implements exactly MON-035.

## Implementation

- `lib/api/journal-wire.ts` provides described, shared REST/MCP line fields,
  canonical nonnegative `debitAmountMinor`/`creditAmountMinor`, safe-number bridges,
  alias/default/conflict validation, exact quote-per-base `rateExact` with lossless
  int32-millionths coexistence and guarded sums/legacy FX products. Guards use
  bigint even for intermediates larger than int64; unsupported values fail 422.
- Adopted REST list/detail preserve historical fixed-two-decimal strings using
  exact bigint formatting; MCP retains minor-unit numeric fields. Exact aliases
  retain raw stored values, including automated base amounts whose currency tag
  refers to the original document. Saved FX comes from SQL `::text`, normalized
  without Number; null/invalid history is retained rather than guessed.
- `journal-references.ts` validates active org-owned accounts/centers and scoped
  projects/fiscal years before writes. Detail reads reject historical cross-org
  account FKs before exposing account names/codes. Existing parent org scope is
  retained; API-key org overrides arbitrary organization request headers.
- REST create now enforces `create:entries`; REST delete requires `edit:entries`
  and period locks. Create header/line writes in REST/MCP now share transactions;
  existing full-replace transactions preserve old/new period locks, and their
  update predicates recheck tenant/draft state. Await create/edit audits.
- `journal-delete.ts` shares direct-DB draft deletion with new MCP `delete_entry`:
  scoped conditional parent deletion and FK leg cascade, permission/lock checks
  and audit. Existing `registerEntryTools` registration supplies this operation;
  no new file registration or HTTP self-call is needed. Shared `wrapTool` now
  classifies PeriodLockedError as status 422, matching REST.
- Create/edit headers use canonical Gregorian date-only schemas; date ordering
  and monthly limits remain checked. Full replacement remains the edit contract.
  Described monetary fields do not reinterpret physical quantities or scales.
- Added three unit groups and real migrated PostgreSQL REST/API-key/custom-role
  and actual MCP SDK/client fixtures. Documented all five CRUD operations per
  transport, units, aliases, ranges and remaining work in JOURNAL_WIRE_CONTRACTS,
  API docs, money README, test matrix, source/task indexes and refreshed inventory.

Existing balance policies are deliberately retained and documented: REST create
compares base amounts with legacy per-line rounding slack for multi-currency/rate
entries; REST replacement and MCP create/update use raw equality. This task guards
the actual Number workflows rather than claiming full exact domain conversion.
Manual mixed-currency list totals retain raw sum semantics. Harmonizing manual/
automated units, currency-scale conversion and posting policy remains MON-007.
MCP preexisting missing-entry/non-draft edit/date-order errors remain isError
responses; newly classified locks return their specific status. No public exact
mode switch, full-int64 domain promise or removal deadline is introduced.

## Acceptance mapping

1. JOURNAL_WIRE_CONTRACTS inventories REST GET/POST/list/detail/full-replace/delete
   and MCP list/get/create/update/delete, header-only envelopes, historical REST
   decimal strings versus MCP minor numbers, exact saved FX/direction/status,
   defaults/dual agreement, supported line/sum/product/rate bounds and exclusions.
   Pure fixtures preserve USD/IRR/JPY/KWD 1250, safe edges and legacy formatting.
2. Actual REST authentication/custom-role and MCP SDK over InMemoryTransport call
   registered tools against migrated PostgreSQL. Fixtures verify legacy/exact/dual
   clients, above-int32/safe-max amounts, account/center/project/fiscal-year scope,
   arbitrary org-header rejection, parent org reads/writes/deletes in two tenants,
   historical foreign-account read rejection, permissions/auth failures, locked
   old/new dates, closed years, posted immutability and successful delete cascades.
3. Exact snapshot assertions verify no entries/legs/audit mutations on malformed,
   conflicting, unsupported amount/rate/date/dimension requests. Raw sums/products
   fail before writes; SQL-trigger failures after header insert/update and leg
   deletion roll back REST/MCP operations. Reads reject unsafe aggregate/history
   values without repair. Already-base automated amounts are unchanged on reads.
   A synthetic invalid-FX history injection disables/re-enables the sync trigger
   inside a transaction only in the disposable fixture, proving null/invalid reads;
   ordinary new invalid writes remain blocked by validation and DB triggers.

## Verification

All commands ran in `D:/Projects/dubbl`. Used a fresh synthetic PostgreSQL 18.6
cluster at `D:/Temp/dubbl-mon035-pg-97860c1095c1408b893df4be92435f6c`, loopback
port 55444 and password-free `dubbl_ci` role. Tests migrate/drop only random
`dubbl_ci_*` databases, not the connection target or configured application DB.
No .env credentials were read, printed or persisted. Cluster stopped at end;
temporary data directory retained.

| Actual command/procedure | Result | Limit |
|---|---|---|
| Controller validate/status/context/start and split | Exit 0; valid 87-task graph | Structural status, not implementation proof |
| `node --import tsx --test tests/journal-wire.test.ts` | Final exit 0; 3/3 groups | Pure contract/range helpers |
| `npm test` | Exit 0; 101/101 | Full repository unit run; later scope-read helper additionally covered by final DB/typecheck |
| Final `node --import tsx --test tests/integration/journal-wire.test.ts tests/integration/public-portal-wire.test.ts tests/integration/contact-wire.test.ts tests/integration/budget-wire.test.ts` | Exit 0; 4/4 workers | Actual operations and transport SDK, no HTTP/OAuth/browser |
| Final `npm run typecheck` | Exit 0; MDX generation and tsc | Existing generated Next sources; no build |
| `npm run lint` | Exit 0; 0 errors/167 existing warnings | Full lint before final historical/scope fixture refinements |
| Final targeted eslint on adopted REST/MCP/helper/unit/integration files | Exit 0; clean | After final code/fixture refinements |
| `python -m unittest discover -s .agentic/tests -v`, unique D: TEMP/TMP | Exit 0; 32 run, 31 pass/1 Windows symlink privilege skip | Linux CI must execute symlink case |
| Inventory `--write`, reproducibility and Drizzle/hash verification | Exit 0; 410 columns, 1332 scanned files, 1109 consumers, 21618 occurrences | Conservative lexical inventory |
| `psql` server version / fixture DB count / `pg_ctl -m fast -w stop` | 18.6 / 0 / exit 0 | No temporary DB server left running |
| `git diff --check` | Exit 0; Git line-ending notices only | Uncommitted local diff |

Initial checks exposed two implementation issues: an int64 overflow in a guarded
intermediate was originally unclassified, and relational numeric JSON decoded
FX as Number. Both were corrected (safe-range guard first, explicit SQL text
projection), then verified with actual handlers. A later malformed-history fixture
correctly hit the DB's new-write FX guard; changed that fixture to explicitly
inject synthetic pre-migration history with transactional trigger control.
Final selected integration suite passes after these fixes. No failing check is
reported as a pass.

No full build, Next dev server, Docker, schema generation, configured-DB migration,
deployment, live provider, browser or human review was run. No schema/migration/
rollout flag change. Existing posting/report/bank defects remain their assigned
tasks. Concurrent MAX+1 number allocation and period/reference changes are not
fully concurrency-qualified here; failed create transactions cannot orphan legs.
Audit remains the existing best-effort logger and does not become a transactional
compliance guarantee. Auth-key last-used metadata is outside mutation snapshots.

## Review and handoff

See MON-035-review-1.md for actual self-review. MON-035 has no remaining blocker.
Next controller task after completion is MON-036 lifecycle/bulk imports; MON-037
can also use the CRUD adapters. MON-018 stays a combined integration gate. Changes
remain uncommitted for owner review.
