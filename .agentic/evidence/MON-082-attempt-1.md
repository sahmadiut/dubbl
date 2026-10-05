# MON-082 attempt 1 ? payroll run and lifecycle adoption

## Identity

2026-10-05; operator coding-assistant. Repository D:/Projects/dubbl, master, starting commit fd1c472. Work was uncommitted when this evidence was prepared; no invented implementation commit. Owner requested "complete and push next task". Controller selected and started MON-082, without starting another task. Initial tree was clean and origin/master matched HEAD after fetch. No agents or human reviewer were used.

Fixtures used a separate temporary PostgreSQL 18 loopback cluster on port 55482, trust-authenticated synthetic test accounts and randomly named disposable databases. No local .env values or production/customer data were read/copied into fixtures. Each fixture creates/drops its own database. After final checks, zero dubbl_ci_* databases remained and pg_ctl stopped the cluster. This does not qualify hosted PostgreSQL 16 CI or production.

## Implementation result

- lib/api/payroll-run-wire.ts and lib/payroll/exact.ts specify bounded numeric/exact cents aliases, strict dates/options, safe response preflight, bigint rational arithmetic and exact decimal FX. New item rateExact is authoritative; fxRate is explicitly approximate binary32 compatibility metadata. PostgreSQL's shortest float4 text is reconstructed only for that legacy approximation.
- lib/api/payroll-runs.ts implements all 16 operations for regular/off_cycle creation, reads/notes/delete, item/bonus reads and edits, process/approval and bonus/termination/correction creation. Root REST handlers and new registered MCP tools use the same direct-DB scoped services and atomic audit. Existing MCP names/payRunId/list envelopes/limit 200/accrued and process journalEntryId remain compatible. Every schema input field is described and full MCP registration is unique.
- Exact salary/hourly/overtime, tax annualization/allowances/brackets/FICA/employer caps, deductions and FX feed lib/api/payroll-posting.ts. Historical FX, employee-specific signed correction detail, snapshot deduction liability classification, open periods and typed/owned base-currency accounts yield one balanced journal. Posted history cannot be deleted/edited. Process and pending submission retries avoid duplicate accounting/audit decisions. Special runs honor approval before side effects; approved termination/PTO and one-time deductions finalize with the journal.
- Payroll master/configuration locking coordinates with organization currency guards. Reads validate nested owned employees/project/milestone/timesheet/deduction references. Missing or unsupported money/FX/history and financial mismatches fail before committing; serializer faults cannot leave financial state behind.
- Generated Drizzle migration 0009_melodic_bullseye adds nullable base/termination and deduction assignment/liability snapshots; committed journal and schema snapshot accompany it. Payroll-only trigger supports marked decimal snapshots with immutable provenance, matching pair and legacy approximation. Other FX consumers retain existing guards. Legacy reconstruction/backfill and quarantine behavior is retained, with no historical UPDATE/rescale. Physical/backfill fixtures explicitly disable the new combined guard to isolate storage.
- Dashboard list/detail use saved currencies and exact FX, parse bonus cents exactly and submit the real employee UUID. New dialog gathers employee/period/bonus/PTO/completed-parent correction choices and paginates the actual REST data envelope. Form labels, submit buttons and existing navigation are retained. No screenshot/browser execution was performed under DEC-005; these reversible UI changes received source/layout and type/lint review.
- PAYROLL_RUN_WIRE_CONTRACTS enumerates boundaries, envelopes, units, alias ranges, rounding, residual policy, state/retry behavior and limits. TEST_MATRIX, CI_RUNBOOK, MONEY_MANIFEST, FX_WIRE_CONTRACTS and generated inventory were updated. Parent MON-025 and remaining tasks were not marked complete.

## Acceptance mapping

1. PAYROLL_RUN_WIRE_CONTRACTS and described strict schemas document all 16 REST/MCP operations, signed/nonnegative cents, nullable output aliases, nested master money, binary32 hours/percent, basis points, decimal FX direction/range and numeric coexistence limits.
2. tests/integration/payroll-run-operations.ts imports actual REST handlers; payroll-runs-worker.ts invokes them through real API-key auth/custom roles and uses MCP SDK InMemoryTransport. It verifies full tool registration/descriptions, both numeric/exact clients, two organizations/header isolation, every operation's authorization and foreign-reference failures, actual monetary results and persisted journal effects.
3. Pure and actual database tests reject unsafe money/unknown inputs, malformed JSON, alias disagreement, missing/quarantined FX, invalid saved state and corrupted responses. Snapshots compare financial/state tables before and after all denied requests and synthetic audit faults across every mutation. API-key last-used metadata is intentionally excluded. Atomic posting and serializer preflight preserve numeric compatibility without bigint output or unit loss; values beyond safe coexistence fail 422.

