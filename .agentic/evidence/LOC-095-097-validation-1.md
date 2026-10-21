# LOC-095/096/097 batch validation 1

## Identity and authorization

2026-10-21, Codex, D:\Projects\dubbl, master, initial HEAD
3e3aad67. Clean tree at entry. The owner explicitly requested LOC-095, LOC-096
and LOC-097 concurrently, overriding the ordinary single-task scope for this
batch. Three parallel implementation workers supplied initial code; Codex
integrated, corrected and verified the final diff. The controller's one-active
invariant is preserved with sequential acceptance. No peer/human review is
claimed. This record describes the verified diff before its local commit.
There is no push or deployment authorization in this request.

## Shared implementation

Added 215 paired messages: ProjectTasks 63, ProjectTime 79 and
ProjectMilestones 73; 8,457 compatible keys per locale. All pre-existing
namespaces match HEAD semantically. Three route pages and unique presentation
helpers use real next-intl. Scoped callbacks preserve URLs, methods, fields,
enum/sentinel IDs, canonical dates, integer physical minutes/seconds, exact
Minor aliases, existing cents display and bigint-derived totals. Failed
HTTP/JSON/network/envelope responses receive finite translated feedback before
success, state adoption, form clearing or refresh. Assignment and billing
read effects ignore cleaned-up replies. Shared date/duration/config labels
reuse existing project presentation where appropriate. Authored-copy guards
and Persian-script assertions cover all three pages/namespaces.

The scoped registry PROJECT_TASK_TIME_MILESTONE_CATALOGS.md records explicit
caller-data, machine, symbol/numeric, shared-primitive and sibling exceptions,
provisional Persian, and independent LOC-068/008/002/native/RTL handoff.
Existing corresponding MCP tools remain registered and unchanged. No REST/MCP
implementation/schema, DB migration, authorization, ledger, currency/IRR flag,
Stripe implementation, full build or dev startup change was made.

## Final verification

All commands ran from D:\Projects\dubbl; final invocations passed with no skips.

| Command / procedure | Observed final result |
|---|---|
| node --import tsx --test --test-concurrency=1 tests/project-task-catalogs.test.ts tests/project-time-catalogs.test.ts tests/project-milestone-catalogs.test.ts tests/project-overview-catalogs.test.ts tests/project-catalogs.test.ts tests/budget-project-crm-ui.test.ts tests/project-master-wire.test.ts tests/project-billing-wire.test.ts tests/message-catalogs.test.ts tests/locale.test.ts tests/calendar.test.ts | 73/73 pass; 145.437 seconds |
| Explicit TEST_DATABASE_URL and PG_BIN; node --import tsx --test --test-concurrency=1 tests/integration/project-master.test.ts tests/integration/project-billing.test.ts | 2/2 pass; 42.682 seconds; real REST, linked registered MCP and independent SQL/scope/retry/rollback |
| pnpm typecheck | Pass; generated MDX and tsc --noEmit |
| pnpm i18n:check | Pass; 8,457 compatible keys per locale |
| Changed-file eslint, followed by pnpm lint on final files | Pass; zero errors; full lint has 26 pre-existing warnings outside this batch |
| python .agentic/scripts/money_inventory.py --write; node --import tsx .agentic/scripts/verify_money_inventory.mjs | Pass; 417 columns, 1,806 consumer hashes and all occurrence/source lines |
| node .agentic/scripts/verify_legacy_money.mjs | Nine regression checks pass |
| python .agentic/agent.py validate; git diff --check | Pass before acceptance; final controller validation is repeated after completion |
| Semantic catalog/inventory comparison with HEAD | Every prior locale namespace and all 417 schema entries unchanged; changed/new consumer records belong only to batch files |

The integration workers additionally pass actual successful REST and MCP task,
checklist, comment, timer, time-entry, milestone, assignment, progress-preview
and generated-invoice responses through the new readers. Existing independent
SQL, tenancy, authorization, history/retry and atomic failure assertions remain.

PostgreSQL 18 ran in a unique OS-temp cluster using trust authentication on
127.0.0.1:6473 with max_locks_per_transaction=256. Each fixture used/dropped its
random dubbl_ci_* database. The final admin query found zero such databases;
pg_ctl stopped the cluster. No application .env or database was used. No secrets
were printed or persisted. Temporary catalog fragments were removed.

## Corrected findings and limitations

Initial checks caught an ESM/CommonJS provider mismatch in the task test's
DatePicker import, a missing resetFailed catalog key, a test-helper binding
union type and an invoice test fixture missing required exact-money aliases.
These were corrected and the final checks above passed. The temporary English
time-title separator was restored. Final Persian strings contain Persian
script, without replacement characters or accidental question-mark corruption.

Milestone assignment display previously read nonexistent paid; it now reads
persisted isPaid. Mark-paid remains metadata only, with no fund transfer or
payroll/ledger posting. Timer autosave advances saved refs only after checked
acknowledgement, and failed reset/save retains timer state. Timer ticking is
cleaned up after successful transitions, so failures do not freeze the timer.

The existing timer-save sequence remains two independent calls (create entry,
discard timer), without durable idempotency. If creation commits but discard
fails, or a committed response is lost, manual retry can duplicate time. This
pre-existing backend workflow limitation is explicitly retained for separate
work; atomic timer recovery is not claimed. Autosave keeps its existing silent
failure policy while preserving unsaved references.

No full unit/integration suite, interactive browser, native terminology review,
complete RTL/output qualification, hosted CI, deployment or production
qualification is claimed. LOC-068/008/002 and LOC-098 remain independent.
