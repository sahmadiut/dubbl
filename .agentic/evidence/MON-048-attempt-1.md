# MON-048 attempt 1 - exact bill lifecycle contracts

## Identity and selection

2026-10-03, Asia/Tehran. Operator: coding-assistant. Entry HEAD
`85f66195acca8fea97fe67f678a492914953ced9`, clean master working tree. The user
requested the next task, then commit and push after full completion. Controller
validate/status/context selected MON-048 and start claimed it. This evidence
records verified working changes before commit, with self-review only.

Read root/nested instructions, START_HERE/controller/project/repository map,
backend role, MON-048/MON-020 and MON-021 scopes, MON-011/MON-047 attempt/review,
ADR-006, source migration/API compatibility requirements, money manifest and
actual REST/MCP/bill/procurement/approval/schema/money/stock/test sources.
No delegation, full build or dev server.

## Implementation

- bill-lifecycle shares direct-DB receive/approve/reject/void operations across
  four real REST handlers and registered MCP tools. New receive_bill/reject_bill
  complete transport parity. Pending-only approval now posts real bookkeeping;
  the former MCP draft/status-only approval is replaced by receiving drafts.
- Organization/bill locks, scoped reference validation, strict issue-date and
  closed-year checks, safe header/line DTOs and precommit JSON serialization guard
  actual stored money. Numbering/journals/stock/FIFO/warehouses/GRNI/PO/approval/
  bill status/audit share one transaction. Removed unused non-atomic floating
  procurement posting from _procurement; retained its existing GRN linkage helper.
- Exact tax ratios support standard/partial/reverse-charge recoverability;
  supplier AP matches actual amountDue. Matched stock tax receives the same
  policy. Reused qualified exact FX/posting primitives from invoice lifecycle,
  preserving currency scales and saved transaction FX fields with safe aliases.
- bill-stock receives/revalues stock with exact value and average-cost ratios,
  linked movements, warehouse balances and qualified FIFO layers. Unmatched stock
  uses the posted GL residual allocation. Void swaps saved journal legs/FX and
  removes original receipt/revaluation values, refusing consumed FIFO, overdrawn
  quantities/value, unlinked historical stock and unqualified legacy GRNI.
- GRNI requires one balanced posted identity-FX receipt accrual, clears remaining
  rounded receipt units across duplicate/partial bills, books on-hand variance or
  PPV, avoids a second stock receipt and updates PO/receipt state atomically.
  Void reverses both entries and restores original/remaining clearing stamps,
  original receipt status and billed quantities without undoing other bills.
  Foreign receipt FX and FIFO zero-quantity variance remain explicit unsupported
  paths for their assigned qualification tasks.
- Existing optional bill workflow actions validate current assignee/tenant, handle
  nonconsecutive steps, postpone posting until final approval, reject to draft and
  cancel on void. Generic REST request actions and MCP approve_request/reject_request
  delegate bill requests to this service, preventing bypass of posting preflight.
- Settlement coordination adds common recognized-outstanding-state/range barriers
  to REST pay and MCP pay_bill, REST manage:bills permission, guarded bigint paid/
  due arithmetic and MCP subtraction of actual reverse-charge payable. Full
  payment aliases/ledger/locking/carrying-FX/idempotency remain MON-021; its Handoff
  records the current legacy REST flow and balance-only MCP/race limitations.
- Added pure and real PostgreSQL handler/SDK fixtures, BILL_LIFECYCLE_WIRE_CONTRACTS,
  API/MCP/module docs, money README/manifest, test matrix and source inventory.

## Acceptance mapping

1. BILL_LIFECYCLE_WIRE_CONTRACTS inventories every selected boundary and generic
   bill approval carrier: inputs/envelopes, money aliases, dates/UUIDs, quantities,
   rates/tolerances/reason text, exact saved FX, supported ranges, permissions,
   errors, atomicity, legacy history and explicit settlement coordination.
2. Real handlers and registered SDK fixtures use numeric, exact-major, exact-minor
   and dual bill clients through receive/void; direct REST/MCP pending approval
   and rejection; multi-step/generic approval/cancellation; above-int32/safe-max
   values, KWD/USD scales and saved FX after live-rate changes; standard/partial/
   reverse-charge tax/AP; average/FIFO/warehouse stock; actual GRN accrual creation,
   matched tax/PPV/GRNI, partial bills and original history restoration. All four
   lifecycle operations exercise API keys, custom read-only roles, invalid keys
   and foreign orgs, with conflicting org headers unable to redirect scope.
