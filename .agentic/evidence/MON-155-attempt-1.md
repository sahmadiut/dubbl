# MON-155 attempt 1 - payroll UI money

## Identity and authorization

2026-10-12, Asia/Tehran. Codex, coding-assistant, honest self-review.
Entry master HEAD 4bd3dfc3883a479319f466f214c82c9108a3da23, clean tree.
Live validate/status/next selected MON-155; user authorized completion and push.
Read root/nested instructions, controller context, selected task, existing payroll
contracts/fixtures and current source. Applied the Dubbl controller-task skill.
No other controller task or integration parent is completed by this delivery.

## Acceptance mapping

1. lib/money/payroll-ui.ts checks safe numeric cents against required canonical
   Minor aliases for present monetary fields throughout nested successful JSON
   DTOs. It rejects conflicting/missing/noncanonical/unsafe values, negative zero,
   negative master/configuration amounts, invalid null pairs/currencies and invalid
   band ranges. All payroll page JSON reads use this adapter; employee/contractor
   create drawers check success responses before toast/close/navigation. Existing
   payroll REST/MCP contracts are reused without backend or schema changes.

   Payroll display/input always retains its two-decimal cents convention for all
   ISO tags. Forecast and compensation inputs no longer use ISO parseMajor scales;
   analytics/settings no longer multiply monetary floats. Employee salary and
   per-period previews are bigint; run deduction totals and overview group sums
   are bigint. Overview totals separate unlike currencies. Chart and band range
   penetration use clamped exact rational rounding. Employee band loading now uses
   the existing /payroll/compensation/bands/[id] endpoint and compares penetration
   only for matching currency. Saved/selected currencies label the affected views.
   Invalid saved reads prevent state adoption and monetary pages display alerts.

   Explicit unit exceptions are documented in PAYROLL_UI_MONEY_CUTOVER.md: hours,
   headcounts, basis points, percentages, overtime/accrual multipliers and legacy
   approximate FX are nonmoney. Configuration editors without currency snapshots
   retain USD labels; tax forms remain USD. Payroll does not rescale JPY/KWD/IRR.
   Nonmoney sorting differences and unfinished advisory zero preview are retained.

2. Five new unit groups check low digits and safe-max input round trips across
   USD/JPY/KWD/IRR, signed one-cent output, nested malformed/conflicting/unsafe/
   missing aliases, nullable values, monetary sign/range rules, forecast/tax box
   adoption, bigint aggregate overflow beyond Number, currency groups, signed
   sums, chart ties/clamps and all payroll source consumers/shared drawers.
   Existing payroll master editor tests use bigint preview assertions.

   Successful actual REST and linked registered MCP responses in eight payroll
   integration workers pass through the same UI adapter before their assertions.
   Existing domain fixtures independently check SQL values, failure snapshots,
   permissions/organization scope, signed corrections, output/history, payment
   lifecycle, posting and tax/forecast units. Master acceptance additionally feeds
   UI cents input to REST create at max safe cents in USD/JPY/KWD, checks SQL salary
   text, edits through MCP to 29 cents, and checks SQL text again. All 11 domain and
   migration integration cases passed in the final run.

3. PAYROLL_UI_MONEY_CUTOVER.md and MONEY_MANIFEST map the complete consumer slice;
   money_inventory.py assigns payroll pages/helpers to MON-155 and documents
   saved safe numeric/Minor cents plus bigint intermediates. MONEY_BOUNDARIES is
   refreshed. Payroll deprecated-helper ESLint allowances are removed; the new
   source guard rejects raw JSON adoption, legacy money formatting, monetary
   float inputs and ISO-scale payroll input. Independent MON-008 remains open.

## Actual verification

All commands ran at D:/Projects/dubbl. Dedicated PostgreSQL 18 cluster:
C:/Users/Sajjad/AppData/Local/Temp/dubbl-mon155-pg-2467f33108cc4c558d00aa05b91b46fe,
127.0.0.1:55460, synthetic dubbl_ci role, UTC, jit=off,
max_locks_per_transaction=256. Explicit TEST_DATABASE_URL targeted only this
cluster for successful tests. Each fixture created/migrated/dropped a random DB.
Final fixture database count was 0; pg_ctl fast shutdown exited 0.

| Command/procedure | Result |
|---|---|
| node --import tsx --test tests/payroll-ui-money.test.ts tests/payroll-master-wire.test.ts | 11/11, exit 0 |
| node --import tsx --test --test-concurrency=2 tests/integration/payroll-master.test.ts tests/integration/payroll-config.test.ts tests/integration/payroll-time.test.ts tests/integration/payroll-runs.test.ts tests/integration/payroll-payments.test.ts tests/integration/payroll-compensation.test.ts tests/integration/payroll-outputs.test.ts tests/integration/payroll-integration.test.ts | Final 11/11, exit 0, 63.644 seconds |
| pnpm test | Final 491/491, exit 0, 16.254 seconds |
| pnpm typecheck | Final exit 0; MDX + tsc, no build |
| Changed/new TS argv passed to node node_modules/eslint/bin/eslint.js via Python | Final exit 0, 0 errors/34 existing warnings |
| pnpm lint | Exit 0, 0 errors/98 existing warnings |
| python .agentic/scripts/money_inventory.py --write; python .agentic/scripts/money_inventory.py | Exit 0; 415 columns, 2064 scanned files, 1549 consumers, 29966 occurrences |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0; schema, source hashes and occurrence lines |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0; 9 checks |
| Registry link and original Unicode document-title checks | Exit 0 |
| python .agentic/agent.py validate; git diff --check | Exit 0 |
| git fetch origin master; git rev-list --left-right --count HEAD...origin/master | Exit 0, entry delivery parity 0 0 |

Initial setup selected the configured loopback server for fixture creation; its
role lacked CREATEDB and no fixture was created. Switched to the isolated cluster
above. No application DB content was changed. Initial shell inline JS quoting,
one edit script's implicit encoding, and a temporary employee variable/duplicate
currency type error were corrected. Original Unicode labels were restored and
checked. No failed invocation is counted as passing verification.

No full build, dev server, Docker, browser/screenshot, provider or deployment action.
DEC-005 permits financial/data assertions and source/accessibility review; this is
not live browser/rendering qualification. Existing currencies and stored units
are preserved; no full-int64 wire expansion, statutory policy, production IRR
flag, history rewrite, schema migration or new payroll PDF claim.

## Review and handoff

See MON-155-review-1.md for honest self-review. Complete the controller check,
submit, self-review and done flow; commit only task-owned files and push
origin/master under the user's authorization. Verify the remote SHA and clean
working tree, report the next controller task and stop. MON-008 independent
integration acceptance and all other remaining slices stay open.
