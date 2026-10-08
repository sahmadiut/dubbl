# MON-123 attempt 1 - exact budget notification contracts

## Identity

2026-10-08, Asia/Tehran. Operator/reviewer: codex. Controller-selected bounded
MON-123; entry master HEAD `afda0e5fa5039ce6f926937457d0e03e10dab8b2`, clean tree.
No unrelated edits were present. Self-review, without independent accounting,
human, deployment or production qualification.

## Implementation and scope

Inspected root/nested instructions, START_HERE/controller/project/repository map,
task/backend role, MON-011 evidence, ADR-006, money manifest, actual budget CRUD
and report contracts, bookkeeping/Trigger consumers, notification sender and
registered MCP budget tools. Reused budget report dates, currency, stored-money,
rounding and paired-money helpers; preserved absolute net-activity semantics.

- `budget-alert-wire.ts`: exact bigint rounded threshold product and signed-net
  absolute actual, safe numeric fields plus agreeing Minor strings, currency-aware
  exact decimal body. No Number-based monetary multiplication or sum conversion.
- `budget-alerts.ts`: text SQL sum, org/account/period/posted/deleted predicates,
  live scoped account/fiscal validation, stored money/date/currency/threshold and
  shape bounds. All selected evaluations/payloads preflight before writes.
  Notifications commit atomically; shared advisory transaction lock and READ
  COMMITTED post-lock reads deduplicate across concurrent scoped/scheduled calls.
  Per-user deduplication allows missed/new recipients while honoring historical
  read/deleted in-app rows. Actual ledger/budget/audit rows remain unchanged.
- New REST POST `/api/v1/budgets/check-alerts` and registered MCP
  `check_budget_alerts`: empty-object input, `manage:budgets`, AuthContext org,
  shared direct DB logic, count/evaluation envelope and classified errors.
- `budget-wire.ts`: optional nonnegative int32 integer threshold percent or null
  for existing REST/MCP create/update. Omitted create preserves default 100;
  omitted update preserves the value; invalid configuration rejects pre-write.
- `notifications/send.ts`: extracted preference/email/digest handling so budget
  notification delivery occurs after commit. Generic `sendNotification` retains
  its existing insertion/return behavior. Delivery errors cannot erase committed
  alerts or inflate replay counts; digest/immediate delivery remains best effort.
- Existing bookkeeping/Trigger callers still receive `{checked, alerted}`; only
  their shared budget implementation changes. No new general maintenance tool or
  unrelated posting/depreciation/revenue/banking work was added.
- Added four pure contract groups and an actual API-key/registered-MCP PostgreSQL
  fixture. Existing CRUD mock/SDK tool-count assertions reflect seven budget tools.
  Added BUDGET_ALERT_WIRE_CONTRACTS, manifest pointer and refreshed inventory.

The contract registry maps all boundaries, ranges, aliases, currency policy and
selection/notification semantics. No schema/migration, currency history rescale,
production IRR flag, public exact-only full-int64 client or sunset is introduced.

## Acceptance mapping

1. BUDGET_ALERT_WIRE_CONTRACTS documents empty input/public AuthContext, threshold
   CRUD controls, scheduled counts, three numeric/Minor pairs, percent/count units,
   safe coexistence range, inherited currency/display scales and failure behavior.
2. `budget-alerts-worker.ts` invokes actual REST routes and linked MCP SDK tools,
   numeric REST and exact REST/MCP budget writers, notifications GET, scoped check
   and internal scheduled check. It verifies user/API-key/custom-permission auth,
   spoofed tenant input/header, other-org budgets and malformed nested account/GL/
   fiscal references. CRUD/report regression suites also pass.
3. Pure fixtures verify safe-max 50% tie rounding, signed net activity, zero/negative
   budgets, exact currency bodies, malformed/unsafe inputs and configuration.
   DB fixtures verify text sums with unsafe intermediate aggregates, threshold
   overflow, both actual overflow signs, stored int64 history, bad dates/currency/
   foreign/deleted refs and unchanged failed snapshots. A second-recipient trigger
   failure rolls back the first notification and creates no digest. Concurrent
   REST/MCP/direct calls create one batch; late recipients and read/deleted rows
   deduplicate correctly. Digest queue failure preserves committed in-app counts
   and replay behavior. Successful checks leave financial/audit state unchanged.

## Verification

All commands ran in D:/Projects/dubbl. Temporary PostgreSQL 18 trust cluster:
task_mon123 on 127.0.0.1:55523, UTC. Explicit TEST_DATABASE_URL selects this server;
fixtures create/migrate/drop random dubbl_ci_ databases. Application DATABASE_URL
was not read or used. Synthetic example.test users; RESEND_API_KEY and Stripe
keys are empty in workers. Digest insertion and errors are tested locally; no
actual provider request/email occurs. Cluster was stopped successfully; temporary
cluster files remain outside the repository.

| Command/procedure | Observed result | Limits |
|---|---|---|
| Controller validate/status/context/next/start | Exit 0; selected/started MON-123, valid 173 tasks | Structural validity, not product proof |
| node --import tsx --test --test-concurrency=1 tests/budget-alert-wire.test.ts tests/integration/budget-alerts.test.ts tests/integration/budget-wire.test.ts tests/integration/budget-report.test.ts | Exit 0, 7/7 | Four pure groups and three real DB suites |
| node --import tsx --test --test-concurrency=1 tests/budget-alert-wire.test.ts tests/integration/budget-alerts.test.ts | Final exit 0, 5/5 | Includes final unchanged-financial-state and REST maximum parity assertions |
| pnpm test | Exit 0, 354/354, no skips | Complete units; later description/test-only edits covered by focused/static checks |
| pnpm typecheck | Final exit 0 | MDX and tsc only; no Next build |
| pnpm exec eslint, all 11 changed/new TypeScript files | Exit 0, no warnings/errors | Includes new fixture and existing two budget workers |
| pnpm lint | Final exit 0, 0 errors/109 existing warnings | Initial run had one unused fixture import, removed before final run |
| python .agentic/scripts/money_inventory.py --write; then without --write | Exit 0 | 415 columns, 1849 scanned files, 1386 consumers, 26173 occurrences |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0 | Drizzle exports/hashes/source lines match |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0, 9 checks | Legacy regression gate |
| git diff --check | Exit 0 | Only normal LF/CRLF notices |

## Review and limitations

See MON-123-review-1.md for actual self-review. No unresolved bounded-task blocker.
Live Trigger, provider mail, high volume, concurrent budget edits, independent
accounting, PostgreSQL 16 and parent MON-105/MON-029 integration are not qualified.
The global advisory lock serializes budget checks across organizations. All-org
budget selection fails atomically on bad selected history, but preceding unrelated
maintenance work is outside this transaction. Delivery retry/outbox guarantees
remain absent: post-commit digest enqueue can fail and is not retried by replay.

## Handoff

Complete MON-123 through the controller with this evidence and honest self-review;
commit/push task-owned files under the user's instruction and verify remote SHA
and clean tree. Select the next task after completion, then stop. Parent integration
and later production/currency qualification remain separate tasks.
