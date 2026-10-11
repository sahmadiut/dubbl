# MON-142 attempt 1 - Recurring bill UI money

## Identity

2026-10-11, coding-assistant, D:/Projects/dubbl, master. Entry HEAD:
579ec0f8f380b33bb85f44c7dbf9afa9fb49f0ea. Clean working tree at entry.
Controller validate/status/next selected MON-142; started with coding-assistant.
This records task-owned implementation before commit, not a delivered SHA.

## Acceptance mapping

1. MONEY_MANIFEST and CORE_UI_MONEY_CUTOVER explicitly own the recurring bill
   page, new recurring-bill-ui adapter and recurringBill shared-editor branch.
   Source inspection found one list/create sheet, no detail/edit/manual-generation
   screen. The page adopts saved unitPriceMinor aliases via the existing validated
   recurring document adapter; numeric compatibility must be safe and agreeing.
   Gross products and row sums use bigint, individually formatted in saved currency
   before discount/tax. Corrupt read amounts clear the rows and show an alert.
   Creation uses unitPriceExact strings and an explicit template currency, default
   USD as existing REST/MCP do. Shared wire calculators drive the preview.
2. Five pure/React groups cover sub-cent ties, physical quantity rounding, zero vs
   blank quantity, USD/JPY/IRR/KWD, safe-edge low digits, malformed/exponent/partial
   inputs, money/quantity/aggregate overflow, missing tax, invalid currency,
   blank descriptions, noncanonical/conflicting aliases, dates and occurrence caps.
   Payload validation preserves every line and rejects incomplete descriptions;
   the old parseFloat fallback no longer turns zero quantity into one. Decimal
   prices never pass through Number. Quantities/caps remain nonmoney numeric API
   controls. Actual authenticated REST and linked MCP SDK create/list/get/preview
   and pause/update reads validate stored aliases and schedules; generated bills
   and SQL-text values match preview prices, amounts, tax and totals. Two dates,
   inclusive end/cap completion and no repeated generation pass. Org/supplier
   currencies do not change the USD omission default. Existing payable regression
   includes permission/isolation, atomic generation and lifecycle checks.
3. Explicit compatibility policy: payable price inputs always multiply by 100,
   regardless of selected currency. Price and quantity each round before extension;
   USD 0.005 x 3 generates 3 raw minor units. UI explains fixed-two input and renders
   resulting units using saved currency metadata. Price 12.50 produces USD 12.50,
   JPY/IRR 1250 or KWD 1.250 before extension/tax. Existing storage is never rescaled.
   Current purchase tax can be selected and previewed; future generation uses the
   then-current tax rate and still creates draft bills. Schedule/name/supplier/
   frequency/start/end/cap/reference/expense-account controls remain. Wider,
   scrollable editor/table and labeled decimal input preserve English readability.
   Closing resets the draft and unmounts the editor; org-keyed workspaces reset
   state on remount and list requests abort on cleanup. Existing MCP operations
   already expose corresponding features; no REST/MCP/backend/schema changes.
   MON-132/MON-129/MON-007 retain independent combined acceptance.

## Verification

All commands ran from D:/Projects/dubbl. Integration used explicit
TEST_DATABASE_URL with a dedicated synthetic trust-authenticated PostgreSQL 18
cluster on 127.0.0.1:55442, role dubbl_ci, max_locks_per_transaction=256, jit=off:
C:/Users/Sajjad/AppData/Local/Temp/dubbl-mon142-pg-328d234af2d34a14933dc80dc53ca1f2.
Each wrapper created/migrated/dropped a random database. Workers received only
the disposable DATABASE_URL; no application DB or .env was accessed.

| Command | Actual final result | Limits |
|---|---|---|
| node --import tsx --test tests/recurring-bill-ui-money.test.ts | Exit 0, 5/5 | Behavioral adapters and React static render |
| node --import tsx --test tests/integration/recurring-bill-ui-money.test.ts | Exit 0, 1/1 | Final fixture includes actual list, draft status, two occurrences and completion |
| node --import tsx --test --test-concurrency=2 tests/integration/recurring-payables.test.ts tests/integration/recurring-invoice-ui-money.test.ts | Exit 0, 2/2 | Existing payable and shared-editor regressions |
| node --import tsx --test --test-concurrency=2 tests/*.test.ts | Exit 0, 447/447 | Entire unit suite |
| pnpm typecheck | Exit 0 | Final MDX/tsc, no full build |
| pnpm exec eslint scoped six TS/TSX files | Exit 0, no warnings | Page/editor/helper and three tests |
| pnpm lint | Exit 0, 0 errors/103 existing warnings | Whole repository |
| python .agentic/scripts/money_inventory.py --write | Exit 0 | 415 columns, 2012 files, 1506 consumers, 28762 occurrences |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0 | Actual source hashes/lines and Drizzle schema |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0, 9 regression checks | Legacy import guard |
| python .agentic/agent.py validate | Exit 0, 202 tasks | Workflow structure only |
| git diff --check | Exit 0 | Whitespace |
| Synthetic psql database count / pg_ctl fast stop | 0 fixture databases, stop exit 0 | Dedicated cluster only; temporary files retained |

Initial scoped lint identified an unnecessary effect suppression; removed it and
final scoped lint passed cleanly. Initial editing referenced an absent org hook;
source inspection corrected it to the existing activeOrgId mechanism before final
typecheck. No failed assertion, timeout, pending check or unrun command is claimed
as passing. DEC-005 permits behavioral/layout review without screenshots.

## Review and handoff

Actual self-review: MON-142-review-1.md. No live browser effects, hosted CI,
independent accounting/linguistic approval, production IRR, full-int64 business
qualification, PDF/provider verification or deployment is claimed. No build,
unrequested dev server, Docker, schema migration or application DB mutation ran.
Complete controller check/submit/self-review/done, commit only task-owned files,
push origin/master, confirm remote SHA and clean tree, report live next task and
stop. Combined parent acceptance remains open.
