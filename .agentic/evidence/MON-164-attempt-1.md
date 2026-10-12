# MON-164 attempt 1 - scheduled bookkeeping and auto-reversal consumers

## Identity and scope

2026-10-13, Asia/Tehran. Implementing operator: codex (coding assistant), self-review.
Entry master HEAD: 2d0401fc688e50649dff76d34c19b2182c5a037b; clean tree.
The user authorized completing and pushing the next task. Live controller selected
MON-159. Read root/nested instructions, START_HERE/controller/project/repository
map, dependency MON-007 evidence, backend role and actual jobs/services/contracts.
Memory controller-task skill guided the bounded delivery workflow.

Source inspection found duplicate scheduled depreciation/loan/revenue writers,
incomplete auto-reversal FX copying, and a separate FX revaluation transaction/
saved-rate problem. Added MON-164/165 with original prerequisites/source sections,
validated and split MON-159 through the controller. Continued MON-164 as the
bounded implementation within the originally selected background scope. MON-159
retains all original criteria and independent final acceptance. MON-165 covers
FX revaluation and remaining recurrence/payroll/accrual/payment/report/alert/costing
worker composition. No completed child substitutes for MON-159 or MON-008.

## Acceptance mapping

1. bookkeeping-maintenance now delegates to shared asset depreciation, loans and
   revenue-schedule services. maintenance-context resolves an actual uncustomized
   owner on a live organization for domain permissions/audit. Depreciation's new
   internal adapter reuses existing load/history/post/record, exact method and
   convention calculation, asset/organization/period locks and atomic monthly
   deduplication. Missing posting accounts/CWIP/usage/future service dates skip.
   Saved unsafe/inconsistent/revalued history fails unchanged. Loan/revenue
   catch-up uses explicit ordered targets, shared saved allocation/currency/
   tenant/lock/audit/replay guards; a rejected period stops that schedule. Prior
   successful periods stay committed. Numeric count envelopes remain; successful
   concurrent target replay can count as processed without creating another
   journal. Bank reconciliation reuses the same owner context. Alert delegates
   retain their existing services.
2. Auto-reversal serializes organization then entry, rechecks status/deletion/
   link/due date, validates saved amounts/currency/exact FX/provenance and checks
   the reversal period inside its transaction. Historical tenant references are
   checked on that transaction via optional journal-references executor; existing
   callers retain their default behavior. Mirrors every saved amount, description,
   account, cost center, project and exact/legacy FX field without reapplying FX.
   Original closed period can unwind into an open reversing date. The current
   DB FX trigger requires conventional legacy transaction provenance; unsupported
   metadata rejects rather than being silently regenerated. Actual owner audit,
   mirrored legs and bidirectional links commit/roll back together. Invalid entries
   remain due; other targets continue. Scheduled failures use existing counts.

   New migrated background-bookkeeping fixture composes actual maintenance with
   real authenticated REST writes/reads and linked registered SDK MCP. USD/JPY/
   KWD/synthetic IRR assets preserve raw cents: 9007199254740991 / 3 produces
   3002399751580330 and leaves 6004799503160661; 3000000001 / 3 produces
   1000000000. Loan and revenue allocations preserve 1000000000, 1000000000,
   1000000001 and complete at 3000000001. SQL text, numeric/Minor aliases, final
   statuses, unchanged cached bank balance and repeated run snapshots agree.
   Real manual/cron target races create exactly one loan/revenue journal; two
   auto-reversal sweeps create one mirror. Saved 1.234567 KWD-tagged GL and
   dimensions survive verbatim; REST fixed-two decimal and MCP numeric-minor
   envelopes remain distinct. An original with null creator is still reversed
   with owner-attributed audit. Locked original/open reversal and historically
   inactive owned account work. Unsafe/mismatched/foreign/usage/ownerless assets,
   corrupt loan allocations, revenue currency disagreement, locked reversal,
   missing lines, unqualified FX, foreign account/project, unbalanced journal and
   injected audit failure leave complete SQL snapshots unchanged. Removing the
   audit fault lets the valid entry retry once.
