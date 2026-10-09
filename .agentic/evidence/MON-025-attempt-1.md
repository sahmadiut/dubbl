# MON-025 attempt 1 - integrated exact payroll contracts

## Identity

2026-10-09, Asia/Tehran. Operator/reviewer: coding-assistant, self-review only.
Entry master HEAD fc630ad0342697fb8cd6de85bbefd17034875870; working tree clean
at selection. Controller validate/status/next/context selected the ready MON-025
integration parent, whose MON-079..085 children were already done. Work remained
uncommitted while these checks ran. No independent human/peer review is claimed.

## Implementation and actual findings

Read repository/nested instructions, START_HERE/controller/project/repository map,
backend role, parent and dependency evidence, ADR-006, MONEY_MANIFEST, all seven
payroll boundary registries, and actual shared services, schemas, MCP registration,
Next handlers and child fixtures. Parent criteria remain unchanged.

Added tests/integration/payroll-integration.test.ts and its worker, invoking real
authenticated REST handlers and full MCP SDK registration in one newly migrated
database. The fixture joins salary and hourly masters, deduction configuration,
approved time, run creation/processing, payslips, summary/labor/tax/CSV outputs,
self-service, compensation proposals, forecasts and contractor FX payments.
PAYROLL_INTEGRATION_CONTRACTS documents the complete boundary inventory by linking
each child operation/unit/range contract and records the independent parent paths.
MONEY_MANIFEST and generated MONEY_BOUNDARIES now include this acceptance/source.

Observed monthly amounts: annual salary 120000 gives gross 10000, pre-tax
deduction 29, withholding 997 and net 8974. Approved 7.5 hours at 29 cents/hour
rounds to 218. Run gross/net are 10218/9192; concurrent REST/MCP processing returns
one journal with debit/credit sums both 10218, computed through bigint assertions.
Payslip generation retry returns count 0; two saved payslips agree across
transports. Linked self-service sees only one. Summary/labor/tax and prospective
forecast/proposal outputs agree. Master salary/rate/default deduction updates and
a compensation proposal preserve entire item, journal, payslip and associated
tax/deduction-breakdown rows. Reports retain the posted gross 10218.

An EUR contractor payment of 1250 records base USD 1500 at authoritative exact
1.2. Changing live FX to 1.5 and contractor hourly rate to 2500 preserves the full
paid DTO, original amount, base amount and FX on retry. Item/payment history blocks
master currency changes; run history blocks settings currency changes. Snapshots
of 21 related tables prove unsupported safe ranges, disagreeing aliases, unknown
organization fields, cross-tenant run/payslip/deduction requests and permission
denials cause no tracked mutation. Used MCP schemas are strict and described.

The first concurrency pass reproduced a real 40P01 deadlock in an employee update
audit: master update held the employee while run creation held the organization;
the audit's organization foreign key waited for the organization. Fixed all three
employee writers in lib/api/payroll-master.ts to lock the organization first,
matching contractor/configuration/time/run/payment/compensation writers. Both
transports use the shared service; no retry loop or error suppression masks it.
This also serializes creation with eligible employee selection. The new held-lock
regression waits until a REST update/delete blocks behind an organization lock,
then acquires its employee FOR UPDATE NOWAIT before releasing the organization.
Each actual request completes after release. Concurrent currency update versus
run/payment creation allows either order and asserts consistent saved currencies,
unscaled amounts, and 409 for edits losing to history creation.

Fixture development corrected test expectations to the actual count envelope,
create_compensation_entry/list_compensation_entries names and id input, and the
employee create schema (isActive is patch-only). These were test corrections;
valid runtime money/FX contracts were not weakened. The reproduced runtime
deadlock is separately fixed and retains regression coverage.

## Acceptance mapping

1. Every boundary's operations, envelopes, permissions, inputs, outputs, units,
   exact aliases/nulls and supported ranges are documented by the seven linked
   registries and PAYROLL_INTEGRATION_CONTRACTS. Safe legacy number coexistence is
   explicit; cents, hours, percent, basis points and decimal FX remain distinct.
