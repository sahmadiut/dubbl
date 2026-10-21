# LOC-098 attempt 1

## Identity

2026-10-21, Codex, `D:\Projects\dubbl`, `master`, initial HEAD `a3cc0055`.
The working tree was clean. One pre-existing local commit (LOC-095/096/097)
was ahead of `origin/master`; it is preserved and will be included by the
owner-authorized master push. This task completes only LOC-098.

## Implementation

The project member/team and notes pages use 94 paired messages:
`ProjectMembers` 57 and `ProjectNotes` 37, for 8,551 compatible catalog keys
per locale. All earlier namespaces are semantically unchanged. The scoped
[registry](../registries/PROJECT_COLLABORATION_CATALOGS.md) records authored
copy, caller/machine/symbol/shared-primitive exceptions and qualification.

Roles, counts, empty states, sheets, note creation/editing/filtering, shortcuts,
document title, action labels and feedback use real next-intl. Unknown roles
use finite translated copy. Note timestamp formatting honors the existing
calendar/numeral/timezone preferences without mutating the saved instant.

`i18n/project-collaboration-presentation.ts` checks assignment/choice lists and
mutation responses before adoption, success, form clearing or refresh. Failed
HTTP, JSON, network, envelope, selected identity and exact-money responses use
finite localized feedback. Lists reject malformed joins and duplicate IDs;
read effects ignore cleaned-up replies. Failures retain draft fields and
release busy state. A committed team assignment with a failed follow-up read
keeps its success and reports a separate read error.

Existing URLs, methods, organization/content-type headers, IDs, role/filter
values, JSON fields, exact cents aliases and optional hourly-rate semantics
are preserved. No REST/MCP implementation, schema, migration, authorization,
posting, ledger, currency flags or Stripe file is changed. Existing registered
MCP operations cover the member/team/note operations. The integration worker
additionally checks actual REST and linked MCP success responses with the new
readers, retaining its independent SQL/scope/authorization/rollback assertions.

## Acceptance mapping

1. All authored slice copy has paired keys; production JSX/attribute guards,
   Persian-script assertions, semantic catalog comparison and scope exceptions
   cover extraction.
2. Real production components render through `PresentationProvider`/next-intl.
   Callback matrices check scoped payloads, maximum-safe exact hourly cents,
   malformed responses, retained input, busy release and finite feedback.
   Notes tests check filtering, pinned-first sorting, escaping/highlighting and
   timestamp preferences. Actual REST/MCP/SQL integration passes.
3. This attempt, the separate Codex self-review, task handoff and scoped registry
   retain provisional Persian wording and independent LOC-068/008/002/native/RTL
   acceptance.

## Verification

Commands run from `D:\Projects\dubbl` with installed dependencies. No skips in
the reported passing tests.

| Command / procedure | Actual result |
|---|---|
| `node --import tsx --test --test-concurrency=1 tests/project-collaboration-catalogs.test.ts tests/project-task-catalogs.test.ts tests/project-time-catalogs.test.ts tests/project-milestone-catalogs.test.ts tests/project-overview-catalogs.test.ts tests/project-catalogs.test.ts tests/project-master-wire.test.ts tests/budget-project-crm-ui.test.ts tests/message-catalogs.test.ts tests/locale.test.ts tests/calendar.test.ts` | 76/76 pass; 504.362 seconds; final focused rerun below also adds the separate follow-up-read regression |
| `node --import tsx --test tests/project-collaboration-catalogs.test.ts` | 8/8 pass; final focused invocation 41.324 seconds |
| Explicit loopback `TEST_DATABASE_URL` and `PG_BIN`; `node --import tsx --test --test-concurrency=1 tests/integration/project-master.test.ts` | 1/1 pass; actual REST/MCP/SQL, 97.313 seconds |
| `pnpm typecheck` | Pass, including final test source; MDX generation and `tsc --noEmit` |
| `pnpm i18n:check` | Pass; 8,551 compatible keys per locale |
| `python .agentic/scripts/money_inventory.py --write`; `node --import tsx .agentic/scripts/verify_money_inventory.mjs` | Pass; 417 columns, 1,809 consumer hashes and all source occurrences |
| `node .agentic/scripts/verify_legacy_money.mjs` | Pass; nine checks |
| Changed-file eslint (both pages, reader, test/helper and integration worker); `pnpm lint` | Pass; no changed-file findings; full lint zero errors and 26 pre-existing warnings outside this task |
| `python .agentic/agent.py validate`; `git diff --check`; new registry/evidence relative-link checks | Pass; final controller validation repeated after completion |
| Semantic catalog/inventory comparison against initial HEAD | Prior namespaces and all 417 schema classifications unchanged; only task-owned consumer records changed/added; none removed |

PostgreSQL 18 ran in a unique OS-temp cluster bound to `127.0.0.1:6473` with
trust authentication and `max_locks_per_transaction=256`. The fixture created,
migrated and dropped a randomized `dubbl_ci_*` database. The final admin query
found zero fixture databases and `pg_ctl` stopped the cluster. The application
environment/database was not used; no secrets were printed or persisted.

## Findings and limits

Initial catalog validation caught that four Persian counts lacked the English
plural selector contract. Both locales now use compatible `one`/`other`
structures, with Persian wording in both Persian branches. Final validation
passes.

The rendering harness executes actual production JSX and translations with
controlled hook state, IO and sheet portals. It does not claim interactive
browser acceptance. Native Persian terminology, full RTL/calendar/numeral and
output qualification, parent acceptance, hosted CI, deployment and production
qualification remain separate. No full build, dev server or complete repository
unit/integration suite was run.

## Handoff

After final gates and self-review, complete LOC-098 via the controller, commit
only task-owned files, push master as requested and verify remote SHA/clean tree.
LOC-068 retains independent project catalog integration acceptance.