3. Invalid reason, unsafe saved money, foreign account, inconsistent totals,
   missing FX/AP, locked dates/closed years, settled/orphan states, consumed FIFO
   and procurement violations leave unchanged SQL-text business snapshots.
   Journal-line/header/audit/stock fault injections roll back posting, workflow
   action and status together; a void-audit injection rolls back reversal.
   Concurrent receive/void has one success and one state error, without duplicate
   effects. A two-line sub-minor FX stock fixture proves stock equals the GL
   rounding allocation. Pay barriers reject draft/pending/orphan bills.

## Verification

All commands ran at D:/Projects/dubbl with installed dependencies. Initialized a
synthetic PostgreSQL 18.6 trust-auth cluster at
`D:/Temp/dubbl-mon048-pg-39361a7a3d9e4259998da4499297d4f2`, loopback port 55458,
synthetic dubbl_ci role, hidden pg_ctl launch. Explicit TEST_DATABASE_URL selected
only that server; the harness created/migrated/dropped random dubbl_ci_* databases.
The connection target and configured application DB were not migrated/reset.
No .env credentials were read/printed/persisted; worker Stripe keys were blank.

| Actual command/procedure | Result | Limit |
|---|---|---|
| Controller validate/status/context/start | Exit 0, valid 104-task graph and MON-048 selected | Structural tracking only |
| node --import tsx --test tests/bill-lifecycle-wire.test.ts | Initial 3/3 pass; final added settlement case included in full suite | Pure ratios/schemas/barriers |
| TEST_DATABASE_URL=... node --import tsx --test tests/integration/bill-lifecycle.test.ts tests/integration/bill-writes.test.ts tests/integration/bill-reads.test.ts tests/integration/invoice-lifecycle.test.ts | Exit 0, all 4 workers pass | Real handlers/SDK, synthetic PG18.6 |
| Final bill-lifecycle integration rerun after accrual-balance guard | Exit 0, worker passes | Final runtime implementation |
| npm test | Exit 0, 149/149 | Unit suite, not full financial qualification |
| npx tsc --noEmit | Exit 0 | Existing installed/generated sources |
| npm run lint | Exit 0, 0 errors/159 existing warnings | Baseline warnings remain |
| Affected-path npx eslint (services, handlers, MCP, fixtures and linkage helper) | Exit 0, clean | Changed TypeScript sources |
| money_inventory.py --write and verification, node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0, 410 columns/1406 paths/1163 consumers/22517 occurrences | Lexical/Drizzle/hash checks, not dataflow proof |
| node .agentic/scripts/verify_legacy_money.mjs | Exit 0, 9 checks pass | No new deprecated money usage |
| pg_isready, fixture database count and pg_ctl fast/wait stop | Ready before integration; zero fixture databases; stop exit 0 | Synthetic cluster files retained outside repo |
| git fetch origin and rev-list HEAD...origin/master | Exit 0, 0 ahead/0 behind before commit | Commit/push follows closure |
| git diff --check | Exit 0 | Line-ending notices only |

Initial typecheck found arrow-function never-return narrowing limitations; changed
error helpers to declared never-return functions without relaxing validation.
Initial fixture assertions assumed a different SQL decimal scale, then assumed
ORM-normalized text; raw PostgreSQL retains 20 trailing fraction digits. The test
now checks identity FX by a lossless decimal pattern. An SDK input error is plain
text, so the fixture decoder now accepts both SDK text and wrapTool JSON errors.
These initial failing runs are not represented as successes.

Self-review removed incidental comment encoding changes introduced by a Windows
default file decode and restored original UTF-8 comments. It also found the stock
FX residual discrepancy and corrected stock values to use the exact converted GL
leg, with a real regression fixture. Strengthened GRNI accrual identity/balance
preflight and restored original receipt stamps on void. Final checks pass.

The initial hidden pg_ctl Start-Process launcher remained attached until shutdown;
its trailing readiness probe then returned exit 1 because the test server had
already stopped. Separate ready/integration/zero-database/stop checks above
establish actual server lifecycle; no startup failure or final live server is
claimed. No schema change/migration generation, configured-DB migration, build,
dev server, Docker, live provider, browser/session/OAuth, deployment or IRR
enablement ran. Fixture migrations do not qualify production migration safety.

## Review and handoff

See MON-048-review-1 for honest implementing-assistant self-review. No slice
blocker. Complete controller acceptance/submit/self-review/done, validate, commit
and push as authorized, then stop. Next task: MON-049 purchase-order contracts.
MON-020 retains combined payable/procurement acceptance; settlement/full-range/
financial/security/migration/release and IRR qualification remain separate.
