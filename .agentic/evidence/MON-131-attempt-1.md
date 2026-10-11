# MON-131 receivable document UI combined acceptance - attempt 1

## Identity and scope

2026-10-11, Asia/Tehran; operator coding-assistant (Codex), self-review only.
Repository D:/Projects/dubbl, master, entry HEAD
2aad9e2d (full SHA available in Git); entry tree clean. User authorized completing
and pushing the next task. Live validate/status/next selected MON-131, all four
children done; started via controller. This evidence precedes the delivery commit.

Read root rules, controller/entry/project/map/frontend role, selected task and
MON-134..137 evidence, ownership registries, source money/migration requirements,
actual scoped adapters/pages/shared editor/drawer, direct-DB MCP registrations and
existing fixtures. Used the memory controller-task skill for scoped delivery.
Existing production implementations were reused; child completion alone was not
used to complete this parent's acceptance.

## Implementation and acceptance mapping

1. Added tests/integration/receivable-document-ui.test.ts and its worker, with
   independent combined acceptance recorded in CORE_UI_MONEY_CUTOVER,
   MONEY_MANIFEST and TEST_MATRIX. Existing explicit domain rows enumerate all
   receivable lists/details/drawers/shared components/adapters. MON-134 owns exact
   invoice creation/shared editor; MON-135 saved invoice lifecycle; MON-136 owns
   quote/credit/receipt/prepayment via MON-143..146; MON-137 recurring invoices.
   No new runtime operation requires a new tool; existing registered direct-DB
   MCP operations are exercised in one linked session per organization.

   Direct source inspection confirms exact unitPriceExact/amountMinor submissions,
   explicit preview policies and currencies, validity gating/reparsing, canonical
   agreeing saved aliases, bigint amounts/sums and saved-currency presentation.
   Main money reads use context guards/remounts/abort protection; existing scrolling,
   wrapping, accessible decimal controls and English invalid-money alerts remain.
   Source layout review and actual static React rendering meet DEC-005; live browser
   effects are not claimed. Monetary float/fixed-two matches in other shared drawer
   sections and sales/payments belong to remaining owners outside MON-131.

2. Twenty-four workflows compose direct invoice REST/MCP creation, accepted quote
   conversion and recurring draft generation across USD/JPY/synthetic IRR/KWD.
   Literal independent SQL text expectations preserve 3000000001 raw units and a
   half-minor price times three. REST invoice/quote/recurring total is 3000000004;
   MCP direct invoice total is 3000000003 under extended-price rounding. Stored
   rounded price is 1 and physical quantity is 300 for all. Saved-copy/PATCH uses
   that stored price, producing 3000000004 in every origin. Original sub-minor
   decimal text is not recovered. Recurring upcoming dates/cap and nextRunDate/
   occurrencesGenerated are verified through generation and saved reads.

   Every origin is recognized; 1 unit cash plus 1 unit prepayment plus 2 units
   credit produces amountPaid=4 and amountDue=3000000000. Prepayment original 1250
   retains 1249, while a 3-unit copied credit retains 1. Both transport saved UI
   reads and REST base amounts agree; recognition journal has equal debit/credit
   3000000004. Credit void restores only its 2 units: paid=2, due=3000000002,
   prepayment remains 1249. Credit creation maps only supported fields, preserving
   its narrower strict contract rather than copying invoice inventory/project keys.

   Malformed creates, overpayments and excessive prepayment allocations reject
   through both transports, preserving ordered invoice/line JSON snapshots,
   payment/journal counts and prepayment remaining sums. Cross-org reads and MCP
   settlement reject. In-memory alias tampering fails adoption without corrupting
   persisted rows. MON-136's separate combined workflow jointly verifies receipt
   post/void, credit/prepayment on converted invoices, currency defaults and grouped
   mixed-currency saved summaries. All seven domain UI transport fixtures rerun.

   Thirty-five focused behavior/static React tests verify currency scales, signed
   ties, safe-range low digits/product/sum overflow, malformed/conflicting aliases,
   quantity rounding/defaults, tax/discount controls, copied dimensions, summary
   meaning and English accessible controls. Full unit suite passes 451/451.

