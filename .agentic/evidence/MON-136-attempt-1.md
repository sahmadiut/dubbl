# MON-136 combined receivable UI money - attempt 1

## Identity and scope

2026-10-11, Asia/Tehran; actual operator Codex, self-review only.
Repository D:/Projects/dubbl, master, entry HEAD
3a94d9db5896f53bdc5062540fb819de90778177, clean tree. User authorized completing
and pushing one next task. Live validate/status/next selected MON-136; all four
children were done. Started this integration parent through the controller.
This evidence precedes the scoped delivery commit and push.

Read root/nested rules, entry/controller/project/map/frontend role, selected task,
child evidence, ownership registries, source money/migration requirements, actual
four UI adapters, shared preview/adoption helpers, pages/drawers, registered tools
and existing disposable integration harnesses. Child completion alone was not
used to close this parent. Production implementations were reused after direct
composition checks; no redundant runtime service or new tool was necessary.

## Implementation and acceptance mapping

1. Added tests/integration/receivable-ui-integration.test.ts and its worker. One
   migrated disposable database holds four organization/customer/account contexts;
   each organization registers quotes, credit notes, sales receipts, customer
   credits, invoices and invoice lifecycle in one linked MCP SDK session. Actual
   authenticated REST handlers and UI price/amount/read adapters drive operations.
   CORE_UI_MONEY_CUTOVER, MONEY_MANIFEST and TEST_MATRIX now record independently
   verified MON-136 composition and retain explicit MON-143..146 consumer ownership.
   MONEY_BOUNDARIES was regenerated and independently verified against source.

   Inspected scoped list/detail and drawer reads/writes: exact decimal text and
   unitPriceExact/amountMinor writes; canonical agreeing numeric/Minor validation;
   bigint header/line/balance arithmetic and saved-currency display. Existing
   main-read abort/context guards, application eligibility, normalized reloads,
   sample labels, scrolling/wrapping and English invalid-money alerts are retained.
   Quote/credit default USD independently of contact/org. Receipt/prepayment use
   explicit/contact/org/USD currency resolution. No stored values are rescaled.

2. Eight combined workflows cover REST and MCP creation/conversion/application/
   receipt post/void across USD, JPY, synthetic IRR and KWD. Literal SQL-text
   expectations verify both rounding policies: a 3000000001-minor quote line plus
   three half-minor prices saves 3000000004; the corresponding credit and receipt
   save 2 minor units each. Quantity remains 300 stored hundredths. Converted
   invoice total and quote billedTotal retain the quote total exactly.

   A sent credit applies 2 and a 1250-minor prepayment applies 1 to the SAME
   converted/recognized invoice. SQL and both transport reads retain amountPaid=3,
   amountDue=3000000001 and prepayment remaining=1249. Credit void restores only
   those 2 invoice units: amountPaid=1, amountDue=3000000003; the prepayment remains
   1249. Cash receipt recognition balances exact 2-unit debit/credit totals, and
   void removes it from collected sample totals. Saved aliases are tampered in
   memory to verify rejection without persisting invalid rows.

   Foreign quote reads reject through both transports. Malformed decimal prices
   in quote/credit/receipt create, unsupported unsafe prepayment amounts and
   prepayment application beyond its remaining balance fail through both transports.
   Before/after scoped SQL snapshots preserve document counts, invoice paid sum,
   prepayment remaining sum, allocation count and journal count. Default tests use
   the SAME customer/org to distinguish quote/credit USD from cash/prepayment
   contact KWD and then organization currency, preserving original raw 1250 units.
   Mixed-currency loaded prepayment summary agrees with grouped SQL text sums.

   Four child migrated UI fixtures pass again. Eighteen focused adapter/static
   React render groups independently verify English saved values and labels,
   accessible decimal input/error alerts, currency scales, safe-edge low digits,
   malformed/range/tax/alias rejection, quantities, summaries and application limits.
   The complete 451-test unit suite passes, including these focused groups.

