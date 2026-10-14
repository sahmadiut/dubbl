# MON-165 attempt 1 - FX revaluation and remaining background composition

## Identity and scope

2026-10-14, Asia/Tehran. Implementing operator: coding-assistant (Codex), self-review.
Entry master HEAD 58b8f64ba16950405c92128965addafefea8ab75; clean tree.
The user authorized completing and pushing the next task, then said continue.
Live validate/status/next selected MON-165; started with owner coding-assistant.
Read root instructions, START_HERE/controller/project/repository map, backend role,
MON-007/MON-164 evidence, actual source, task and relevant domain registries.
Memory controller-task skill guided one-task/scoped delivery. No subagent or
independent reviewer was used. MON-159/008 remain separate integration acceptance.

## Acceptance mapping

1. fx-revaluation now runs saved document reads, qualification, rate lookup,
   accounts, numbering, both journals, links and owner audit on one transaction.
   revaluationExposure reuses settlement recognition/GRNI and actual carrier
   history checks. Recognition GL already contains base minor amounts; it is
   never converted again or reconstructed from today's issue-date reference FX.
   Remaining carrying is original control less cumulative rounded release.
   Only outstanding document units convert at period-end exact FX with explicit
   source/base scales. Bigint per-control aggregates permit oversized intermediate
   cancellation; individual conversions/final deltas/journal sides remain safe
   numeric values. New base legs save identity FX and reverse verbatim.

   Live org/owner, active correctly typed base controls and unrealised accounts,
   qualified saved FX/aliases/version/direction/provenance, scoped historical
   account/dimension refs and both posting dates are required. NO KEY UPDATE org
   lock serializes domain writers while permitting FK KEY SHARE for period-row
   inserts. A short SHARE period/fiscal-year table lock protects absent-row
   insertion/replacement/close races, since legacy period writers lack a common
   organization lock. Both entries/link/audit/account creation roll back together.
   Replay qualifies original/reversal headers, audit provenance, balanced saved
   identity-base legs and exact mirror before no-op. Changed reversal date or
   incomplete/corrupt historical pairs reject; changed reference FX never reprices.

   Current balances cannot reconstruct prior periods after later allocations:
   later partial/full settlements reject, including paid documents; future-issued
   docs are excluded. Bills qualify saved line/header sums, supplier payable equal
   to total and original AP equal to the single exact conversion. No immutable
   supplier-payable/tax-kind snapshot exists: reverse-charge payables below total
   and ambiguous split-GRNI conversion residuals reject unchanged. Existing public
   settlement bill/GRNI behavior is untouched. This limitation closes corrupt
   unpaid bill balances without guessing old tax policy or rewriting history.
2. Actual Trigger/lib composition was inspected, mapped and executed through
   meaningful nonempty fixtures. Recurring journals now serialize org/template
   numbering across different templates; retained creator must still be a member.
   References/periods use the transaction; generation IDs/count/date audit commits
   atomically. Fixed stored identity-FX/tagged amounts and locked/closed occurrence
   skip-and-advance remain. Recurring invoice/payable delegates retain their exact
   atomic catch-up services and post-commit invoice email behavior.

   Low-balance sweeps retain SQL-text full-int64 cached balances/thresholds and
   exact saved-currency formatting. Live org/account lock/recheck and per-user
   UTC-day deduplication/in-app inserts commit atomically; email follows commit.
   Invalid currency/insert failure skips only that account and remains retryable.
   Overlapping sweeps generate one alert. Payroll completion, accrual posting,
   payment schedule processing and stock costing are authenticated shared REST/
   MCP services, not independent Trigger workers. Actual payroll posting/output,
   accrual target/replay, payment settlement/status, report preflight/recorded local
   delivery, budget alert and FIFO/average/assembly/cost conservation fixtures pass.

   New migrated FX fixture joins authenticated REST invoice creation, linked SDK
   MCP bills/recognition/payments, actual worker, REST/MCP entry reads and SQL text.
   Partial invoice 1250 at 1.2 recognizes 1500, pays 500/release 600, carries 900;
   period-end 1.3 values 750 at 975 -> gain 75. Bill 2500 moves AP by -250. Edited
   issue reference rate 0.9 leaves saved history unchanged. Signed movement cases,
   USD/JPY/KWD/synthetic IRR scales and raw 3000000001 preserve exact low digits.
   A three-unit invoice at 1.2 recognizes 4, releases 1, carries 3; period-end
   remaining value 2 posts loss 1. Four 6000000000000001-unit opposite exposures
   cancel oversized deltas exactly; a ten-unit remainder posts 9. Standard-tax
   bill succeeds; reverse-charge without immutable payable evidence rejects.
   Unsafe individual/group values, altered invoice/bill totals/dues, bad recognition
   money/FX/provenance/tenant dimensions, missing rates/owner/deleted org, both-date
   locks/closed year, corrupt replay mirror and injected reversal/audit faults leave
   full SQL-text financial snapshots unchanged. Two workers post one pair; actual
   absent-row period insertion wins before posting. Global sweep continues valid
   orgs despite invalid ones. Recurring creator-null and separate-template race
   regressions pass; bank overlap produces one in-app notice.
