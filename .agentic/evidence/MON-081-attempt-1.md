# MON-081 attempt 1 - payroll time, leave and shift contracts

## Identity

2026-10-05, Asia/Tehran. Operator: coding-assistant. Entry HEAD
5b99a549708aa56fa637822d2db7c1c75b1e4ef7 on clean master tracking origin/master.
User authorized completing/pushing the next task. Controller selected/started
MON-081; no split, delegation or competing progress tracker. Changes pending the
user-authorized commit/push at evidence creation.

Read root/.agentic instructions, START_HERE/controller/project/repository map,
backend role, MON-081, MON-011 dependency evidence, ADR-006, manifest and source
migration/API compatibility sections. Inspected actual payroll schema, every time/
leave/shift/self-service route, existing MCP, master/config services and editors.
Temporary new PostgreSQL18 cluster on 127.0.0.1:55481. Fixtures independently
create/migrate/drop randomly named databases. No configured app DB changes,
schema edits, credentials printed, deployment, full build or Next dev server.

## Implementation and findings

- payroll-time-wire.ts specifies strict/described inputs and saved DTO guards.
  Hours/decimal premium percentages remain numbers, not cents, minutes, basis
  points or Minor aliases. Existing real storage requires unchanged binary32
  values, nonnegative and safe for the serializer; 7.5/0.25 work, 0.1/2.9 reject.
  Exact bigint multiples of 2^-149 add/subtract physical hours and verify the
  whole result persists unchanged. No silent fround/max-zero repair. Dates are
  real ordered Gregorian YYYY-MM-DD, clocks HH:mm, weekdays 0..6, years 1..9999.
- payroll-time.ts implements shared org-scoped direct-DB services, adapting 19
  existing REST files. payroll-time.ts MCP module registers 32 single-operation
  tools; index registers it. Migrated existing get_employee_leave_balances from
  the old payroll module, preserving its balances projection. REST envelopes/
  numeric units remain, with complete contracts in PAYROLL_TIME_WIRE_CONTRACTS.
- Fixed missing root/nested ownership on employee/shift/policy/project creation
  and saved joins. Self-service resolves one owned membership employee, rejects
  overrides or ambiguous/deleted profiles, and excludes project financial data.
  Nested managerial employee/project cents add safe matching Minor strings;
  project time fields remain minutes. Historical owned deleted shift/policy/
  project references remain readable, with guards; new assignments require live
  references. No joined user credential data or foreign objects are returned.
- Original entry deletion could select another timesheet's entry but subtract
  from the path sheet, and approved entries remained mutable. Adopted service
  requires draft, correct sheet/entry path, valid entry dates and exact saved
  entry-total agreement. Entries, total updates, DTO and audit commit together.
  Timesheet edits/submit require draft; approve/reject require submitted. Terminal
  transitions cannot mutate again. Period edits cannot exclude saved entries.
- Original generic leave PATCH bypassed approval/accounting, and approval updated
  balances outside its status transaction using today's year. Adopted PATCH only
  edits pending reasons/cancellation; approval/rejection are dedicated operations.
  Approval resolves owned member and active policy, one balance for request year,
  sufficient available hours, exact binary32 results, and commits hours/status/
  audit together. Cross-year requests require explicit split, never guessed
  allocation. Missing/duplicate/insufficient balances reject; repeats cannot
  deduct again. Existing balances are never automatically created or repaired.
- Org serialization plus employee/row locks coordinate adopted writers. All 19
  writer paths preflight and validate saved output/audit before commit. No ledger
  writes or accounting period changes. Unadopted run/accrual writer coordination
  stays MON-082/parent MON-025. Create/add retries remain separate events, not
  keyed idempotent upserts; contract documents inspection before uncertain retry.
- Editors surface actual creation/entry/deletion/balance conflicts, instead of
  silently ignoring rejected HTTP responses. Premium input steps now use 0.25.
  Product docs, money README/manifest, test matrix and lexical inventory updated.
  No schema/storage migration, history rescaling or IRR flag change.

## Acceptance mapping

1. PAYROLL_TIME_WIRE_CONTRACTS.md inventories all 32 pairs, original envelopes,
   writable/readonly fields, units/ranges, null/default/omission, roles, strict
   input corrections, state transitions, historical errors and retry limits.
   Physical-unit exact clients deliberately share numeric quantities; Minor
   aliases exist only on nested actual money. No exact-only root mode invented.