## Verification

All commands ran from the repository root. No full build or unrequested dev server.

| Command | Final result | Qualification |
|---|---|---|
| npx drizzle-kit generate | exit 0; generated 0009 SQL, snapshot and journal | Generated expand fields; payroll trigger added to the new migration, no production execution |
| pnpm typecheck | exit 0 | fumadocs-mdx and tsc --noEmit, no Next build |
| npm run lint | exit 0; 0 errors, 137 existing warnings | No new payroll warnings; repository baseline warnings remain |
| node --import tsx --test --test-concurrency=2 tests/*.test.ts | exit 0; 252/252 tests | Includes six new strict-contract/exact arithmetic groups |
| TEST_DATABASE_URL set to temporary loopback cluster; node --import tsx --test --test-concurrency=2 tests/integration/payroll-runs.test.ts tests/integration/payroll-master.test.ts tests/integration/payroll-config.test.ts tests/integration/payroll-time.test.ts tests/integration/migrations.test.ts tests/integration/fx-exact.test.ts | exit 0; 14/14 tests | Actual REST/MCP payroll/master/config/time, legacy upgrade, clean/untracked/idempotent/rollback migrations and FX physical/backfill/lock regressions |
| python .agentic/scripts/money_inventory.py --write | exit 0; 413 columns, 1626 scanned files, 1264 consumers, 25112 occurrences | Updated run currency snapshot source and non-money PTO hours |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | exit 0; 413 actual columns and all 1264 source hashes/lines verified | Lexical inventory, not full dataflow proof |
| node .agentic/scripts/verify_legacy_money.mjs | exit 0; 9 regression checks | Existing lint gate retained |
| git diff --check | exit 0 | No whitespace errors |

Actual fixtures additionally verify 1.5/1.2 historical decimal snapshots surviving live-rate changes, binary32 approximation agreement/immutability, saved tax breakdown corruption, cents 29/1250/above-int32/max-safe, overflow rollback, grouped withholding, federal status/year/jurisdiction isolation, hourly date filtering, bonus recalculation, signed per-employee correction buckets, accrued payable 2310, concurrent processing with one journal/audit, assigned approval and rejection/resubmission, one-time reservation and consumption, PTO/deactivation once, financial period locks and synthetic audit rollback for each mutation. The separate 0008-to-current migration fixture compares complete old payroll rows and preserves completed/exact/quarantined history and new null columns.

Development checks caught and corrected: canonical schema refinements throwing on invalid decimal strings, an internal -0 arithmetic operand, PostgreSQL relational numeric JSON coercion during posting, legacy FX trigger replacing authoritative snapshots, shortest float4 text vs binary32 approximation, a broad edit affecting wage calculation, legacy fixture enum/decimal display expectations, the combined trigger's name in physical/backfill tests, and test-only TypeScript/unused imports. Final commands above passed after these corrections. The first direct node inventory attempt failed because the TypeScript loader was omitted; the documented --import tsx invocation passed.

## Review and limits

Self-review is separately recorded in MON-082-review-1.md. No peer/human accounting/security/localization approval is claimed. No builds, dev server, screenshots, live provider requests, hosted CI, production migration/deployment or IRR production enablement. The current employee schema lacks elected state/local tax jurisdiction, so only the existing default federal and configured employer parameters are used; existing hours/termination defaults remain explicitly documented, without a new statutory policy. Safe numeric coexistence is bounded, not full-int64 runtime adoption. New-run creation is a new economic event; process retry idempotency does not promise generic payment-request deduplication. Legacy baseCurrency remains null with a documented current-organization bridge rather than a migration backfill.

## Handoff

All MON-082 criteria are supported by the documented bounded implementation and real fixtures. Migration must precede runtime use. MON-083..085 and parent MON-025 retain payslip/export/remaining/integrated financial qualification. Stop after this task, commit and push only this change to origin/master under the owner's request, verify remote SHA and clean status. Controller completion records are generated after this evidence; no downstream completion or deployment approval is implied.
