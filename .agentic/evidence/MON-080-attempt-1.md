# MON-080 attempt 1 — payroll configuration contracts

## Identity

2026-10-05, Asia/Tehran. Operator: coding-assistant. Entry HEAD
6a467bfb499925b25ce1e02f602c7cb6817f1362 on clean master. Changes are pending the
user-authorized task commit/push at evidence creation. No unrelated work present.
Temporary new PostgreSQL 18 cluster on 127.0.0.1:55480; each integration case
creates/migrates/removes its own randomly named fixture database. No configured
app database migration/reset, credentials printed, schema edits or deployment.

Read root/.agentic instructions, START_HERE/controller/project/repository map,
backend role, MON-080/079 and MON-011 foundation evidence, ADR-006, money manifest,
source migration/API-compatibility sections and actual schemas/routes/MCP/UI.
Controller selected and started the existing ready MON-080; no split/delegation.

## Implementation and actual findings

- Added payroll-config-wire.ts with strict/described schemas for settings, type/
  assignment, employee tax, bracket and allowance inputs; named cents Minor
  aliases, exact agreement/nulls, safe Number bridge and saved DTO guards. Added
  payroll-config.ts shared direct-DB services and payroll-config.ts MCP module,
  registered in tools/index.ts. Eight existing REST files now delegate to the
  services; two allowance CRUD route files expose the existing persisted table.
- All 23 operations documented in PAYROLL_CONFIG_WIRE_CONTRACTS.md with complete
  fields/units/ranges/envelopes/retry/authorization policy. Legacy money remains
  integer cents; annual/per-period distinction and safe 0..9007199254740991 bound
  are explicit. Rates remain basis points, deduction percent is decimal percent,
  counts int32 and Gregorian dates/year are validated. Existing real columns
  accept only unchanged finite binary32 values; 2.5 works, 2.9 rejects instead of
  silently rounding. This is a deliberate bounded limit, not decimal storage
  expansion or automatic malformed-history repair. Full-int64 remains separate.
- Original employee assignment POST/PUT/PATCH/DELETE and tax-election PUT lacked
  necessary employee/type ownership filters. Adopted operations check owned live
  employee, actual deduction employeeId and owned type; foreign historical nested
  type links reject without disclosure. Supplied settings GL codes validate live
  owned account/type. Settings currency cannot change with any run history.
- Organization locks serialize adopted writers/lazy defaults/allowance uniqueness;
  employee row locks coordinate nested writes with MON-079 masters. Every write
  validates saved DTO before commit and audits in the same transaction. Unknown
  fields, invalid money/dates/controls and unsupported history reject; row edits
  exclude deleted records. Soft deletion preserves history; bracket deactivates.
  Existing withholding now excludes deleted bracket/allowance rows. Its broader
  legacy jurisdiction/year/bracket-selection and arithmetic remain MON-082 scope.
- Dashboard settings no longer echoes readonly GET metadata/aliases into strict
  PUT. Fixed amount/bracket parsing and displays use exact cents; default/branch
  rates parse basis points without float money math. Employee tax form formerly
  sent nonexistent additionalFederalWithholding/additionalStateWithholding fields
  and incorrect married enums, silently dropping changes; it now sends actual
  additionalWithholdingMinor and actual enums. The deductions panel now consumes
  the actual data envelope and shows fixed/percent/type precedence. No invented
  separate state withholding storage or statutory rule change.
- Added five pure groups and a migrated PostgreSQL worker/test, updated product
  docs, money README/manifest/test matrix and regenerated conservative inventory.
  Existing task index/coverage already includes this bounded child; no scope or
  task graph change. Stored money/history/schema never rescale.

## Acceptance mapping

1. PAYROLL_CONFIG_WIRE_CONTRACTS.md inventories all 23 operation pairs. Schemas,
   product docs and service/DTO behavior specify numeric/exact cents aliases,
   annual/per-period units, null/omission, all nonmoney controls, effective ranges,
   compatibility corrections, roles, defaults/envelopes and limits.
