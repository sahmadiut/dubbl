# MON-043 attempt 1 - exact sales receipt contracts

## Identity

2026-10-03 (Asia/Tehran). Operator: codex; implementing-assistant self-review,
no peer/human/accounting or deployment approval. Entry HEAD `e2e9bf2`, master,
clean working tree. The user requested the next task and commit/push after full
completion. Controller selected/started MON-043 in the valid 95-task graph;
no scope split or waiver. Evidence written before the requested commit.

Read root/nested AGENTS, START_HERE/controller/project/map/backend role, task,
MON-011 dependency evidence, ADR-006, money manifest, source migration/API sections,
existing receipt UI/REST/MCP/schema, invoice pricing/reference/FX/stock services,
credit/quote contracts and integration fixtures. Reused existing correct exact
helpers; no new library or framework was needed.

## Implementation and bounded scope

- `lib/api/sales-receipt-wire.ts`: strict sale/date/dimension/price/list/patch/post
  contracts. Both REST and MCP numeric prices retain decimal major units; exact
  major/minor aliases agree explicitly. No price lookup is introduced. Bigint
  ratios preserve extended-price rounding, discount basis points and exclusive
  tax rounding, with safe-number coexistence limits. Header/line output and
  retained balance checks reject unsafe/corrupt data, without unit rescaling.
- `lib/api/sales-receipts.ts`: shared org-scoped Drizzle services for seven
  operations. Organization/receipt and reference/stock locks serialize new
  numbering, atomic draft header/lines, whitelisted update/soft-delete, post and
  void. Bank/deposit and all line dimensions are tenant checked, including plain
  project UUIDs. Complete revenue/tax recognition debits the whole cash total;
  missing revenue accounts can no longer silently disappear. Bank auto-linking,
  control accounts, exact historic FX, ledger, average/FIFO warehouse stock and
  paid state share one transaction. Void swaps saved journal amounts/FX and
  dimensions with reversal links, verifies matching stock issues/cost-vs-COGS,
  restores original issue values/FIFO layers and reverses saved COGS. Zero-cost
  stock restores quantities without a zero-value journal. Unsupported unlinked
  historic stock or unqualified saved FX fails, without silently using current
  market rates or current issue costs. Successful operations await existing
  best-effort audit logging.
- Four receipt REST files delegate to services and shared safe responses. Added
  draft PATCH/DELETE and corresponding MCP update/delete tools. Seven SDK tools
  use wrapTool, described schemas and direct services. Existing five tool names
  and response envelopes/numeric price units remain. Header/line/contact/bank
  money gains named exact string aliases. No public mode/header is invented.
- `tests/sales-receipt-wire.test.ts`: five groups for exact/numeric aliases,
  extended-price/subminor/tie/discount/tax rounding, USD/IRR/JPY/KWD scales,
  safe-edge/overflow/products/sums, corrupt stored balance guards, whitelisted
  edits/list filters and malformed/empty JSON.
- `tests/integration/sales-receipts.test.ts` and worker: real API-key handlers
  and registered SDK callbacks against migrated disposable PostgreSQL. Fixtures
  exercise every operation, legacy/exact/dual clients, custom permissions, two
  tenants/conflicting organization header, all foreign dimension/cash inputs,
  current/old/new locks, numeric compatibility, max-safe posting/reversal,
  unsafe retained header/price/cost/FX product, inactive revenue and historical
  reversal, complete cash/revenue/tax recognition, bank precedence/linking,
  missing FX/currency mismatch, changed-rate reversal, average/FIFO/zero-cost
  stock/warehouse restoration, missing/corrupt saved issues and wrong journals.
  REST/MCP post/void races produce one successful transition, and first-sequence
  concurrent creates get unique numbers. Fault triggers after header/sequence,
  line replacement, ledger/bank/chart/stock and reversal writes roll back entire
  snapshots. Snapshots include audit counts, excluding auth last-used metadata.
- Added SALES_RECEIPT_WIRE_CONTRACTS registry, money README/manifest/test matrix,
  refreshed reproducible source inventory and removed the two adopted deprecated
  money import allowances. Existing MCP registration in index.ts remains valid.

No schema change/migration generation is needed. No app DB mutation, IRR flag,
development server, full build, Docker or deployment.

## Acceptance mapping

