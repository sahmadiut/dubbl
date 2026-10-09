# MON-028 attempt 1 - consolidation and auxiliary integration acceptance

## Identity

2026-10-09, Asia/Tehran. Operator: coding-assistant. Entry HEAD
71f53c5975bcba367d681d2b5ac971a7f6e1a4a3, master, clean working tree. MON-026 was already completed/committed at
entry; older memory describing a partial attempt was superseded by live state.
Review is the implementing assistant's self-review, not a peer/human review.

## Implementation and inspected scope

Controller validate/status/next/context selected MON-028 after MON-095..099.
Read root/nested instructions, START_HERE, controller/project/repository map,
backend role, task/dependency evidence, ADR-006, SOURCE migration/API-compatibility
sections, money manifest, five child contract registries and current services,
schemas, actual REST routes, MCP registrations and fixture harness.

Preserved the independently completed child implementations and qualified their
combined behavior rather than duplicating their domain services. Added a parent
actual-transport fixture and CONSOLIDATION_AUXILIARY_INTEGRATION_CONTRACTS mapping
all 31 REST/MCP pairs plus generation/settings. Updated current contract registries,
money README, verification matrix, CI runbook and machine source inventory.

Two integration defects required bounded production changes:

- Organization currency changes checked journals/payroll/assets/loans but missed
  unposted accrual roots. Accruals have no currency snapshot; changing base before
  posting could reinterpret their history or strand their accounts. Shared settings
  now reject any accrual schedule, including cancelled rows, with 409 under the
  organization lock. REST and both existing MCP settings operations share it;
  descriptions explain the gate. Empty organizations can still change currency.
- Serializable report recalculation read period/year guards without protecting
  concurrent insertions of absent rows. It now takes SHARE table locks before
  the first snapshot and parent organization lock. Locking after an initial SELECT
  would retain an earlier serializable snapshot after waiting. In-flight period
  and closed-year insertions are observed before computation, returning 422 with
  unchanged report/domain/GL/audit state. Existing bounded retries remain.

The combined worker creates accrual 1250 using REST exact-major text and revenue
2501 using MCP numeric/exact cents, then replays creation across transports. Three
concurrent accrual/revenue posting pairs allocate [416,416,418] and [833,833,835].
Six distinct journal numbers contain exactly two balanced USD identity-rate legs.
Actual REST/MCP report figures agree: revenue=2501, expenses=1250, netIncome=1251,
balanceCheck=0, with additive exact aliases. Three recurring bills and three
expense drafts have no GL earnings; concurrent bill catch-up returns [0,3].
Completed generation and targeted posting retries preserve snapshots.

A synthetic custom prefix rule eliminates 1250 with variance 1251; returned and
persisted worksheet amounts agree. Deleted-rule recalculation cleans saved entries
without editing six member journals. Audit-trigger faults roll back replacement
deletion and schedule creation across transports. Whole-slice snapshots cover
currency/history/create races, unknown/conflicting/unsafe input, permissions,
foreign roots and actual period/year insertions. Child tests retain every operation's
additional account/history/FX/output/storage/auth/period/fault cases.

## Acceptance mapping

1. Parent registry indexes every operation and five full field maps, distinguishes
   REST-major versus MCP-cents schedule input and both-transports major recurring
   prices, documents fixed cents/Minor aliases, signed/null policies, safe numeric
   bounds, FX metadata/ranges, quantities/basis points, dates, currency/history,
   retries, scope/atomicity and remaining auxiliary ownership.
2. Combined actual API-key REST/full registerAllTools SDK worker, all five child
   workers and organization settings pass in disposable migrated PostgreSQL.
   Legacy/exact/cross-transport clients, described strict registration, custom
   permissions, API-key tenant precedence and foreign roots are exercised.
3. Safe numeric outputs serialize with matching exact aliases; bigint allocations,
   products and text SQL sums preserve units/precision. Unsupported inputs and
   output/audit/storage/history/lock failures reject without commit. Parent
   SQL snapshots include settings, schedules, periods, recurring/document/numbering,
   journals/legs, groups/members/rules/eliminations and audit. Currency races have
   one valid winner; deterministic period insertion races reject before mutation.

