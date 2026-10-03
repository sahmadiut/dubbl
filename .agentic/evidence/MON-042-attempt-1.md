# MON-042 attempt 1 - exact receivable credit contracts

## Identity

2026-10-03, Asia/Tehran. Operator: codex. Entry HEAD `1694b63`; clean working
tree at entry. Changes are uncommitted at evidence creation. User authorized the
next task, commit and push; subsequent continue retained that scope. Controller
selected/started MON-042 in the existing 95-task graph. No split or waiver.
Self-review only, with no independent accounting/security/production approval.

Read root/nested instructions, START_HERE/controller/project/repository map,
backend role, task/dependency evidence, ADR-006, source money/migration/API
sections, MON-021 and manifest. Inspected real credit/available-credit REST,
credit-note/tax/sales-receipt MCP, numeric ORM/FX/stock/posting helpers, DB schemas,
frontend create/send/application/summary paths and disposable fixture harness.

## Implementation

- `lib/api/credit-wire.ts`: strict described fields, explicit REST-major versus
  MCP-minor prices, decimal-major and canonical-minor aliases, agreement checks,
  bigint extended-price/discount/tax math and safe totals. Positive minor amount
  aliases for customer-credit create and both applications. DTOs preserve numeric
  header/line/contact/summary/available values and add named exact strings.
- `lib/api/credits.ts`: shared direct-DB scoped services for fourteen operations.
  Draft edits whitelist headers/lines; foreign customer/invoice/currency/dimensions
  and unsupported saved balances fail. Old/new issue and affected/posting dates
  honor period locks. Organization/document/invoice locks serialize numbering,
  state changes and applications. Sequence/header/lines/GL/carrier/stock/bank
  linking commit atomically; failed transactions emit no success audit.
- Recognition uses qualified exact invoice posting primitives exported without
  changing their behavior. Credit notes post full revenue/tax/AR; missing line
  account defaults to active revenue 4000, avoiding the prior underrecognition
  helper policy. Own posted recognition is required for application. Customer
  credits post cash/deposits with exactly one asset/bank and matching bank currency.
  Notes offset open items without a second AR posting. Customer application
  retains application-date FX with exact conversion; carrying-value settlement
  coordination remains MON-021/MON-007.
- Void validates and mirrors saved recognition FX/base legs; validates carrier
  ownership, amount agreement, complete allocations and note/invoice balances;
  unwinds multiple applications atomically. Foreign or unsafe history rejects.
  Summary reads monetary strings and sums with bigint, rejects mixed currencies,
  individual unsafe rows and unsafe status/overall sums; old int32 casts removed.
- `credit-stock.ts`: returns preserve existing whole-unit average/FIFO policy;
  new movements/COGS attach note ID. Void uses saved quantities/costs after invoice
  or price edits. Consumed FIFO/warehouse stock/insufficient book value reject.
  Unsupported standard/serial/lot returns reject visibly. Historical unlinked
  returns keep the old pro-rata/current-cost fallback and its qualification limits.
- REST routes preserve response/status envelopes and use shared JSON helpers.
  Invalid send/email JSON rejects before posting; optional email follows commit.
  MCP adds update/delete/summary/available parity; send moved from tax to credit
  notes and customer credits moved from sales receipts to a registered new file.
  All retain names, direct DB, AuthContext, wrapTool and described fields.
- Credit-note create UI forwards decimal price strings through unitPriceExact.
  Summary UI formats the declared currency and presents unsupported totals as
  unavailable with an accessible error. No browser/screenshot qualification claimed.
  Added public API/money docs, contract registry, test matrix, money inventory;
  removed the adopted credit route's deprecated money-helper allowance.

## Acceptance mapping

1. [Credit wire inventory](../registries/CREDIT_WIRE_CONTRACTS.md) maps fourteen
   REST and fourteen MCP boundaries, units/aliases/ranges, defaults/envelopes,
   rounding, state/permission/period/FX policies and explicit remaining gates.
2. Migrated PostgreSQL worker invokes actual authenticated REST handlers and
   registered SDK MCP callbacks. Legacy/exact/dual prices/amounts, USD/IRR/JPY/KWD
   minor preservation, custom role denials, conflicting org header and two tenants,
   foreign new/saved references, linked invoice customer/currency and all scoped
   reads/writes/available envelopes are asserted. Actual auth-key last-used
   metadata is excluded from mutation snapshots, with no credential disclosure.
