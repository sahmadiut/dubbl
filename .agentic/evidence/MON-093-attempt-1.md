# MON-093 attempt 1 - exact project master and time contracts

## Identity and selection

2026-10-06, Asia/Tehran. Actual operator coding-assistant, D:/Projects/dubbl,
master, entry HEAD 27cbb7c. User requested completion and push of the next task.
Entry tree was clean; controller selected MON-093 and claim succeeded. Read root
and nested instructions, START_HERE/controller/project/map, backend role,
MON-011 attempt/review, ADR-006, task, source migration/API sections and current
project/schema/client/MCP/fixture sources. Origin fetch found zero divergence.
No delegation or independent/human approval is claimed. Evidence is prepared
before the authorized implementation commit and push; final Git SHA is verified
outside this immutable evidence record.

## Implementation

- project-master-wire.ts supplies strict described schemas, fixed-cents alias
  agreement and safe legacy bridge, date/physical int32/percent guards, saved-row
  DTO validation and explicit query/JSON error handling. Strings above safe Number
  but within int64 fail classified 422 before writes; malformed inputs reject.
- project-master-operations.ts catalogs all 48 existing operation boundaries and
  their individual MCP tools, schemas, paths, identifiers and result envelopes.
  Seventeen REST files use project-master-route.ts and the same scoped direct-DB
  services as new registered project-master MCP tools. Existing billing tools
  remain with MON-094; no multi-purpose public tool was introduced.
- project-master.ts enforces project/task/milestone/child ownership, current scoped
  members/public users, contact, team, employee, invoice/payroll and label references.
  Unsafe password/auth expansions are removed; nested employee output is public
  identity metadata. Organization/project locks serialize adopted writers.
  Rows/time totals/audit/returned-money checks commit atomically; reads use scoped
  repeatable-read snapshots. All 33 writers have actual audit-fault fixtures.
- Bigint entry-minute sums verify historical totalHours and protect int32 totals.
  Explicit rates override member/project inheritance. Invoiced time is immutable;
  invoiced/paid milestones, referenced tasks and attached labels have deletion/edit
  guards. Currency changes reject financial references. Checklist batches preflight
  all IDs. Timers retain current-user replacement/pause/resume/discard semantics;
  paid assignments are metadata-only and repeating mark-paid writes/audits nothing.
- project-display.ts and editors parse exact cents and decimal hours, preserve
  existing minutes in settings, value time with bigint half-up products, and display
  bigint totals. Project list summaries reject unlike-currency presentation.
  Task estimates parse whole minutes. Delete failures reach clients, the tracking
  picker requests the existing 100-row cap, and mark-paid uses the actual query-ID
  route rather than a nonexistent nested endpoint.
- PROJECT_MASTER_WIRE_CONTRACTS maps every boundary/input/output/unit/range,
  authorization, scoped reference, compatibility correction, retry and limitation.
  MONEY_MANIFEST, money README, CI_RUNBOOK and source-hash inventory record adoption.
  No schema, migration, historical rescale, production IRR flag or deployment change.

## Acceptance mapping

1. PROJECT_MASTER_WIRE_CONTRACTS documents all 48 REST/MCP pairs, every input field
   and output envelope, writable/read-only/null financial aliases, fixed cents,
   cents-per-hour versus physical minutes/seconds/percent, exact date/UTC instant
   policy, safe/int32 ranges, strict errors, scope, transaction and retry behavior.
2. Four pure groups plus project-master-worker.ts invoke every actual REST/MCP
   operation, full SDK registration and API-key auth. Fixtures cover numeric/exact/
   agreed/null/maximal cents, saved JPY label, rate inheritance, member/team/task/
   checklist/comment/label/note/milestone/assignment joins, custom roles, expired/bad
   keys, foreign organization headers, every foreign project root operation,
   cross-org references and same-org wrong-task/label IDs. Own-comment and own-timer
   rules are checked. Complete master detail agrees across transports without
   password/auth fields.