3. BACKGROUND_BOOKKEEPING_CUTOVER maps actual Trigger delegates, shared public
   parity and explicit units/limits. MONEY_MANIFEST, source coverage/task index,
   TEST_MATRIX and regenerated MONEY_BOUNDARIES are current. New source guard
   prevents duplicate floating money writers and lost metadata/delegate adoption.
   No schema/migration, new public tool/operation, amount rescaling, production
   flag, full-int64 business or historical remediation change.

## Verification

All commands ran in D:/Projects/dubbl. Dedicated synthetic trust-authenticated
PostgreSQL 18 cluster:
C:/Users/Sajjad/AppData/Local/Temp/dubbl-mon164-pg-da021aa911154de4aeb615f64b4cbc01.
Loopback 127.0.0.1:55479; synthetic dubbl_ci superuser; UTC;
max_locks_per_transaction=256, jit=off. Explicit TEST_DATABASE_URL and PG_BIN
selected this cluster. Wrappers create/migrate/drop random databases. No application
.env/database was read or changed. Fixture-only invalid-FX seeding disabled/re-enabled
the exact sync trigger inside one disposable transaction before worker execution.
The injected audit trigger/function were removed before final successful retry.

| Command/procedure | Actual result | Limit |
|---|---|---|
| node --import tsx --test --test-concurrency=2 tests/integration/{background-bookkeeping,asset-depreciation,loans,revenue-schedules,journal-lifecycle-wire,journal-integration,asset-loan-integration}.test.ts (seven explicit PowerShell arguments) | Exit 0, 7/7, 260.892 seconds | Scoped shared/domain regressions, not the entire integration suite |
| node --import tsx --test tests/integration/background-bookkeeping.test.ts | Final exit 0, 1/1, 102.539 seconds | Final enhanced manual/cron races and audit/FX/dimension negatives |
| pnpm test | Exit 0, 513/513, 61.648 seconds | Full pure/static suite |
| pnpm typecheck | Final exit 0 | MDX generation and tsc only |
| pnpm exec eslint on five changed/new lib files and three new test files | Final exit 0, no output | All owned TypeScript paths |
| pnpm lint | Exit 0, zero errors/92 warnings | Warnings in unchanged files; changed-file lint is clean |
| python .agentic/scripts/money_inventory.py --write; then without arguments | Exit 0 | 415 columns, 2079 scanned files, 1562 consumers, 30335 occurrences |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0 | Drizzle columns, 1562 source hashes and all occurrence lines |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0, 9 regression checks | Existing legacy helper gate |
| Scoped registry link check | Exit 0, 6 links resolve | Actual local targets |
| python .agentic/agent.py validate | Exit 0, 215 tasks | Structure only; repeated after completion |
| git diff --check | Exit 0 | Whitespace; expected CRLF notices |
| psql fixture database count; pg_ctl fast stop | Zero fixture databases; exit 0 stop | Dedicated cluster stopped; temporary files retained |
| git fetch origin master; git rev-list --left-right --count HEAD...origin/master | Exit 0, 0 0 before delivery | Actual remote synchronization before commit |

Initial fixture assertions assumed SQL numeric text was canonical "1" and tried
creating a EUR-source schedule with USD accounts; corrected the literal decimal
comparison and seeded the currency change after valid creation. Initial typecheck
caught nullable original audit user, an unsupported project field and generic
row-sort typing. Resolved by actual-owner audit context, supported project input
and stable SQL ordering. These are recorded failures, not passed checks. Final
focused/joint fixtures and final typecheck/ESLint passed. Incorrect initial lookup
paths, PowerShell glob probes, a PG_BIN typo in an early run and one rejected atomic
documentation patch were corrected and are not successful verification claims.

## Review and handoff

Self-review: MON-164-review-1.md. No scoped blocker remains. Complete controller
check/submit/self-review/done, commit task-owned files and push origin/master;
verify remote SHA and clean tree, report the live next task, then stop.
No preassigned delivery SHA or hosted CI success is invented.

MON-165/159/008, production IRR, full-int64 workflows, historical unit remediation,
accounting/migration/security/localization/release qualification remain separate.
Local PostgreSQL 18/Node checks do not establish hosted PostgreSQL 16 or CI results.
No full build, dev server, Docker, provider call, Trigger run/deployment, browser
qualification or independent peer/human/accounting approval was performed.