2. Migrated actual REST/MCP fixture invokes each operation, SDK transport and full
   tool registration, original envelopes and legacy/exact/dual/null clients. All
   schemas are strict and every field described. Two tenants, API key/custom-role
   permissions, expired/invalid credentials and header spoofing are asserted.
   Foreign roots/nested types/GL codes and wrong employee deduction paths reject.
3. Tracked SQL snapshots verify denied/malformed/unsafe inputs leave state intact.
   Six entity histories with negative/unsafe stored amounts reject unrelated
   edits. Fourteen writer plus two lazy initializer audit failures roll back via
   both adapters; injected post-insert invalid DTO also rolls back. Concurrent
   initializations yield one row; partial settings updates retain disjoint fields;
   nullable-jurisdiction duplicate allowances have one success/one 409, and four
   competing deletes have one success/one 404. Deleted employee operations reject,
   retained rows remain and zero journal rows are created. Existing withholding
   loader ignores deleted bracket/allowance fixtures. Pure tests/typecheck/lint
   and master regression pass.

## Verification

All commands in D:/Projects/dubbl.

| Actual command/procedure | Actual result | Limit |
|---|---|---|
| Controller validate/status/context/start MON-080 | Exit 0; valid 135-task graph | Orchestration only |
| node --import tsx --test tests/payroll-config-wire.test.ts | Exit 0; 5/5 | Pure boundary groups |
| Initial migrated payroll-config PostgreSQL fixture | Exit 0; 1/1 | All 23 actual REST/MCP pairs |
| Combined integration run with --test-concurrency=2: payroll-config and payroll-master | Exit 0; 2/2 | Configuration plus shared master registration regression |
| Final expanded payroll-config PostgreSQL fixture | Exit 0; 1/1 | Includes both initializer audit faults/deleted employees/withholding filter |
| node --import tsx --test --test-concurrency=2 tests/*.test.ts | Exit 0; 241/241 | Full pure suite, bounded local CPU concurrency |
| Final pnpm typecheck | Exit 0, MDX generation plus tsc --noEmit | No build/dev server |
| npm run lint | Exit 0; 0 errors/141 existing warnings | Full repository lint; warning count decreased from 143 |
| Final npx eslint changed services/wire/tools/routes/tests/withholding/index | Exit 0, clean | UI retains pre-existing warnings, full lint above covered it |
| money_inventory.py --write and verification; verify_money_inventory.mjs | Exit 0; 412 columns, 1271 consumers, hashes/lines verified | Lexical inventory, not runtime qualification |
| node .agentic/scripts/verify_legacy_money.mjs | Exit 0; 9 checks | Deprecated-money regression gate |
| git fetch origin; HEAD...origin/master count | Exit 0, 0/0 before task commit | No upstream/deployment change |
| Fixture DB count; pg_ctl stop | Zero remaining fixture DBs; cluster stopped, exit 0 | Only new test cluster |
| git diff --check; controller validate | Final exit 0 | Completed task state checked before commit |

Development repairs: first typecheck caught three surplus Request arguments on
pure detail service calls and a generic object/Record typing mismatch. Corrected
both; final typechecks pass. Initial changed-code ESLint found four unused fixture
imports; removed/used them, final clean. Unbounded npm test while concurrent
lint/integration consumed local resources timed out an existing currency-rollout
subprocess. The complete suite passed 241/241 with --test-concurrency=2; no test
assertion was removed or timeout changed. Generated route EOF blank lines caused
initial diff-check notices; normalized final LF EOF and regenerated source hashes.
No financial/data assertion was waived.

No browser/session/OAuth/screenshot, Docker, current statutory/provider lookup,
PostgreSQL16 execution, full build/dev, production migration/restore, IRR flag,
deployment or independent financial/security qualification. Default GL codes may
be unprovisioned until configured; posting must qualify them. New config metadata
is persistence availability, not qualified jurisdiction-specific run selection.
Unadopted run writers do not yet share all adopted locks. These remain MON-082 /
parent MON-025 and the existing qualification gates, not bounded child blockers.

## Review and handoff

MON-080-review-1.md records actual implementing-assistant self-review. Approve
only documented configuration scope. Complete controller checks/submit/review/done,
validate/status, commit/push authorized changes, verify synchronized clean master
and stop. Next MON-081 time/leave contracts; broader payroll remains open.