3. Invalid aliases/schema/date/percent/physical/reference requests leave whole
   project tables and audit snapshots unchanged. All 33 writers roll back failing
   audit inserts in both transports, including unlinked task deletes. Every
   financial create/update and soft project delete rolls back injected returned
   unsafe money; poisoned parent outputs also undo newly inserted time. Exact total
   max/overflow and corrupt stored totals reject before writes. Paid retry and
   empty child patches preserve complete state. Concurrent time/timer/member requests
   preserve summed minutes, one timer and one member assignment. Billed/paid/task/
   label lifecycle guards and unsupported saved money/references are exercised.

## Verification

All commands ran in D:/Projects/dubbl. A new PostgreSQL 18 cluster bound only to
127.0.0.1:55493 used UTC timezone and a synthetic test identity. Explicit
TEST_DATABASE_URL caused the harness to create/migrate/drop random fixture
Databases; no configured application DB or .env credentials were read/migrated/
seeded/reset. Zero random databases remained after the final fixtures, and the
new cluster was stopped. Its temporary cluster files were retained.

| Actual command/check | Result | Limits |
|---|---|---|
| Controller validate/status/context/start and pre-closure validate | Exit 0 | Structural workflow only |
| node --import tsx --test tests/project-master-wire.test.ts tests/integration/project-master.test.ts (final) | Exit 0; 5/5, no skips; 30619.044 ms | Four pure groups plus actual migrated REST/MCP worker, all 48 pairs |
| pnpm test | Exit 0; 293/293, no skips; 45245.8233 ms | Full pure regression suite; later service/fixture/client refinements verified by targeted/type/lint checks |
| pnpm typecheck (final) | Exit 0 | Fumadocs plus tsc --noEmit; no full build |
| pnpm lint | Exit 0; zero errors, 127 existing warnings | No new warning |
| pnpm exec eslint on changed TS/TSX files and final route/worker/tracking/milestone checks | Exit 0; two preexisting UI warnings in full changed-file set | New wire/services/routes/MCP/fixtures are clean |
| money_inventory.py --write and verification; verify_money_inventory.mjs | Exit 0; 415 columns, 1695 files, 1295 consumers, 25716 occurrences | Source hashes/lines/Drizzle coverage only |
| verify_legacy_money.mjs | Exit 0; nine checks | Legacy import gate |
| git diff --check | Exit 0 | LF/CRLF conversion notices only |
| Fixture database count and pg_ctl stop | Zero remaining random databases; cluster stopped | No broad filesystem cleanup |
| Git origin divergence after fetch | 0 ahead / 0 behind | Commit/push verified after closure |

Early checks caught mismatched inferred schema import/column names, missing direct
optional-field descriptions, fixture assumptions about pool export/generic MCP
error status, and an omitted list-members positive case. These were corrected and
all affected checks rerun. Self-review caught unsafe query identifier coexistence,
empty child patch behavior, label references, chronology preflight, int32 total
history, correct mark-paid client routing and tracking limit. A temporary export
script included in TypeScript discovery was removed before the final passing
check. Encoding damage from an intermediate Windows text read was repaired against
original Git text; final UI diffs retain existing English/Unicode content.

## Review and handoff

See MON-093-review-1.md for actual implementing-assistant self-review. No blocker
remains in this slice. Fixed cents and ISO labels do not qualify currency-scale
migration, full-int64, production IRR, independent financial/release or high-volume
acceptance. Existing removed-member/dangling-label/inconsistent history requires
explicit repair. Timer stop-and-save remains two client requests, without an
invented combined retry contract. Parent MON-027 and MON-094 retain integrated
billing/profitability and financial gates. No browser/dev/build/Docker/provider,
schema generation, production migration or deployment was run.

Complete controller check/submit/self-review/done, commit MON-093 changes, push
origin/master as authorized and verify remote SHA. Then stop; next is MON-094.