## Verification

All commands ran in D:/Projects/dubbl. A fresh PostgreSQL 18 UTC cluster bound
only 127.0.0.1:55428 with synthetic dubbl_fixture identity supplied explicit
TEST_DATABASE_URL. The harness created/migrated/dropped random dubbl_ci_ databases.
The configured application database and .env credentials were not used. Parent
worker disables provider credentials and IRR rollout; faults are synthetic and
scoped only to random fixture databases. Temporary cluster files are outside Git.

| Actual command/check | Observed result | Limit |
|---|---|---|
| Controller validate/status/next/context/start and pre-closure validate | Exit 0; 173 tasks valid; MON-028 selected/claimed | Structural checks, not independent accounting proof |
| node --import tsx --test --test-concurrency=1 tests/integration/consolidation-config.test.ts tests/integration/consolidation-report.test.ts tests/integration/accrual-schedules.test.ts tests/integration/revenue-schedules.test.ts tests/integration/recurring-payables.test.ts tests/integration/organization-settings.test.ts | Exit 0; 6/6, zero skips; 94581.0 ms | Five child workers and settings regression after production guards |
| node --import tsx --test tests/integration/consolidation-auxiliary-integration.test.ts, final | Exit 0; 1/1, zero skips; 13106.7 ms | Parent financial, race, permission and whole-slice fault assertions |
| node --import tsx --test tests/consolidation-report-wire.test.ts tests/accrual-wire.test.ts tests/revenue-wire.test.ts tests/recurring-payable-wire.test.ts tests/organization-wire.test.ts | Exit 0; 13/13, zero skips | Focused pure syntax/range/rounding/allocation checks |
| pnpm typecheck, including final fixture and tool changes | Exit 0 | MDX generation + tsc; no build |
| pnpm lint, final | Exit 0; zero errors, 106 existing warnings | All warnings outside changed source/fixture files |
| Initial pnpm exec eslint on changed settings/report services, organization tools and parent fixtures | Exit 0; no warnings | Final full lint also covers added permission assertion and consolidation description |
| python .agentic/scripts/money_inventory.py --write; node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0; 415 columns, 1889 scanned files, 1415 consumer hashes, 27076 occurrences | Source-only inventory, not migration qualification |
| node .agentic/scripts/verify_legacy_money.mjs | Exit 0; nine regression checks | Legacy-money import/math gate |
| git diff --check | Exit 0 | Git LF/CRLF notices only |
| git fetch origin master; git rev-list --left-right --count HEAD...origin/master | Exit 0; 0 ahead/0 behind before commit | Final remote SHA/tree verification follows authorized commit/push |
| Fixture database count; pg_ctl -m fast -w stop | Zero random fixture databases; server stopped, exit 0 | Temporary cluster files retained outside Git |

The parent fixture passed before and after strengthening the denied-operation
snapshot timing and adding explicit custom-permission assertions. No failed
behavioral test remains. No schema changed, so migration generation was unnecessary.
No build, dev server, Docker, full repository test suite, live provider, application
DB mutation, hosted CI dispatch, deployment or production IRR change was run.

## Review and handoff

See MON-028-review-1.md for actual self-review. All three bounded parent criteria
are supported; no remaining task blocker. SHARE locks may delay period/year edits
across organizations; performance and PostgreSQL16 runtime qualification are not
claimed. Existing symmetric cap/custom-rule economics, original revenue deferral,
aggregate multi-schedule policy, historical remediation, full-int64, IRR rollout
and independent accounting/security/production acceptance remain separate gates.

Finish controller checks/submit/self-review/done, validate/status, stage task-owned
files, commit/push to origin/master, verify remote SHA and clean tree, then stop.
Next current ready task is MON-029. Fixture DB cleanup/server stop are verified
before final closure; retained temp cluster data is outside the repository.