1. SALES_RECEIPT_WIRE_CONTRACTS.md inventories all seven REST and seven MCP
   operations, envelopes, legacy major-price/minor-output contracts, exact aliases,
   currency defaults, rates/direction, safe monetary/int32 quantity/discount limits,
   filters, cash precedence, auth/locks/error behavior and qualification limits.
   All MCP input fields describe units/expectations; one tool per operation.
2. The unit and PostgreSQL workers invoke actual shared primitives, authenticated
   handler exports and SDK-registered tools for legacy/exact/dual price input,
   roles/custom permission denial/two-org isolation, every dimension/cash input,
   dates, max-safe/unsafe persisted money, lifecycle history and concurrency.
   There are no mocked database mutations or HTTP self-calls.
3. Strict inputs/exact arithmetic/DTO preflight and transactional services reject
   unsupported ranges, conflicting aliases, foreign references, corrupt balances,
   FX and stock history without committed mutation. Failed-operation snapshots
   and injected-fault snapshots qualify actual rollback. Numeric JSON stays safe
   minor units with additive strings; no bigint JSON crash, mixed-unit conversion
   or stringification of an already-rounded unsafe Number is accepted.

## Verification

All commands ran in `D:/Projects/dubbl`. Actual disposable PostgreSQL 18.6 cluster:
`D:/Temp/dubbl-mon043-pg-d7f417bd216542f7b7711c303630fe67`, loopback 55453,
synthetic dubbl_ci role, no provider credentials. Explicit TEST_DATABASE_URL
selected only that cluster; harness creates/migrates/drops random dubbl_ci_*
databases. Server launched hidden. No configured app database was migrated/reset.

| Actual command/procedure | Observed result | Limits |
|---|---|---|
| Controller validate/status/context/start | Exit 0, 95 valid tasks, MON-043 selected | Workflow only |
| `node --import tsx --test tests/sales-receipt-wire.test.ts` | Exit 0, 5/5 groups | Pure contracts |
| `node --import tsx --test --test-concurrency=1 tests/*.test.ts` | Exit 0, 130/130, 24.32s | Before final saved-stock/COGS guard; final targeted checks below |
| Combined receipt/credit/invoice-lifecycle PostgreSQL integration | Exit 0, 3/3 workers, 27.93s | Authenticated direct handler/SDK fixtures, not browser/session/OAuth |
| Final receipt PostgreSQL worker after saved-history hardening | Exit 0, 1/1, 8.02s | All expanded operation/range/race/rollback fixtures |
| `npm run typecheck`, final `npx tsc --noEmit` | Exit 0 | MDX/TypeScript; no Next build/dev |
| `npm run lint` | Exit 0, 0 errors / 159 existing warnings | Full repo before final guard; final changed-code lint below |
| Final targeted ESLint of all receipt routes/services/tools/fixtures | Exit 0, clean | After final guard/callback fixes |
| Final receipt/legacy-money-lint unit checks | Exit 0, 6/6 | After removal of receipt legacy import allowances |
| Inventory --write, reproducibility and Drizzle/source verifier | Exit 0; 410 columns, 1377 paths, 1134 consumer hashes, 22074 occurrences | Conservative lexical inventory, not transitive dataflow |
| Temporary database count and pg_ctl fast stop | Count 0; stop exit 0, server stopped | Only synthetic fixture databases; cluster files retained outside repo |
| `git fetch origin`, divergence | Exit 0, 0 ahead / 0 behind at entry | Before user-authorized commit/push |
| `git diff --check` | Exit 0 | Line-ending notices only |

An initial attempt to create disposable databases using the configured app role
failed with CREATEDB permission denied before mutation. Used a separate temporary
cluster instead; app-role privileges were not broadened. Initial worker failure
was a fixture GET request carrying a body; corrected that test request. Typecheck
identified helper narrowing and a forEach callback passing an index into an
optional boolean argument; replaced these with a declared never-returning helper
and explicit lambda. Final checks pass. No failed check is claimed as passed.

## Review and handoff

Actual self-review is recorded in MON-043-review-1.md. No bounded-slice blocker.
Full-int64 ORM/business cutover, full inventory writers and current item account
configuration, external period-lock/base-currency writer coordination, historical
unlinked stock, receipt base-currency snapshot policy, frontend/PDF/provider,
combined MON-019 financial integration and accounting/release/IRR qualification
remain their assigned gates. Create has no new idempotency-key protocol; concurrent
duplicate post/void is protected. Audit retains its best-effort policy. Functional
IRR is still disabled. Task closure and requested commit/push follow verification;
next task MON-044. Stop after this task.
