# MON-156 attempt 1 - asset and loan UI money

## Identity and authorization

2026-10-12, Asia/Tehran. Operator coding-assistant (Codex), honest self-review.
Entry master HEAD 0964c302, clean tree. Live controller validate/status/next
selected MON-156. User authorized completion and push. Read applicable root and
nested rules, task/controller/project/repository context, MON-007 evidence,
existing domain contracts and actual UI/service/MCP/fixture sources. Applied the
memory Dubbl controller-task skill. Only this bounded task is completed.

## Acceptance mapping

1. lib/money/asset-loan-ui.ts validates present safe integer numeric money against
   canonical Minor strings before successful JSON enters state or a mutation
   reports success. It rejects missing/conflicting/unsafe/noncanonical aliases,
   negative zero and negative unsigned values; permits the signed valuation and
   gain/loss contracts and paired nullable disposal/revaluation values. Recognized
   asset/category/loan masters and schedules require core money fields. Nested
   histories and partial depreciation mutation DTOs are supported. Pagination
   totals remain counts; CWIP totals require money aliases.

   All five scoped pages and FixedAssetDrawer/LoanDrawer adopt this adapter.
   Invalid reads show English alerts; invalid monetary mutation responses are
   caught before closing/clearing forms. Existing bigint asset/loan/CWIP totals
   and exact cents inputs remain in use. Asset detail depreciation percentage now
   uses the clamped bigint ratio, and revaluation magnitude uses bigint.
   ASSET_LOAN_UI_MONEY_CUTOVER documents fixed-two cents/USD presentation, no
   currency rescaling, REST-major versus MCP-cents loan principal compatibility,
   and separate life/physical-unit/basis-point/count/presentation units. Account
   pickers use identity only. Existing backend currency and production gates hold.

2. Four new unit groups cover fixed cents and low digits across currency tags,
   max-safe input and output above Number aggregate range, signed one-cent output,
   malformed/missing/conflicting/unsafe/null/negative pairs, missing master and
   schedule fields, nested histories/mutations, pagination discrimination,
   clamped bigint percentages, error envelopes and all scoped source consumers.

   Six existing integration workers pass actual successful REST and linked SDK
   registered MCP results through the same adapter. Asset master and loan workers
   additionally compose assetCentsInput with actual REST create and independent
   SQL-text assertions at 29 and 9007199254740991 cents. Existing SQL/history,
   ledger balance, period/tenant/permission, replay/concurrency, corrupted saved
   data and unchanged failure-snapshot checks remain and pass. The combined
   asset/loan acceptance fixture rechecks the domain lifecycle/currency history.

3. MONEY_MANIFEST and ASSET_LOAN_UI_MONEY_CUTOVER map this consumer slice.
   money_inventory.py assigns the scoped pages and helpers to MON-156 with the
   fixed cents/alias/bigint range policy; MONEY_BOUNDARIES is regenerated.
   Obsolete category/fixed-asset legacy-helper lint allowances are removed.
   The new source guard rejects raw JSON adoption, legacy formatting, float/ISO
   monetary input and the former floating depreciation ratio in owned pages.
   Independent MON-008 acceptance remains open.

## Actual verification

Commands ran in D:/Projects/dubbl. Dedicated PostgreSQL 18 cluster:
C:/Users/Sajjad/AppData/Local/Temp/dubbl-mon156-pg-8b0ece84ff12441689475cc283c52e1d,
127.0.0.1:55461, synthetic dubbl_ci role, UTC, jit=off and
max_locks_per_transaction=256. Explicit loopback TEST_DATABASE_URL targeted only
this cluster; each fixture created, migrated and dropped a random database.
Final fixture database count was 0; pg_ctl fast shutdown exited 0. Application DB
and .env were not used or changed.

| Command/procedure | Actual result |
|---|---|
| node --import tsx --test tests/asset-loan-ui-money.test.ts | Final 4/4, exit 0 |
| node --import tsx --test --test-concurrency=2 tests/integration/asset-master.test.ts tests/integration/asset-depreciation.test.ts tests/integration/asset-valuation.test.ts tests/integration/asset-cwip.test.ts tests/integration/loans.test.ts tests/integration/asset-loan-integration.test.ts | Final 6/6, exit 0, 36.550 seconds |
| pnpm test | 495/495, exit 0, 13.747 seconds; later added missing-master negative examples passed focused rerun |
| pnpm typecheck | Final exit 0, MDX + tsc; no build |
| Changed/new TS argv passed via Python to node node_modules/eslint/bin/eslint.js | Exit 0, 0 errors/3 pre-existing unused-import warnings |
| pnpm lint | Exit 0, 0 errors/98 pre-existing warnings |
| python .agentic/scripts/money_inventory.py --write; python .agentic/scripts/money_inventory.py | Final exit 0; 415 columns, 2066 files, 1551 consumers, 30018 occurrences |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Final exit 0; schema/source hashes and occurrence lines verified |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Final exit 0; 9 checks |
| python .agentic/agent.py validate; git diff --check | Exit 0 |
| git fetch origin master; git rev-list --left-right --count HEAD...origin/master | Entry delivery parity 0 0, exit 0 |

One irrelevant executable-read command used an unsupported PowerShell parameter;
it changed no file and is not counted as verification. Intermediate formatting
was reviewed and corrected before final checks. No financial test failed.

No full build, dev server, Docker, browser/screenshot, provider, deployment or
production flag action. DEC-005 permits behavior/data assertions and source
review; this does not claim live browser rendering qualification. Existing
stored units, history and schema remain; no full-int64 wire expansion.

## Review and handoff

See MON-156-review-1.md for honest self-review. Complete controller checks,
submit/review/done; commit task-owned files and push origin/master under the
user's authorization. Verify remote SHA and clean tree, then report the next
controller task and stop. Remaining slices and MON-008 stay open.
