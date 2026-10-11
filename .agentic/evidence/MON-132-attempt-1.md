# MON-132 attempt 1 - Combined payable/procurement UI acceptance

## Identity

2026-10-11, coding-assistant, D:/Projects/dubbl, master. Entry HEAD
a8dae95c; working tree clean. Controller validate/status/next selected MON-132,
then start claimed it. All five children MON-138..142 were already done; this
is independent integration acceptance, not inference from their status.

## Implementation and audit result

Reused the existing child implementations after reading their evidence and actual
UI helpers/consumers. Added tests/integration/payable-ui-integration.test.ts and
its worker, updated CORE_UI_MONEY_CUTOVER ownership and MONEY_MANIFEST, refreshed
MONEY_BOUNDARIES, and completed this task's evidence/handoff/controller record.
No production code, API/MCP contract, schema, migration or history changed.

Source review covers purchases list/detail; debit-note list/detail; order,
requisition and goods-receipt lists/details; recurring-bill list/create sheet;
BillDrawer, DebitNoteDrawer, PurchaseOrderDrawer; shared LineItemsEditor policies;
bill-editor, bill-ui, debit-note-ui, procurement-ui, recurring-bill-ui;
BillCurrencyAmounts, InvoiceAmountInput/DualAmount, debit/procurement details and
RequisitionLineEditor. Explicit currency/policy props and adopted saved money
helpers remain at these boundaries. No separate SupplierCreditDrawer exists:
the actual supplier-credit action is the saved bill's debit-note copy. Corrected
the registry's stale pending/shared-default wording and recurring ownership row.

## Acceptance mapping

1. The manifest/ownership table names MON-138..142 sections and the parent's new
   integration fixture. Actual UI payload/adoption helpers drive authenticated
   REST and registered MCP SDK calls in a single migrated database. For USD, JPY,
   synthetic IRR and KWD, each transport creates ordinary bills, receipt-derived
   bills, requisition-to-PO direct bills and recurring-generated bills, then reads
   through both transports and copies supplier credits. SQL-text checks raw prices,
   totals, line amounts and physical quantities. Recognition, allocation, remaining
   credit, void/unwind, list balances and PO billed tallies agree. Draft recurring
   generation completes once and never repeats; bill recognition stays separate.
2. The eight-suite combined run passes and the final enhanced parent rerun passes.
   The full 447-test unit suite includes actual React English controls/details,
   currency scales, low digits/safe edges, signed/sub-minor ties, malformed/alias
   rejection, unknown tax and unsafe inputs, reverse-charge due amounts, discount/
   dimension copies, payment/base reads and mixed-currency summary rejection.
   Two half-unit receipt lines each round to one unit, yielding a 2-unit bill and
   copied credit; quantities remain 50 hundredths and billed tallies update only
   at recognition. The enhanced parent exercises original USD 0.005 x 3: bill total
   2, saved price 1, copied credit 3, allocation 2, leftover credit 1, then reversal.
   Both transports enforce the bill balance bound. No float price conversion is
   used and the original sub-minor input is not falsely reconstructed.
3. Explicit compatibility: recurring payable price input always multiplies by 100
   and rounds price before extension, in every currency. 12.50 becomes 1250 raw
   price units; generated bills and copied credits retain those units and format
   by saved currency (USD 12.50, JPY/IRR 1250, KWD 1.250). Supplier-credit copying
   preserves SAVED rounded prices, not unstored original precision, under the
   debit domain calculator. Ordinary bill/debit/PO prices retain currency-scale
   wire policies. Quantity hundredths, tax/discount basis points, numeric counts/
   bounded progress ratios and static USD illustrations remain explicit nonmoney
   or presentation exceptions. Safe numeric wire fields coexist with canonical,
   agreeing Minor strings. Sample/group/count contracts and unavailable mixed/
   missing-base summaries remain. MON-129 and MON-007 retain independent acceptance.

## Verification

All commands ran in D:/Projects/dubbl. Explicit TEST_DATABASE_URL selected a
dedicated loopback synthetic trust-authenticated PostgreSQL 18 cluster at
127.0.0.1:55432, role dubbl_ci, max_locks_per_transaction=256, jit=off, under
C:/Users/Sajjad/AppData/Local/Temp/dubbl-mon132-pg-725ab732396b4397931b8fa4409f12ac.
Each wrapper created/migrated/dropped a randomly named database; workers only
received that disposable DATABASE_URL. No application .env/database was accessed.

| Command | Actual result | Limit |
|---|---|---|
| node --import tsx --test --test-concurrency=2 tests/integration/payable-ui-integration.test.ts tests/integration/bill-editor-money.test.ts tests/integration/bill-ui-money.test.ts tests/integration/debit-note-ui-money.test.ts tests/integration/procurement-ui-money.test.ts tests/integration/recurring-bill-ui-money.test.ts tests/integration/payable-procurement-integration.test.ts tests/integration/recurring-payables.test.ts | Exit 0, 8/8 | Combined parent, all child UI transports and domain integration regressions |
| node --import tsx --test tests/integration/payable-ui-integration.test.ts | Exit 0, final 1/1 | Enhanced parent includes saved-price precision and leftover-credit assertions |
| node --import tsx --test --test-concurrency=2 tests/*.test.ts | Exit 0, 447/447 | Whole unit suite, including behavioral/React checks |
| pnpm typecheck | Exit 0 after typed transport fixes | MDX and TypeScript; no build |
| pnpm exec tsc --noEmit and scoped eslint on both new TS files | Exit 0 in final run | Final fixture types and scoped lint |
| pnpm lint | Exit 0, zero errors/102 existing warnings | Warnings outside new files |
| python .agentic/scripts/money_inventory.py --write | Exit 0, 415 columns/2014 files/1508 consumers/28801 occurrences | Source lexical inventory, not financial proof |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0 | Drizzle metadata, actual consumer hashes/source lines |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0, 9 checks | Legacy-money guard |
| python .agentic/agent.py validate | Exit 0, 202 tasks | Workflow structure |
| git diff --check | Exit 0 | Whitespace |
| Synthetic psql database count / pg_ctl fast stop | 0 fixture databases; exit 0 stop | Temporary cluster files retained |

Initial new-fixture runs exposed unsupported dueDate on the debit-note payload
and a missing required dueDate on the added ordinary-bill precision case; fixed
the fixture's operation-specific field sets. Initial typecheck required explicit
wire types so generic adoption retained contact/status/balance properties. These
were fixture defects, not production regressions. Final runs above use corrected
inputs/types; no failing intermediate run is represented as passing.

## Review and handoff

Honest self-review: MON-132-review-1.md. DEC-005 permits behavioral/layout review
without screenshots. No live browser effect/accessibility audit, hosted CI,
financial/native-language review, production IRR, full-int64 business posting,
PDF/provider, migration rehearsal or deployment is claimed. No full build,
unrequested dev server or Docker was run. MON-129/MON-007 and other integrations
remain independent. Complete check/submit/self-review/done, commit task-owned
files, push origin/master, verify remote SHA/clean tree, report next task and stop.
