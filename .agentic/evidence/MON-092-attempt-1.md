# MON-092 attempt 1 - exact CRM deal and analytics contracts

## Identity and selection

2026-10-06, Asia/Tehran. Actual operator coding-assistant, D:/Projects/dubbl,
master, entry HEAD a317a27. User requested completion and push of the next task.
Entry tree was clean; controller selected MON-092 and claim succeeded. Read root
and nested instructions, START_HERE/controller/project/map, backend role,
MON-011 attempt/review, ADR-006, task and current CRM/schema/client sources.
Origin fetch found no divergence. During this work separate controller/backlog
edits appeared in the shared workspace. They were preserved and excluded from
this task's planned commit; no ownership or verification of those edits is claimed.
Evidence is prepared before the authorized implementation commit/push. No
delegation or independent/human approval is claimed.

## Implementation

- crm-wire.ts supplies strict described UUID/metadata/stage/deal/activity/query
  schemas, canonical valueCentsMinor aliases, safe legacy bridge, saved deal
  preflight and bigint sums/averages/stage distribution. Probability stays
  nullable integer percent. Summary/analytics carry currency and reject mixed
  scalar totals unless a currency group is selected.
- crm.ts unifies all sixteen operations in scoped direct-Drizzle services,
  repeatable-read snapshots and organization-first mutation transactions.
  Nested contacts/current member/pipeline references are qualified; public user
  selection excludes passwordHash/auth internals. Pipeline reads exclude foreign
  and deleted deals, contacts add nullable creditLimitMinor, activities are scoped
  to live roots, and mutations await transactional audit/output checks.
- Nine existing REST route files retain operation/envelope/status behavior via
  the shared services. crm MCP registration retains existing names and adds five
  missing parity tools (pipeline create/update/delete, deal delete, analytics).
  Every operation uses wrapTool, AuthContext, strict described input schemas.
- Pipeline default updates serialize, live stage references prevent removal,
  populated pipelines cannot delete, and same-state closing retries preserve
  timestamp/audit. Opposite outcomes clear the old timestamp, preventing ambiguous
  new histories. Stage movement retains existing lifecycle timestamp behavior.
- CRM screens use exact fixed-cents currency-tagged presentation and bigint
  weighted values; drawer sends exact parsed cents rather than float multiplication.
  CRM list/analytics expose currency selection and surface classified errors.
- CRM_WIRE_CONTRACTS maps every input/output/unit/range/authorization/retry/
  compatibility limitation. MONEY_MANIFEST, money README, CI_RUNBOOK and generated
  source-hash inventory record adoption. No schema edit, migration or flag change.

## Acceptance mapping

1. CRM_WIRE_CONTRACTS documents all sixteen REST/MCP pairs, legacy/exact aliases,
   fixed cents versus ISO labels, numeric nullable percent, dates/UTC instants,
   query spelling/defaults/envelopes, safe bounds, explicit currency groups,
   auth, atomic audit, retry/correction rules and unsupported history.
2. Four pure groups plus crm-worker.ts invoke every actual REST/MCP operation,
   full SDK registration and API-key authentication. Fixtures verify described
   strict schemas, numeric/exact/agreed values, safe maximum, USD/JPY labels,
   summary versus list filters, exact average/conversion, public member/contact
   joins, custom roles, expired/bad keys, foreign organization headers, all foreign
   root operations, new/changed/saved cross-org references and nested foreign deals.
3. Invalid aliases, dates, percent, stage/schema/query/scope and unsupported
   historical values leave complete pipeline/deal/activity/audit snapshots unchanged.
   Unsafe aggregate/mixed currencies fail classified 422 without rounding.
   Actual failing audit triggers roll back all ten mutation types in both
   transports. Returned money faults roll back all six deal mutation types;
   stage faults roll back all three pipeline writes; activity author faults
   roll back activity creation. Concurrent close/default/delete and same-state
   closing retry fixtures preserve valid state/history.

## Verification

Commands ran in D:/Projects/dubbl. New PostgreSQL 18 cluster bound only to
127.0.0.1:55492 with UTC timezone and synthetic identity. Explicit
TEST_DATABASE_URL lets the existing harness create/migrate/drop random fixture
databases; no configured application DB or .env credentials were read/migrated/
seeded/reset. No customer data, live provider, build, Next dev, Docker, screenshot
or deployment. No schema changes requiring drizzle generation.

| Actual command/check | Result | Limits |
|---|---|---|
| Controller validate/status/context/start and pre-closure validate | Exit 0; 144 tasks valid | Structural workflow only; concurrent controller changes not reviewed here |
| node --import tsx --test tests/crm-wire.test.ts tests/integration/crm.test.ts (final) | Exit 0; 5/5, no skips; 9367.5057 ms | Four pure groups plus all sixteen operation pairs in actual migrated DB worker |
| pnpm test | Exit 0; 289/289, no skips; 8159.8185 ms | Full pure regression suite after final service/test changes |
| pnpm typecheck | Exit 0 | Fumadocs generation plus tsc --noEmit, no full build |
| pnpm lint | Exit 0; zero errors, 127 existing warnings | Fewer than prior 129; four preexisting warnings in touched CRM UI files |
| pnpm exec eslint on changed services/wire/MCP/routes/tests/CRM UI/drawer | Exit 0; zero errors, four preexisting UI warnings | No new warning |
| money_inventory.py --write and verification; verify_money_inventory.mjs | Exit 0; 415 columns, 1686 files, 1286 consumers, 25672 occurrences | Lexical/hash/Drizzle qualification only |
| verify_legacy_money.mjs | Exit 0; nine checks | Legacy import gate |
| git diff --check | Exit 0 | LF/CRLF conversion notices only |
| Fixture database count; pg_ctl stop | Zero remaining random databases; new cluster stopped | Temp cluster files retained; no broad cleanup |
| Git origin divergence after fetch | 0 ahead / 0 behind | Commit/push verified after closure |

Initial fixture failure was an omitted required activity type in a foreign-root
negative test; corrected test arguments and reran. Initial changed-file lint
identified a new synchronous loading setter in the analytics effect and leftover
unused generated-route/test imports; corrected those and added meaningful saved
pipeline-history coverage. During self-review, delete outputs were changed to
validate returning rows so injected invalid money/stages cannot commit. All
affected pure/transport/type/lint checks above ran after those corrections.

## Review, limitations and handoff

See MON-092-review-1.md for actual implementing-assistant self-review. No CRM
slice blocker remains. Fixed cents/ISO label preservation does not qualify
currency-scale migration, full-int64, production IRR, independent financial or
release acceptance. Legacy corrupt/lost-member history requires explicit
remediation; unpaginated summary/history loading and repeated scoped joins retain
high-volume qualification limits. Parent MON-027 and other financial tasks retain
their integration gates. No human approval or deployment is implied.

Complete controller checks/submit/self-review/done, commit only MON-092 files,
push origin/master as authorized and verify remote SHA. Preserve concurrent
unrelated controller/backlog work. Then stop; use the controller's next task,
whose ordering can include queued parent integration under the separate edits.