3. Pure groups test canonical/malformed/conflicting aliases, signed tie/extended
   rounding, quantity/tax/discount, products/sums and safe limits. Actual fixtures
   cover int32-plus/safe-max and unsafe/mixed summaries; stored unsafe header,
   line/customer/invoice/allocation and foreign retained references; missing
   recognition; old/new/posting/invoice locks; no-second-AR offset; saved FX and
   average/FIFO stock reversal; send/void/application/number concurrency. Complete
   rejection snapshots cover headers/lines/journals/carriers/sequences/chart/bank/
   stock/FIFO/warehouse and audits. Injected line/header/journal/customer/invoice
   faults prove create/edit/delete/send/apply/void and bank auto-link rollback.

## Verification

All commands ran in `D:/Projects/dubbl`. Synthetic PostgreSQL 18.6 cluster
`D:/Temp/dubbl-mon042-pg-843c28c7a16b4e639b81e79aaf37bd67`, loopback 55452,
synthetic dubbl_ci role, no provider credentials. TEST_DATABASE_URL explicitly
selected only this server. Harness migrates/drops random dubbl_ci_* databases;
configured app DB and .env credentials were not read or changed. Server runs in
a hidden process and stops after each test batch; local test-cluster files retained.

| Actual command/procedure | Result | Limits |
|---|---|---|
| Controller validate/status/context/start | Exit 0, valid 95 tasks, MON-042 selected | Workflow only |
| `node --import tsx --test tests/credit-wire.test.ts` | Exit 0, 5/5 groups | Pure contract math/guards |
| Final `node --import tsx --test --test-concurrency=1 tests/integration/credits.test.ts` | Exit 0, 1/1 expanded worker | All actual handler/auth/SDK fixtures on migrated disposable DB |
| Combined credits/invoice-writes/invoice-lifecycle integration run | Exit 0, 3/3 workers | Invoice regression plus credits; final credit additions separately passed |
| Full `node --import tsx --test --test-concurrency=1 tests/*.test.ts` | Exit 0, 125/125 | Final pure DTO guards included |
| `npm run typecheck`, later `npx tsc --noEmit` | Exit 0 | MDX/TypeScript; no Next build/dev |
| `npm run lint` | Exit 0, 0 errors / 159 existing warnings | Full repository, no added warnings |
| Targeted ESLint of adopted routes/services/tools/fixtures/UI | Exit 0, clean | Changed code checks |
| Inventory --write/reproducibility; `node --import tsx .agentic/scripts/verify_money_inventory.mjs` | Exit 0, 410 columns / 1372 paths / 1132 consumer hashes / 22015 occurrences | Source and Drizzle verification |
| Synthetic database count and pg_ctl fast stop | Count 0; exit 0, server stopped | Only random fixture databases |
| `git fetch origin`, divergence | Exit 0, 0 ahead / 0 behind at entry HEAD | Before requested commit/push |
| `git diff --check` | Exit 0 | Line-ending notices only |

Controller unit-suite results are recorded in self-review after its final output.
No full builds, dev server, Docker, screenshots, provider calls, schema edits,
migration generation, configured DB mutation, IRR flag or deployment changes.

Exploratory failures were repaired: initial tsc exposed wrapper missing ctx and
conditional Zod inference, fixed with explicit typed branches; early targeted lint
found two imports made unused by adoption, removed. The first DB run followed an
interruption which stopped the test server, so it failed ECONNREFUSED; runs now
start/stop the hidden server in the same shell. Initial fixture expected padded
rate text instead of the ORM's canonical "1.2"; corrected to actual canonical
representation. A plain-node inventory verification lacked tsx module resolution;
the documented tsx invocation passes. Two wrapper EOF blanks were removed for
diff --check. Injected DB-fault 500/MCP errors are expected assertions with
unchanged snapshots, not failed final checks.

## Review and handoff

Actual self-review is recorded separately in MON-042-review-1.md. No remaining
bounded-slice blocker. MON-019 keeps combined acceptance. MON-021/payment-domain
carrying FX and external writer interaction, MON-024/full inventory, MON-007/008
full-range domain, historical base-regime/configuration races, HTTP/session/OAuth,
email/PDF/provider/UI and accounting/production qualification retain their gates.
Optional delivery may fail after send commit; retry delivery separately. Audit
remains best effort; repeated create is not request-idempotent. IRR stays gated.
Task closure follows checks, then the user-authorized commit/push. Next: MON-043.
