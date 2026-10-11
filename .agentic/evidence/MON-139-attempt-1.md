# MON-139 attempt 1 - saved bill lifecycle UI money

## Identity and scope

2026-10-11, Asia/Tehran. Actual operator/reviewer: codex; self-review only.
Entry master HEAD f28b6133, clean working tree. User authorized completing and
pushing one next task. Live controller validate/status/next selected MON-139;
claimed through start with owner codex. This evidence precedes commit/push.

Read root/nested instructions, START_HERE/controller/project/map/frontend role,
selected task and dependency evidence, money/migration/PR source sections,
CORE_UI_MONEY_CUTOVER/MONEY_MANIFEST/lexical inventory, actual bill read/write/
lifecycle/payment/debit wire, REST handlers, full registered MCP tools and
disposable PostgreSQL fixtures. Used the memory Dubbl controller-task skill for
one-task execution, scoped staging and final remote verification. No unrelated
changes were present or included.

## Implementation and acceptance mapping

1. Explicit ownership in CORE_UI_MONEY_CUTOVER and MONEY_MANIFEST covers the two
   purchase pages, bill-ui adapter, BillCurrencyAmounts and bill props passed to
   shared InvoiceAmountInput/DualAmount. Headers, line prices/amounts/tax, list,
   count and nullable base fields validate canonical Minor aliases against safe
   retained numeric raw units before bigint adoption; legacy-only reads validate
   the numeric value. Source/base display uses explicit saved currencies; no FX
   or unit rescale occurs. Bigint sums drive currency-grouped outstanding/overdue
   and sampled aging. Only bounded progress/bar ratios become Number. Status
   groups never combine currencies. Backend mixed-currency-within-status counts
   still reject; the UI shows unavailable amounts and retains individual list
   reads. Empty totals show a dash. Aging explicitly labels the latest 100 bills
   actually fetched, rather than implying a complete report. Due-soon cards use
   saved currencies. Aborted main/overview reads, loaded-org/document contexts
   and pagination generations suppress obsolete fetched money; invalid detail
   money suppresses actions. Successful mutations reload all document/base
   amounts rather than merging raw numeric responses into bigint state.
2. Four adapter groups and two actual React render groups exercise USD/JPY/IRR/
   KWD, safe-edge low digits, canonical/conflicting/malformed/unsafe aliases,
   validated legacy fallback, missing lines/invalid quantities, nullable base,
   exact sums beyond safe Number, grouped currencies, bounded percentages and
   positive whole-minor payment input. Fractional-minor, malformed, unsafe,
   nonpositive or above-due payments disable submission and handlers reparse
   amountMinor. Currency text/decimal keyboard/accessible labels and English
   input errors render correctly; above-due feedback and payment busy handling
   were source reviewed. Fractional quantity display no longer truncates.
   The dedicated migrated SQL worker invokes authenticated REST and actual
   linked MCP SDK bill create/read/list/count/update/receive/pay and debit-note
   creation. Independent SQL text checks prices, line amounts/tax, quantities,
   accounts/taxes, headers and paid/due values. Copied prices, tax and discounts
   agree with the existing calculators; copied supported fields survive writes.
   Mixed-currency counts fail in both transports, while tagged list rows and
   nullable missing-FX base display remain readable. Safe-edge SQL prices retain
   9007199254740991 and copy exact decimals. Existing bill write/read/lifecycle,
   payment and debit suites retain domain/role/tenant/period/rollback controls.
