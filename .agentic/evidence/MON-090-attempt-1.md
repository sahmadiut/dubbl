# MON-090 attempt 1 - exact loan schedules and payment contracts

## Identity

2026-10-06, Asia/Tehran. Operator/reviewer: coding-assistant. Entry HEAD
`dd9606feea469f8db1f2d7aa009135c786034d50`, master, clean working tree.
This evidence describes the current uncommitted change. Self-review only;
no independent accounting, human, production or deployment approval is claimed.

Read root/nested instructions, START_HERE/controller/project/repository map,
MON-090/026/011 and dependency evidence, ADR-006, manifest, actual loan REST/MCP,
schema, amortization, UI/create drawer and scoped asset/bank/period/audit patterns.
The controller selected MON-090 with no unmet dependencies and claimed it.
Memory registry search returned no relevant project guidance. No subagents ran.

## Implementation and observed behavior

Six operations now use shared scoped direct-DB services: list/detail/create/
update/delete/payment, including new delete MCP parity. `loan-wire.ts` supplies
strict described inputs and explicit outputs; `loans.ts` supplies read snapshots
and atomic mutations. Registration retains the existing registerLoanTools path
in the full tool index. REST principal input remains decimal major, MCP remains
integer cents; exact principal aliases normalize without multiplying MCP cents.
Numeric outputs retain safe cents and add matching Minor strings.

`amortization.ts` replaces floating PMT powers and per-period interest with exact
bigint rational arithmetic, explicit half-away rounding and final principal
residual clearance. Supported rate/term/row/aggregate bounds reject before writes.
Gregorian dates use UTC setters while retaining original month-overflow policy.
Saved schedules/history are validated rather than rewritten.

Organization/loan locks serialize mutations; account/bank/journal links are
scoped, typed, same-base-currency and supported. Payments enforce period tiers
and closed years, save identity FX tags and keep original GL meaning. Transactional
bank GL self-linking, journal numbering/legs, schedule/status, awaited audit and
output checks roll back together. Unlinked/foreign/corrupt historical journals
fail closed. Scoped create/payment keys and displayed schedule targets replay
saved responses across transports; delete/payment races cannot leave partial rows.

The dashboard sends schedule targets, parses principal/percentage/counts exactly,
displays exact cents and sums loaded-list values in bigint. Three migrated legacy
money allowances were removed. Changed-file lint is clean; two now-unused loan
lint-disable comments were removed without suppressing checks elsewhere.

[LOAN_WIRE_CONTRACTS](../registries/LOAN_WIRE_CONTRACTS.md) maps every operation,
input/output/alias/unit/range, compatible correction, lock/retry rule and known
limit. Manifest, README, test matrix, CI runbook and machine inventory are updated.
No schema changed, so no migration generation/application to the user DB is needed.

## Acceptance mapping

1. Contract registry covers all six REST/MCP pairs, original major/minor input
   distinction, every money alias and nested bank money, ordinary basis points/
   counts, dates, supported safe bounds, errors and historical currency limits.
2. `loan-wire.test.ts` has five pure groups; `loans-worker.ts` invokes actual
   API-key REST handlers plus all six tools through full SDK registration.
   Legacy/exact/cross-transport clients, custom mutation permissions, expired/
   invalid keys, foreign roots/accounts/banks/journals and scoped reads are tested.
   Every registered loan input is strict and each property has a description.
3. Snapshot assertions verify no domain/audit/GL/link mutation for invalid cases
   or injected faults. Exact PMT fixture is independently specified: 1,000,000
   cents at 500 basis points for 12 months yields PMT 85,607, first interest 4,167,
   first principal 81,440 and final payment 85,612. Sum of principal is exactly
   1,000,000; max-safe one-period zero-interest payment stays 9,007,199,254,740,991.
   Audit/root/schedule/journal-line output faults roll back complete operations,
   including newly self-linked GL accounts. Cross-transport and concurrent create/
   payment retries return identical results; delete/payment race has one valid
   outcome. Period tiers/closed years, paid-off state, bank balance preservation,
   invalid stored money and FX/history failures are covered.

## Verification

All commands ran in `D:/Projects/dubbl`. Disposable PostgreSQL 18.6 bound to
127.0.0.1:55490, synthetic local test identity, timezone UTC, supplied explicit
TEST_DATABASE_URL. The harness creates/migrates/drops randomized fixture databases.
No .env credentials or application database were read, migrated, seeded or reset.

| Actual command/procedure | Observed result | Limit |
|---|---|---|
| Controller validate/status/context/start and pre-closure validate | Exit 0; 140 valid tasks, MON-090 selected | Structural tracking |
| node --import tsx --test tests/loan-wire.test.ts tests/integration/loans.test.ts (final) | Exit 0; 6/6, zero skips, 10109.8 ms | Five pure groups and actual PostgreSQL worker |
| Expanded run additionally including integration asset-master/depreciation/valuation/CWIP | All four asset workers passed | Same run's loan worker failed only on new orphan fixture missing required description; fixed and final scoped run above passed |
| pnpm typecheck (final) | Exit 0 | MDX generation + tsc; no build |
| pnpm lint (final) | Exit 0; zero errors, 129 existing warnings | Repo-wide lint |
| Changed-file pnpm exec eslint | Exit 0; no warnings | Loan services/wire/math, MCP/routes, loan pages, create drawer and new fixtures |
| python .agentic/scripts/money_inventory.py --write; node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0; 415 columns, 1676 scanned files, 1279 consumers, 25583 occurrences | Lexical/source-hash inventory |
| node .agentic/scripts/verify_legacy_money.mjs | Exit 0; 9 checks | Legacy import regression gate |
| git diff --check / cached --check | Exit 0 | LF/CRLF conversion notices only |
| git fetch origin master; local/remote divergence | Fetch succeeded; 0 ahead/0 behind before this commit | Final push verification is subsequent authorized work |
| Fixture DB count / pg_ctl stop | Zero random databases remain; disposable cluster stopped | Temp cluster files retained |

Initial typecheck found union-field/nullability inference issues; narrowed the
decimal string and used explicit never-returning branches. An initial changed-key
fixture used a principal so small that schedule preflight correctly rejected it
before key lookup; changed the fixture to another valid principal. Self-review
added orphan-history checks, exact saved-interest/date validation, non-operation
root field preservation, asset-bank/share protections and safe decimal overflow
classification. Extended orphan fixture initially omitted mandatory journal
description; fixed it and reran scoped tests and typecheck. Final checks pass.

No full build, unrequested dev server, Docker, live providers, full repository
test suite, browser/session/OAuth, independent financial review, production
migration, deployment or production IRR/full-int64 qualification ran.

## Review and handoff

See MON-090-review-1.md for actual self-review. No bounded task blocker remains.
Finish controller acceptance/submit/review/done, validate/status, commit/push
to origin/master and verify remote SHA/clean tree. Stop after this one task.
MON-026 retains combined acceptance, historical currency policy and performance/
independent accounting qualification; MON-021/banking retain generic settlement
and bank/GL balance gates. Legacy empty payment requests intentionally mean next
payment; clients needing safe network retries must send schedule target or key.