2. payroll-time.test.ts/worker invokes all 32 actual REST/MCP handlers using
   migrated PostgreSQL, real API-key/custom-role auth and SDK transport/full tool
   registry. Two tenants, header spoofing, expired/invalid keys, permission denials
   across every operation, managed success and self membership are asserted.
   Legacy numeric physical values, exact nested cents aliases, null clears,
   project minutes and unavailable monetary aliases are tested. Master/config
   regressions additionally exercise legacy/exact monetary clients.
3. SQL snapshots qualify invalid/malformed/unit/ownership negatives without
   mutation, including wrong entry path, output/history errors, terminal edits,
   missing/duplicate/insufficient balances, cross-year and ambiguous profiles.
   All 19 writers roll back on audit trigger faults via both adapters, including
   two-table entry/leave changes; corrupt post-insert DTO faults roll back.
   Concurrent entry totals conserve hours, approval deducts once from 2024 while
   the 2026 balance stays untouched, and shift deletion has one winner. Saved
   unsafe nested cents and swallowed physical operands reject. Self-service has
   no project financial objects. Zero journal entry/line rows remain.

## Verification

All commands ran in D:/Projects/dubbl.

| Actual command/procedure | Result | Limit |
|---|---|---|
| Controller validate/status/context/next/start MON-081 | Exit 0; valid 135-task graph | Orchestration only |
| node --import tsx --test --test-concurrency=2 tests/*.test.ts | Exit 0; 246/246 | Full pure suite, five new groups |
| Migrated payroll-time.test.ts fixture | Exit 0; 1/1 | All 32 actual REST/MCP pairs |
| Combined --test-concurrency=2 payroll-time/config/master integration | Exit 0; 3/3 | Shared payroll registration/scoping regression |
| Final expanded payroll-time.test.ts after self visibility/history/bodyless negatives | Exit 0; 1/1 | Includes no project financial disclosure, duplicate/deleted self profiles, deleted project history |
| Final pnpm typecheck | Exit 0; MDX generation + tsc --noEmit | No build/dev |
| npm run lint | Exit 0; 0 errors/140 existing warnings | Warning count decreased from 141 |
| Final changed service/wire/tool/route/test ESLint | Exit 0; clean | Existing UI warnings covered in full lint |
| money_inventory.py --write / read and verify_money_inventory.mjs | Exit 0; 412 columns, 1267 consumers, hashes/lines verified | Lexical inventory, not runtime proof |
| verify_legacy_money.mjs | Exit 0; 9 checks | Existing deprecated-money regression gate |
| git fetch origin; HEAD...origin/master | Exit 0; 0/0 before commit | No upstream/deployment changes |
| Fixture DB count; pg_ctl stop | Zero remaining fixture DBs; cluster stopped, exit 0 | Only new temporary cluster |
| git diff --check; controller validate before acceptance | Exit 0 | Evidence-backed controller transitions follow |

Development repairs: initial pure default-query assertion omitted an explicit
undefined status property; corrected expectation. Initial audit fixture expected
an HTTP-style 500 field in generic MCP errors; existing wrapTool returns isError
and Internal error without status, so assertions follow its actual contract.
Expanded unsafe project-history injection was initially rejected by the ORM's
existing money encoder; switched only that synthetic fixture to explicit SQL.
Final expanded fixture passes. No production assertion was removed or waived.
A temporary code-generation marker lookup failed after creating routes/tools;
completed registration/fixture metadata and verified typecheck/actual registry.

No full build/Next dev, Docker, browser/screenshot/session/OAuth, PostgreSQL16,
current statutory/provider lookup, production migration/restore, IRR enablement,
deployment or independent financial/security review. Binary32 storage is an
explicit bounded compatibility limit, not exact-decimal quantity expansion.
Broader accrual/pay-run calculations/FX and outputs remain assigned tasks.

## Review and handoff

MON-081-review-1.md records implementing-assistant self-review only. No remaining
bounded-task blocker. Complete controller check/submit/review/done, validate,
commit/push authorized changes, verify clean synchronized master and stop.
Next task MON-082 pay runs/lifecycle; parent MON-025 retains combined acceptance.