3. Safe numeric compatibility must agree with canonical Minor strings; UI bigint
   arithmetic does not qualify full-int64 workflows. Physical hundredths, tax/
   discount/deposit basis points, counts/pages/dates and schedule controls retain
   their units. Sample aggregates, latest-100 invoice picker, unavailable mixed
   summaries and static USD illustrations preserve documented contracts. Exact
   saved units are never rescaled and UI never infers FX. Monetary float/fixed-two
   assumptions are removed in this slice; remaining shared defaults retain their
   explicit owners. No runtime/API/MCP/schema/IRR flag change was required.
   MON-129 and MON-007 retain independent acceptance; MON-133 and other owners
   retain remaining cash/tax/account/shared consumers and qualification work.

## Verification

All commands ran from D:/Projects/dubbl. Explicit TEST_DATABASE_URL selected a new
trust-authenticated synthetic PostgreSQL 18 cluster at 127.0.0.1:55431, role
dubbl_ci, loopback only, max_locks_per_transaction=256 and jit=off. Each wrapper
created/migrated/dropped its randomly named disposable database. No .env read or
application DB mutation. Final fixture DB count was 0; cluster stopped successfully.
Temporary cluster files retained. IRR fixtures do not enable production IRR.

| Command | Actual result | Limit |
|---|---|---|
| node --import tsx --test --test-concurrency=1 tests/integration/{receivable-document-ui,receivable-ui-integration,document-editor-money,invoice-ui-money,recurring-invoice-ui-money,quote-ui-money,credit-note-ui-money,sales-receipt-ui-money,customer-prepayment-ui-money}.test.ts (explicit paths, not shell braces) | Exit 0, 9/9; parent worker asserts 24 workflows | Actual migrated REST/MCP/SQL, synthetic PostgreSQL 18 |
| node --import tsx --test --test-concurrency=2 tests/{document-editor-money,document-editor-components,invoice-ui-money,invoice-ui-components,quote-ui-money,credit-note-ui-money,sales-receipt-ui-money,customer-prepayment-ui-money,recurring-invoice-ui-money}.test.ts (explicit paths) | Exit 0, 35/35 | Pure behavior and static React, no browser effects |
| node --import tsx --test --test-concurrency=2 tests/*.test.ts | Exit 0, 451/451 | Complete unit suite |
| pnpm typecheck | Exit 0 | MDX generation/tsc, no build |
| pnpm exec eslint tests/integration/receivable-document-ui.test.ts tests/integration/receivable-document-ui-worker.ts | Exit 0, no warnings/errors | New TypeScript files |
| pnpm lint | Exit 0, 0 errors/102 existing warnings | Existing production files unchanged |
| python .agentic/scripts/money_inventory.py --write; then without arguments | Exit 0, 415 columns/1517 consumer files/28974 occurrences | Lexical source inventory |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0, columns/hashes/source lines verified | Independent Drizzle/source verification |
| node .agentic/scripts/verify_legacy_money.mjs | Exit 0, 9 regression checks | Legacy regression guard |
| python .agentic/agent.py validate | Exit 0, valid 202 tasks | Structural validation |
| git diff --check | Exit 0 | Whitespace |
| Synthetic psql DB count / pg_ctl fast stop | 0 / exit 0 | Cluster stopped; temporary files retained |

Initial new-fixture checks caught unsupported invoice-copy fields sent to credit
creation, quote-only payload fields, missing quote acceptance and TypeScript
generic narrowing. Corrected fixture setup/adoption only; no production regression
repair was needed. Final joint nine transport suites and static checks pass.
No full build, dev server, Docker, provider call, deployment or production flag
change. Hosted CI/PostgreSQL 16, live browser, provider/PDF, production/accounting/
linguistic/release and full-int64 business qualification are not claimed.

## Review and handoff

Honest same-assistant self-review: MON-131-review-1.md. Complete controller checks,
submission/review/done, task-owned commit/push and remote SHA/clean-tree checks.
Report the next selected task and stop; wider parent criteria remain open.
