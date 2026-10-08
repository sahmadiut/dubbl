# MON-101 attempt 1 - combined financial report contracts

## Identity

2026-10-08, Asia/Tehran. Operator: codex. Entry master HEAD
07a87b54ae45d59833354aacba66ed7ad9b8abc5, clean working tree. User authorized
completing and pushing one next controller task. MON-101 was selected as the
ready integration parent after MON-106..110. This evidence precedes its commit.
Review is self-review, without independent accounting/human/production approval.

## Implementation and acceptance mapping

Read root/nested instructions, controller/project/repository map, task/dependency
evidence and reviews, source migration/API compatibility sections, ADR-006,
manifest and five report maps. Inspected actual REST/MCP registrations, shared
cumulative/period/ledger/cash/compound/GL/export code and disposable DB harness.
Reused child services rather than duplicating report calculations.

1. FINANCIAL_REPORT_INTEGRATION maps all eleven read pairs and file boundaries to
   detailed inputs/defaults/outputs/units/aliases/ranges. Fixed cents, fixed decimal
   legacy strings, currency-scaled files, counts/ratio/day units and safe/Excel
   bounds are distinct. Manifest and test matrix link combined acceptance.
2. New financial-report-integration.test.ts/worker creates and posts legacy numeric
   and exact string journals through actual API-key REST and registered MCP SDK
   clients. The exact journal amount 2147483648 exceeds int32. Independently
   specified income, prior cumulative earnings, opening/movement/closing ledger,
   actual cash, tracking, pack and ratios agree across all eleven pairs. Drafts
   and following-period entries do not enter the inclusive January period.
   USD/IRR/JPY/KWD metadata preserves JSON units; actual standalone/pack XLSX net
   income agrees at existing currency scales. Each pair covers a second tenant,
   invalid keys, denied custom role, unknown controls and unsupported currency.
3. Initial parent fixture found that cumulative MCP tools accepted unknown fields:
   server.tool(raw shape) let the SDK strip them before strict service parsing.
   Switching both registrations to registerTool with the full strict schema
   preserves names/descriptions/valid inputs while rejecting unsupported controls.
   The original assertion remains and now passes. Ledger/account/audit snapshots
   remain unchanged across all successful and failed report calls and exports.
   Child suites additionally verify malformed foreign references, safe/unsafe
   output bounds, exact gross cancellation above int64, source/status/dimension
   rules, comparison dates, PDF/XLSX precision failures and PostgreSQL pagination.

Changed files: MCP report registration, new test/worker, combined registry,
manifest, test matrix, regenerated MONEY_BOUNDARIES inventory, task handoff/state
and this new attempt/review evidence. Child tasks/evidence remain immutable.
No schema/migration/history rescale or production IRR flag change.

## Verification

Commands ran at D:/Projects/dubbl. A new synthetic PostgreSQL 16.15 cluster
listened only on 127.0.0.1:55501 with UTC timezone and explicit TEST_DATABASE_URL.
The harness created/migrated/dropped random dubbl_ci_ databases; a final query
confirmed none remained. Cluster stopped after fixtures; temporary runtime/data
remain outside Git. Configured application DB was not accessed. No full build,
dev server, Docker, provider call or deployment was run.

| Command | Actual result | Scope |
|---|---|---|
| node --import tsx --test --test-concurrency=1 tests/integration/financial-report-integration.test.ts tests/integration/cumulative-statement.test.ts tests/integration/period-statement.test.ts tests/integration/ledger-detail.test.ts tests/integration/cash-flow.test.ts tests/integration/compound.test.ts | Final exit 0; 6/6, no skips | Parent and all five child suites on PostgreSQL 16 |
| pnpm test | Exit 0; 359/359, no skips | Full pure/unit suite |
| pnpm typecheck | Exit 0, final run after registration fix | MDX and tsc, no build |
| pnpm exec eslint lib/mcp/tools/reports.ts tests/integration/financial-report-integration.test.ts tests/integration/financial-report-integration-worker.ts | Exit 0; clean | Final changed-file lint |
| pnpm lint | Exit 0; 0 errors, 106 existing warnings | Full repository lint |
| python .agentic/scripts/money_inventory.py --write | Exit 0; 415 columns, 1395 consumers, 26409 occurrences | Lexical inventory, not dataflow proof |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0 | Final source hashes/occurrence lines verified |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0; 9 checks | Legacy helper regression gate |
| python .agentic/agent.py validate | Exit 0; 173 tasks | Structural controller validation |
| git diff --check | Exit 0 | Whitespace |

Initial focused run passed five child suites and failed the new parent's unknown
MCP input assertion. Investigation traced the raw-shape registration, fixed it
without relaxing validation/assertions, then reran all six successfully.

## Review and handoff

Separate honest self-review: MON-101-review-1.md. No blocker remains within
combined exact report contract acceptance. Standalone trial-balance natural-sign
presentation/export subtotal remain PAR-008/QA-001, explicitly characterized by
the parent fixture. Cash-flow/ratio heuristics, historical document semantics,
full-int64, currency/migration/high-volume, browser/session/OAuth, PDF layout,
localization and independent accounting/production release gates remain separate.
MON-029 retains its broader report integration acceptance. Complete controller
review/done, commit task-owned files, push origin/master, verify remote SHA and
clean tree, then stop without beginning another task.