3. Scoped monetary float/fixed-two assumptions are removed. Payment sends the
   adopted amountMinor string. The existing supplier-credit action sends saved
   unitPriceExact, explicit currency, physical quantity, account, tax, discount
   and supported cost center; unsupported bill inventory/warehouse/project/
   goods-receipt fields are omitted. Quantity /100 remains nonmoney hundredths.
   Bill reverse-charge amountDue stays authoritative rather than deriving it
   from total. Debit-note standard fully recoverable VAT recognition restrictions
   stay authoritative. Actual pages have no draft monetary editor or bill-copy
   button; no new operation was invented. Draft REST/MCP exact update was still
   checked with the supported copied subset. Saved prices are already rounded:
   0.005 USD x 3 saves amount 2 and price 1; copying that saved price uses 0.01
   under debit-note extended-price policy and produces 3. A pure regression makes
   this explicit; hidden source precision is not reconstructed. Debit-note lines
   have no persisted discount field, although their existing calculator accepts
   the discount and stores the resulting amount. No API policy or schema changed.
   Registered direct-DB MCP already supports the exact fields, so no new tool is
   required. MON-140..142 and MON-132/MON-129/MON-007 remain independently open.

## Verification

Commands ran from D:/Projects/dubbl. No full build, Next dev server, Docker,
deployment, application DB, .env access, provider/email operation or browser
effects were executed. No schema or migration changed.

| Command | Actual result | Scope and limits |
|---|---|---|
| node --import tsx --test tests/bill-ui-money.test.ts tests/bill-ui-components.test.ts | Exit 0, 6/6 after final assertions | Actual adapters and React server rendering |
| node --import tsx --test --test-concurrency=2 tests/integration/bill-ui-money.test.ts tests/integration/bill-writes.test.ts tests/integration/bill-reads.test.ts tests/integration/bill-lifecycle.test.ts tests/integration/payment-settlements.test.ts tests/integration/debit-notes.test.ts | Exit 0, 6/6 | Real REST/MCP and migrated disposable SQL |
| pnpm test | Exit 0, 408/408 | Whole repository unit suite; final focused assertions separately rerun |
| pnpm typecheck; pnpm exec tsc --noEmit | Exit 0 | TypeScript, including final frontend and fixture changes |
| pnpm exec eslint on eight changed/new TS/TSX files | Exit 0, no warnings/errors | Final scoped lint |
| pnpm lint | Exit 0, zero errors, 104 pre-existing warnings | One obsolete FileText warning removed from scoped list |
| python .agentic/scripts/money_inventory.py --write; python .agentic/scripts/money_inventory.py | Exit 0 | 415 columns, 1969 scanned files, 1467 consumers, 27993 occurrences |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0 | Independent Drizzle classification/hash/line verification |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0, 9 checks | Legacy money guard |
| python .agentic/agent.py validate | Exit 0, 192 tasks | Controller structural validation |
| git diff --check | Exit 0 | Whitespace |
| Synthetic psql fixture count; pg_ctl fast stop | Count 0; exit 0 | Disposable databases removed; dedicated server stopped |

Initial worker expectation was corrected from 1547 to 1548 after observing and
checking extended-price rounding before discount/tax (1563 - 156 + 141).
Initial typecheck caught an assertion referencing nonexistent debitNoteLine
discount storage; removed that assertion and documented the existing schema.
Inventory verification after adding final unit assertions correctly detected
source drift; regenerated inventory and both independent checks passed. These
initial failures are not represented as passes.

Dedicated PostgreSQL 18 cluster:
C:/Users/Sajjad/AppData/Local/Temp/dubbl-mon139-pg-59a6cb12c4f94c6da0dc270b61817083,
127.0.0.1:55439, synthetic trust-authenticated dubbl_ci role, loopback only,
max_locks_per_transaction=256, jit=off. Explicit TEST_DATABASE_URL selected this
server. Harnesses created/migrated/dropped random dubbl_ci_* databases and gave
workers their disposable DATABASE_URL. No application database was read/changed.
Final fixture count was zero and dedicated pg_ctl stop passed. Temporary files
remain. No independent accounting/human review, production IRR, full-int64 public
workflow, complete aging report, live browser race or parent acceptance is claimed.

## Review and handoff

Honest self-review recorded in MON-139-review-1.md; no scoped blocker. Complete
controller check/submit/self-review/done, commit only task-owned source/tests/
registries/evidence, push origin/master, verify remote SHA and clean working tree,
query next task and stop. Parent and sibling acceptance remains separate.
