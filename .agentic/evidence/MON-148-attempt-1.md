# MON-148 attempt 1 - Payment and allocation UI exact money

## Identity

2026-10-11, Asia/Tehran; operator codex in D:/Projects/dubbl on master.
Entry HEAD 5b19fbc4418de7e7bf23face38340171762927ea; clean working tree.
Controller validate/status/next selected MON-148, started by codex. User authorized
completing and pushing one next task. This evidence records the scoped change;
it does not invent a delivered commit SHA. Self-review only.

## Acceptance mapping

1. CORE_UI_MONEY_CUTOVER and MONEY_MANIFEST enumerate sales/payments list/detail,
   banking/batches list/create/detail/remittance and banking/scheduled
   list/create/cancel/process, payment-ui.ts and PaymentAmountPreview. Read
   adapters validate safe numeric amounts against canonical optional Minor
   aliases before bigint conversion. Signed noncash allocations are retained;
   allocated/unallocated and sample totals/averages use bigint. Average ties
   preserve the old Math.round signed rule through exact floor(x + 1/2).
   Summaries group currency, label the loaded sample and never invent FX.
   Amount sorting groups currencies before comparing bigint values.
   Batch items/remittance lines must agree with saved total and currency.
   Decimal text is parsed without money Number round trips or fixed /100.
   Batch create has one explicit currency, distinct loaded bills, matching
   suppliers, positive whole-minor amounts, due bounds and safe aggregate sum.
   The parsed result drives preview and amountMinor payloads. Schedule create
   uses the same scale/due/range policy and an English exact preview/error.
   Invalid saved money suppresses monetary displays/actions with an alert.
   Initial schedule processing is preserved; filter changes only read the list.
   Read aborts, org/id remounts, schedule generations and confirmation org checks
   protect stale state. Bill selection is keyboard accessible; amounts wrap.
   Eighteen legacy-reference allowances were removed from the five pages.
2. Four pure/static React groups cover USD/JPY/synthetic IRR/KWD, low digits,
   safe edges and sums beyond safe Number, signed averages/carriers, malformed,
   fractional-minor, range, conflicting/noncanonical alias rejection, missing/
   mismatched bills/suppliers/currency, overpayment and batch sum overflow.
   Real authenticated REST and linked registered MCP exercise sixteen composed
   workflows (four currencies, two transports, raw 1250 and 3000000001): received
   payment create/read with covering cash allocations, two-bill batch create/
   read/submit/remittance, schedule create/process/list. SQL text independently
   verifies payment/allocation amounts, batch/item sums and completed schedule/
   bill paid/due balances. Fixture accounts/orgs use the same currency, identity
   FX and synthetic data; no production IRR or live-market-rate qualification.
   Existing payment reads, settlement, batch and schedule fixtures separately
   verify malformed/range aliases, ownership/permissions, currency/FX, period
   locks, atomic negative cases, retries and saved lifecycle behavior.
3. Historical leftover allocation has no REST/MCP operation. The old detail
   button called invoice pay, recording new cash rather than allocating the
   existing payment. Removed that misleading write; saved leftovers remain
   visible with an English explanation. No reallocation API was fabricated.
   Lists retain default 50-row samples and bill/label pickers are capped at 100;
   summaries are not all-page balances. Safe numeric API coexistence remains;
   no stored units are rescaled. Existing invoice/bill payment controls and
   shared InvoiceAmountInput remain owned by MON-135/MON-139; receipt/prepayment
   drawer money remains MON-145/MON-146. No standalone payment create drawer
   exists. Expenses/banking/tax controls remain MON-149/150/151. Auxiliary
   public/contact/report/payroll/loan/background consumers retain their domain
   and MON-008 ownership. MON-133, MON-129 and MON-007 retain independent
   integration. No schema, migration, REST/MCP operation, FX policy or flag change.

## Verification

Commands ran in D:/Projects/dubbl. Integration used an explicit loopback
TEST_DATABASE_URL on port 55478 and a newly initialized dedicated PostgreSQL 18
cluster. Each test created, migrated and dropped a random fixture database.
No .env access, application database mutation, build/dev server, Docker,
provider delivery, deployment or production flag change.

| Command | Actual result | Limits |
|---|---|---|
| node --import tsx --test tests/payment-ui-money.test.ts | Exit 0, 4/4; final rerun after signed-average/copy review | Pure/static React, no browser effects |
| node --import tsx --test tests/integration/payment-ui-money.test.ts | Exit 0, 1/1, sixteen REST/MCP/SQL workflows | Synthetic migrated PostgreSQL 18 |
| node --import tsx --test --test-concurrency=1 selected payment-batches/payment-reads/payment-settlements/scheduled-payments integration files | Exit 0, 4/4 | Existing domain negatives/lifecycle/security |
| node --import tsx --test --test-concurrency=2 tests/*.test.ts | Exit 0, 455/455 | Final focused 4/4 rerun covers subsequent signed-average/copy refinement |
| pnpm typecheck | Exit 0 | MDX and tsc, no full build |
| pnpm exec eslint ten changed/new TS/TSX files | Exit 0, no warnings | Final scoped files including all tests |
| pnpm lint | Exit 0, 0 errors/102 existing warnings | Unrelated warnings retained; final scoped lint clean |
| python .agentic/scripts/money_inventory.py --write | Exit 0; 415 columns, 2028 files, 1522 consumers, 29072 occurrences | Conservative source inventory |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0 | Drizzle/source hashes/lines |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0, 9 checks | Legacy reference guard |
| python .agentic/agent.py validate | Exit 0, 202 tasks | Controller structure only |
| git diff --check | Exit 0 | Whitespace |
| Dedicated psql fixture count; pg_ctl fast stop | 0 fixture databases, stop exit 0 | Dedicated synthetic cluster only |

Initial new fixture runs incorrectly omitted purchasing tool registration and
used batchId instead of generate_remittance's paymentBatchId; corrected the
fixture to actual schemas, then it passed. Temporary typecheck failures during
page refactoring and fixture role typing were repaired without weakening checks.
No assertion, timeout or existing test was weakened. English copy was refined
and negative average tie behavior preserved during self-review; focused tests
and static checks were rerun for those changes.

## Review and handoff

See MON-148-review-1.md for honest self-review. DEC-005 permits behavioral/layout
review without screenshots. No live browser, production IRR, full-int64 business,
financial/linguistic qualification, provider/email/PDF or parent completion claim.
Complete scoped controller transitions, commit/push authorized task-owned files,
verify origin/master SHA and clean tree, report the next controller task and stop.
