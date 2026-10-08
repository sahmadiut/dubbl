# MON-117 attempt 1 - bank analytics

## Identity

2026-10-08, Asia/Tehran. Operator/reviewer: codex, self-review only. Entry HEAD
8bd74e0cecd0a28fab1bd4076181406c483ecdff on master; clean working tree at entry.
Exactly one controller-selected bounded task. No independent/human approval.

## Implementation

Replaced both REST report implementations with shared read-only repeatable-read
services in lib/reports/bank-analytics.ts and strict bank-analytics-wire schemas.
Added bank_cash_flow and bank_reconciliation_status MCP tools and registered them
in index.ts. SQL numeric/text money projections and bigint intermediate math
retain safe numeric currency minor units and additive exact Minor strings.

Cash-flow now verifies owned live bank IDs before selecting transactions, closing
the explicit foreign-ID read path. It rejects mixed bank currencies without a
selector, validates saved transaction currency, preserves signed outflows and
cumulative period movement, and groups/labels UTC calendar windows correctly.
Reconciliation projects saved balance as text, aggregates gross ages without
int64 ABS overflow, scopes import metadata by organization and verified account,
uses UTC age cutoffs and excludes excluded lines from latest-gap detection.

Pages show errors without displaying stale/empty financial success, use exact
currency formatting, export currency columns, retain status decimal CSV scales,
and group status monetary totals per currency using bigint. Display totals can
exceed a stored int64 value without a crash or precision loss. Cash-flow balance
is labeled cumulative net change to make its zero opening meaning explicit.

BANK_ANALYTICS_WIRE_CONTRACTS maps all inputs/outputs/units/ranges/errors and
retained accounting semantics; MONEY_MANIFEST links it; machine inventory refreshed
only task-owned consumers. No schema changes or migration required. No production
IRR enablement, FX conversion, history rewrite or financial write.

## Acceptance mapping

1. BANK_ANALYTICS_WIRE_CONTRACTS documents both REST/MCP pairs, defaults, strict
   dates/group/UUID/currency filters, integer currency minor numeric/Minor aliases,
   safe supported range, count/date units, errors and CSV units.
2. Actual migrated PostgreSQL fixtures invoke REST with hashed API keys and MCP
   SDK clients. Legacy balance and exact balanceMinor bank writer inputs retain
   identical report units. Empty/default/populated outputs agree; denied auth/
   permissions, key-owned organization, foreign/deleted/missing/inactive account
   selection and foreign import metadata are tested. USD/IRR/JPY/KWD never rescale.
3. Unit and operation fixtures reject invalid/duplicate queries, impossible dates,
   reversed ranges, unsupported groups/currencies, transaction currency mismatch,
   mixed selection and conflicting currency selection. They cover both signed safe
   limits, gross/period/root/running/discrepancy/saved balance overflow and int64
   minimum ABS behavior, plus exact cancellation of reconciled int64 movements.
   Snapshots of bank/transaction/import/reconciliation/GL/audit state remain
   unchanged after successful reads and expected range failures. API-key last-use
   authentication bookkeeping is deliberately excluded.

## Verification

All commands ran in D:/Projects/dubbl. A task-created PostgreSQL 18 cluster used
synthetic local trust role task_mon117 and listened only on 127.0.0.1:55517, UTC.
Explicit TEST_DATABASE_URL targeted that cluster; fixtures created, migrated and
dropped random dubbl_ci_ databases. Application DATABASE_URL was not read or used.
Worker TZ Asia/Tehran exercises UTC period behavior outside the server timezone.
The task cluster was stopped successfully before controller completion/push;
its temporary data remains outside the repository.

| Actual command/check | Result | Limits |
|---|---|---|
| node --import tsx --test --test-concurrency=1 tests/bank-analytics-wire.test.ts tests/integration/bank-analytics.test.ts tests/integration/bank-accounts.test.ts | Exit 0, 5/5, no skips | Final focused/adjacent fixtures |
| node --import tsx --test --test-concurrency=2 tests/*.test.ts | Exit 0, 341/341, no skips | Complete final unit suite |
| pnpm typecheck | Exit 0 | MDX + tsc; no full build |
| pnpm exec eslint over all 12 changed/new TS/TSX files | Exit 0, clean | Final changed-file lint |
| pnpm lint | Exit 0, 0 errors, 116 existing warnings outside changed files | Repository-wide lint |
| python .agentic/scripts/money_inventory.py --write, then without --write | Exit 0 | 415 columns, 1819 files, 1368 consumers, 25926 occurrences |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0 | All Drizzle/source/hash/occurrence checks |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0 | 9 regression checks |
| python .agentic/agent.py validate | Exit 0, 173 structurally valid tasks | Does not itself prove implementation |
| git diff --check | Exit 0 | Git line-ending notices only |

Initial fixture execution exposed separately bound SQL group expressions that
PostgreSQL could not equate. Group/order references now use projected column 1;
final fixtures pass. Initial typecheck found stale page-total references after
currency grouping; corrected before final checks. Removed an unused page lint
suppression; final changed-file lint is clean.

No full build, dev server, Docker, deployment, browser/screenshot, market quote,
provider call or broad integration suite ran. Report accounting retains existing
statement movement/discrepancy and future-age semantics; full-int64 client support,
historical remediation, performance and independent accounting/IRR qualification
remain separate. MON-104/MON-029 retain combined acceptance.

## Review and handoff

See MON-117-review-1.md. No remaining task blocker. Complete MON-117, commit only
its files and push origin/master; controller selects MON-118 next, without starting
it. Current task evidence describes local checks, not production qualification.