2. New parent REST/MCP fixture independently combines adopted domains, legacy and
   exact clients, tenant/key context, custom permission denial, self-service,
   duplicate posting, historical snapshots and competing master/writer calls.
   All child fixtures rerun against current migrated source, including their
   complete operation matrices, authorization, period-lock, corruption and audit
   rollback cases. Migration regressions retain old complete rows.
3. Parent whole-slice snapshots and child negative fixtures prove unsupported
   inputs/history reject before commit, preserve numeric aliases and exact strings,
   and avoid bigint JSON crashes or silent precision/unit conversion. A valid
   int64 salary 9007199254740992 fails 422 LEGACY_NUMERIC_RANGE without mutation.
   Shared organization-first employee locking removes the reproduced deadlock.

## Verification

All commands ran in D:/Projects/dubbl. A new synthetic PostgreSQL 18 trust cluster
used task_mon025 on 127.0.0.1:55535, timezone UTC, explicit TEST_DATABASE_URL.
Fixtures created, migrated and dropped random dubbl_ci_ databases. The application
DATABASE_URL was not read or used. Worker DATABASE_URL was only the fixture URL;
Stripe/Resend secrets were empty and EMAIL_ENCRYPTION_KEY synthetic. No external
provider request occurred. No schema edit or migration generation was needed.

| Actual command | Result | Limits |
|---|---|---|
| Controller validate/status/next/context/start MON-025 | Exit 0; valid 173 tasks | Orchestration only |
| node --import tsx --test --test-concurrency=1 tests/integration/payroll-integration.test.ts tests/integration/payroll-master.test.ts tests/integration/payroll-config.test.ts tests/integration/payroll-time.test.ts tests/integration/payroll-runs.test.ts tests/integration/payroll-payments.test.ts tests/integration/payroll-compensation.test.ts tests/integration/payroll-outputs.test.ts | Exit 0; 11/11, no skips | Parent and all seven children, including three historical migration cases; 100466 ms |
| node --import tsx --test tests/integration/payroll-integration.test.ts (final whole-row historical assertions) | Exit 0; 1/1, no skips | Final parent source |
| node --import tsx --test --test-concurrency=2 tests/*.test.ts | Exit 0; 359/359, no skips | Complete unit suite |
| pnpm typecheck | Exit 0 | MDX and tsc only; no build |
| pnpm exec tsc --noEmit (final source) | Exit 0 | Final static verification after whole-row fixture assertions |
| pnpm exec eslint lib/api/payroll-master.ts tests/integration/payroll-integration.test.ts tests/integration/payroll-integration-worker.ts | Exit 0; no errors/warnings | All changed code |
| pnpm lint | Exit 0; 0 errors, 106 existing warnings | Existing warnings outside changed code |
| python .agentic/scripts/money_inventory.py --write | Exit 0; 415 columns, 1885 scanned files, 1412 consumers, 26981 occurrences | Source inventory, not dataflow qualification |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0 | Drizzle column, hash and occurrence matches |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0; 9 checks | Legacy import/lint regression gate |
| git fetch origin; git rev-list --left-right --count HEAD...origin/master | Exit 0; 0/0 before commit | User-authorized push follows completion |
| python .agentic/agent.py validate; git diff --check | Exit 0 | Controller structure and whitespace |
| Final fixture database count; pg_ctl -w stop | Zero leftover dubbl_ci_ databases; exit 0, cluster stopped | Only task-owned temporary cluster |

The final whole-row financial assertion edit initially made the generated source
hash/line inventory stale; refreshed it with --write and reran both inventory
checks against final source. Temporary cluster files remain outside the repository;
no application data was removed.

## Review and limitations

See MON-025-review-1.md for actual self-review. Supported parent wire acceptance is
met without claiming full-int64 consumer, production/accounting, statutory,
security-specialist, PostgreSQL 16, browser/session/OAuth/network transport,
high-volume, PDF-render/layout, release, deployment or IRR qualification. Existing
tax-form /pdf remains its documented JSON envelope. No full build, dev server,
Docker, application DB change, migration/schema edit or production flag ran.
Historical completed child evidence remains unchanged; the new parent registry
supersedes its former integration-pending status only within the supported slice.

## Handoff

Complete controller checks/submit/self-review/done using this evidence, commit only
task-owned files, push origin/master, verify the remote SHA and clean tree, then
stop. Next eligible parent is MON-026; query the controller after completion.
