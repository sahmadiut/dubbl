# MON-146 customer prepayment UI money - attempt 1

## Identity

2026-10-11, operator Codex, self-reviewed. Repository D:/Projects/dubbl,
master; clean working tree at selection. Controller validate/status/next selected
MON-146 with all prerequisites resolved. Implementation was uncommitted when
this evidence was written; the scoped delivery commit contains this evidence.

## Implementation

- lib/money/customer-prepayment-ui.ts reuses exact invoice amount/alias/currency
  adapters and credit-note application eligibility. Saved original/remaining
  balances must be positive/nonnegative, consistent, safe numeric values agreeing
  with canonical Minor strings; bigint drives presentation and subtraction.
- CustomerCreditDrawer/CustomerCreditForm resolves explicit/contact/org/USD
  currency using scoped aborted contact/organization reads. Exact decimal text
  previews the received amount and sends amountMinor plus explicit currencyCode.
  Paid-in accounts must match currency; invalid/unresolved values disable save.
- sales/customer-prepayments/page.tsx adopts saved Minor fields before display.
  Received/available summaries group the loaded server-filtered sample by currency,
  exclude void credits, and are explicitly marked loaded. They are suppressed on
  failed reads and while refetching. Search retains its existing client sample scope.
  First-page reads abort; page responses reject obsolete filter generations.
- Detail uses CustomerPrepaymentMoneyDetails for original, used and remaining
  bigint amounts in saved currency. Apply options adopt amountDueMinor and require
  the same customer and currency, outstanding status, and positive due. Exact
  amountMinor application cannot exceed either balance. Invalid reads suppress
  amounts/actions with English alerts. Network/application errors surface safely.
- List/detail/drawer remount by organization; detail also by id, drawer by open.
  Currency responses are keyed to customer/org. Amount inputs retain currency
  scales, accessible currency names, decimal input mode and invalid alerts;
  large saved values wrap and existing table scrolling remains.
- CORE_UI_MONEY_CUTOVER and MONEY_MANIFEST assign explicit section ownership;
  MONEY_BOUNDARIES is regenerated from source. REST/MCP services, schemas, stored
  units and production flags are unchanged. Existing registered direct-DB MCP
  tools accept the same amountMinor fields as REST; no new operation was needed.

## Acceptance mapping

1. Exact inputs/writes, saved aliases/arithmetic/display and grouped summaries
   cover both pages and the drawer. Ownership and shared adapter reuse are recorded
   in both manifests. Source-only money inventory verifies every current hash.
2. Four pure/rendered groups cover USD/JPY/IRR/KWD, safe-edge low digits,
   malformed/negative/zero/precision/range inputs, conflicting/noncanonical aliases,
   invalid saved balances, currency grouping, application eligibility and both
   balance limits, exact preview/wire agreement and English labels/alerts.
   Migrated real REST/MCP/SQL verifies create/read/list, recognition journals,
   raw 1250 and 3000000001 units, default contact/org currency and one-minor-unit
   application with independent SQL-text balances. Existing credits fixture adds
   authorization, org/currency/reference/period/lifecycle and atomic negative cases.
3. Static USD educational examples remain illustrations; counts/pages/dates/status
   are nonmoney. Summary is a loaded sample, not all-page or inferred FX. Invoice
   picker retains its 100-row cap. Safe numeric public workflow limits remain;
   full-int64 and production IRR qualification are not established. MON-136,
   MON-131, MON-129 and MON-007 retain independent combined acceptance, with other
   consumers assigned to their current owners. No parent criteria were checked.

## Verification

All commands ran in D:/Projects/dubbl. Integration used a dedicated synthetic
PostgreSQL 18 loopback cluster on 127.0.0.1:55478, trust-authenticated dubbl_ci role,
max_locks_per_transaction=256, jit=off. TEST_DATABASE_URL explicitly selected only
this cluster; workers received only randomly named migrated disposable databases.
No .env access or application database mutation. Final fixture database count: 0;
cluster stopped. Temporary cluster files remain under the task-specific temp path.

| Command | Actual result | Limits |
|---|---|---|
| node --import tsx --test tests/customer-prepayment-ui-money.test.ts | Exit 0, 4/4 | Pure adapters and static React render; no browser interaction |
| node --import tsx --test --test-concurrency=1 tests/integration/customer-prepayment-ui-money.test.ts tests/integration/credits.test.ts | Exit 0, 2/2 | Actual authenticated REST, linked registered MCP and SQL; disposable PostgreSQL 18 |
| node --import tsx --test --test-concurrency=2 tests/*.test.ts | Exit 0, 451/451 | Full unit suite |
| pnpm typecheck | Exit 0 | MDX generation and tsc; no build |
| pnpm exec eslint on both pages, drawer, adapter, details component and three new tests | Exit 0, no warnings/errors | All changed/new TypeScript files |
| pnpm lint | Exit 0, 0 errors, 102 existing warnings | Final later list-only loading/wrapping refinements passed scoped lint/typecheck |
| python .agentic/scripts/money_inventory.py --write; then without arguments | Exit 0 | 415 columns, 1513 consumer files, 28873 occurrences; lexical inventory only |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0 | Drizzle metadata, all source hashes/occurrence lines verified |
| node .agentic/scripts/verify_legacy_money.mjs | Exit 0, 9 checks | Legacy helper lint guard regressions |
| python .agentic/agent.py validate | Exit 0, valid 202 tasks | Structural validation, not financial qualification |
| git diff --check | Exit 0 | No whitespace errors |

Initial typecheck caught missing inferred detail metadata at the JSON boundary;
explicit wire types and partial-response merging fixed it. An initial inventory
verifier invocation omitted --import tsx and failed module resolution; rerunning
its documented command passed. No full build, dev server, Docker, browser,
provider/email call, deployment or production IRR flag change was performed.

## Review and handoff

Honest self-review: MON-146-review-1.md. DEC-005 requires no screenshots.
Bounded MON-146 acceptance is met. Complete controller checks/submission/review/done,
commit only this task's changes, push origin/master, verify remote SHA and clean
working tree, report next controller task and stop. Parent acceptance remains open.