3. Safe numeric wire compatibility remains bounded; canonical Minor strings must
   agree and unsupported public values fail. UI bigint sums do not establish
   full-int64 business workflows. Physical quantity hundredths and tax/discount
   basis points remain nonmoney; counts/pages/dates/status keep their units.
   Loaded sample summaries, the latest-100 invoice picker, static USD illustrations
   and unavailable mixed-currency credit summaries retain existing contracts.
   No monetary fixed-two exception remains in this four-domain slice; shared
   pending consumers retain their documented owners. No UI FX is inferred.
   MON-131 retains its wider invoice/recurring/receivable composition, MON-133
   retains remaining accounting/banking/shared consumers, and MON-129/MON-007
   remain open. No API/MCP/schema/production IRR flag change or live browser,
   provider/PDF, production/accounting/linguistic qualification is claimed.

## Verification

All commands ran in D:/Projects/dubbl. Integration used a task-specific synthetic
PostgreSQL 18 cluster at 127.0.0.1:55479 with a trust-authenticated dubbl_ci role,
max_locks_per_transaction=256 and jit=off. Explicit TEST_DATABASE_URL points only
there; workers receive randomly named migrated disposable databases. A recorded
synthetic exact KWD-to-org rate of 1 supplies foreign-currency default prepayment
recognition only; it is neither a live market rate nor production qualification.
No .env read or application database change. Final database count was 0 and the
cluster stopped successfully; task-specific temporary cluster files are retained.

| Command | Actual result | Limit |
|---|---|---|
| node --import tsx --test --test-concurrency=2 tests/quote-ui-money.test.ts tests/credit-note-ui-money.test.ts tests/sales-receipt-ui-money.test.ts tests/customer-prepayment-ui-money.test.ts | Exit 0, 18/18 | Pure adapters and static React render, no interactive browser |
| node --import tsx --test --test-concurrency=1 tests/integration/receivable-ui-integration.test.ts tests/integration/quote-ui-money.test.ts tests/integration/credit-note-ui-money.test.ts tests/integration/sales-receipt-ui-money.test.ts tests/integration/customer-prepayment-ui-money.test.ts | Exit 0, 5/5 | Actual REST/MCP/SQL; new worker asserts 8 composed workflows |
| node --import tsx --test --test-concurrency=2 tests/*.test.ts | Exit 0, 451/451 | Full unit suite |
| pnpm typecheck | Exit 0 | MDX generation and tsc, no build |
| pnpm exec eslint tests/integration/receivable-ui-integration.test.ts tests/integration/receivable-ui-integration-worker.ts | Exit 0, no warnings/errors | Both new TypeScript files |
| pnpm lint | Exit 0, 0 errors/102 existing warnings | No production files changed |
| python .agentic/scripts/money_inventory.py --write; then without arguments | Exit 0 | 415 columns, 1515 consumer files, 28930 occurrences; lexical inventory |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0 | Drizzle columns, current source hashes and occurrence lines |
| node .agentic/scripts/verify_legacy_money.mjs | Exit 0, 9 regression checks | Legacy lint guard |
| python .agentic/agent.py validate | Exit 0, valid 202 tasks | Structural validation only |
| git diff --check | Exit 0 | Whitespace check |
| Synthetic psql fixture count / pg_ctl fast stop | 0 fixture databases / exit 0 | Temporary files retained |

Initial verification caught worker-only mistakes: incomplete saved-line TypeScript
metadata, allocation organization lookup requiring its payment join, and missing
synthetic FX for default KWD prepayment recognition. All were corrected in the
fixture, and final typecheck plus all five migrated suites passed. No runtime
regression repair was needed. No build/dev server, Docker, outbound provider,
deployment or production flag changes were performed.

## Review and handoff

Actual self-review: MON-136-review-1.md, performed by the same implementing
assistant. DEC-005 requires no screenshots. MON-136 acceptance is met without
closing wider parent criteria. Complete controller checks/submission/review/done,
commit only task-owned files, push origin/master, verify remote SHA and clean
tree, report the next controller task and stop.