3. BACKGROUND_COMPOSITION_CUTOVER maps all actual entry points, public parity,
   units/exceptions, locks, provider-free verification and explicit limits.
   MONEY_MANIFEST/TEST_MATRIX, bank/recurring contract amendments and money README
   are current. New background-composition source guard prevents float repricing,
   duplicate service writers and invented Trigger workers. Regenerated
   MONEY_BOUNDARIES records current source hashes/lines. No schema/migration,
   public operation/tool, amount rescaling or production flag change.

## Verification

All commands ran from D:/Projects/dubbl. Dedicated synthetic trust-authenticated
PostgreSQL 18 cluster:
C:/Users/Sajjad/AppData/Local/Temp/dubbl-mon165-pg-01bab0f47f93420284cecce6be8ac2ac.
Loopback 127.0.0.1:55481; synthetic dubbl_ci superuser; UTC;
max_locks_per_transaction=256, jit=off. Explicit TEST_DATABASE_URL and PG_BIN.
Wrappers create/migrate/drop random databases; application .env/DB was not read.
Fixture-only corruption disables/re-enables exact sync/input guards in one
disposable transaction before worker execution. Fault triggers are removed in
finally. Temporary test output logs contain synthetic fixture data only.

| Command | Actual result | Limits |
|---|---|---|
| node --import tsx --test --test-concurrency=2 with eleven explicit integration files: recurring-journal-wire, recurring-invoices, recurring-payables, payroll-integration, accrual-schedules, scheduled-payments, report-schedules, budget-alerts, inventory-integration, background-bookkeeping, payment-settlements | Exit 0, 11/11, 68.314 seconds | Actual shared/domain composition; not entire integration suite |
| Same runner with fx-revaluation, recurring-journal-wire, recurring-invoices, recurring-payables | Exit 0, 4/4, 40.805 seconds | After recurring numbering/reference/period/audit changes |
| Final runner with fx-revaluation, recurring-journal-wire, bank-accounts | Exit 0, 3/3, 33.478 seconds | Enhanced creator-null/numbering/bank race |
| Joint fx-revaluation and payment-settlements after bill qualification | Exit 0, 2/2, 18.860 seconds | Public settlement contracts remain |
| Final fx-revaluation after standard/reverse-tax and activity-observer correction | Exit 0, 1/1, 18.021 seconds | Final worker fixture |
| pnpm test | Exit 0, 536/536, 22.438 seconds | Full pure/static suite |
| pnpm typecheck | Final exit 0 | MDX generation and tsc only |
| pnpm exec eslint on nine changed/new TypeScript paths | Exit 0, no output; final changed fixture rechecked | Task-owned source/tests |
| pnpm lint | Final exit 0, zero errors/90 warnings | Unchanged-file warnings; owned lint clean |
| python .agentic/scripts/money_inventory.py --write; then without args | Exit 0; 415 columns, 1571 consumers | Source inventory, not transitive correctness proof |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0 | Drizzle columns, all consumer hashes and occurrence/source lines |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0, 9 checks | Existing regression gate |
| Scoped local registry/README link check | Exit 0, 225 links | Local path existence |
| python .agentic/agent.py validate | Exit 0, 218 tasks | Structural controller validation |
| git diff --check | Exit 0 | Whitespace; normal LF/CRLF notices |
| git fetch origin master; git rev-list --left-right --count HEAD...origin/master | Exit 0, 0 0 before delivery | Actual remote synchronization |
| psql disposable database count; pg_ctl fast stop | Zero fixture databases; exit 0 cluster stop | Dedicated cluster stopped; temporary files retained |

Initial scale expectations omitted JPY/KWD minor-scale factors; corrected literal
expected deltas. Initial corrupt-FX seeding hit sync and exact-input DB guards;
both are now disabled/restored only for disposable negative fixtures. Typecheck
caught nullable replay audit narrowing; explicit never-returning function fixed it.
Initial absent-row period race exposed FK/org-lock deadlock; NO KEY UPDATE fixes
the actual lock cycle. A later race observer cached pg_stat_activity within its
transaction; pg_stat_clear_snapshot now refreshes every observation. Initial
static guard referenced a nonexistent delegate name; corrected to actual
createSettlementPaymentInTransaction. These failed attempts are not passed checks.
One interrupted tool session lost live process handles, so final checks were rerun
with local logs; no unseen result was claimed. Incorrect path probes and rejected
atomic documentation patches were corrected. Final listed checks passed.

## Review and handoff

Self-review: MON-165-review-1.md. No remaining scoped blocker. Complete controller
checks/submit/self-review/done, scoped commit and authorized push origin/master;
confirm remote SHA/clean tree, report actual next task and stop. No invented SHA,
hosted CI, deployment, provider or independent accounting approval.

Shared period-table locks briefly block period configuration across organizations.
Current-balance historical reconstruction, reverse-charge/ambiguous GRNI payable
qualification, remediation of old incomplete revaluation pairs, full-int64 business
posting, production IRR and external email exactly-once delivery are not promised.
No full build/dev server, production/application database, Trigger run/deployment,
Docker, provider call, browser/printer qualification or peer/human review occurred.
Local PostgreSQL 18/Node verification does not establish hosted PostgreSQL 16/CI.
MON-159 and MON-008 keep all independent final acceptance.
