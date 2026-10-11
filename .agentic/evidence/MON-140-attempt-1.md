# MON-140 attempt 1 - debit note UI money

## Identity and scope

2026-10-11, Asia/Tehran. Operator/reviewer: coding-assistant; self-review only.
Entry master HEAD 2701dfed2cef19bb2dc76c3f9b80b4f4beef038b, clean tree.
User authorized completing/pushing one next task. Live controller validate/status/
next selected MON-140 and start claimed it. This evidence precedes commit/push.
Read root/nested rules, controller/project/map/frontend role, selected task and
dependency evidence, source money/migration/PR sections, ownership registries,
debit and bill services/wires/REST/MCP and analogous credit UI fixtures. Applied
the memory Dubbl controller-task skill for bounded verification and scoped push.

## Implementation and acceptance mapping

1. CORE_UI_MONEY_CUTOVER and MONEY_MANIFEST explicitly assign both debit pages,
   DebitNoteDrawer, debit-note-ui and its detail/overview components, plus scoped
   shared editor/amount/send props. Creation defaults to explicit USD as both
   debit transports do; currency selection and up to 18 fractional decimal price
   digits survive as unitPriceExact. Extended-price preview matches debit totals,
   including USD 0.005 x 3 = 2 minor units. Invalid preview, unknown tax, unsafe
   amounts and missing descriptions prevent saving; submission reparses lines.
   Org-keyed drawer/editor resets supplier/tax context. Saved header/line Minor
   aliases are validated against safe retained numeric raw units; numeric-only
   legacy fallback also validates. Bigint and saved currencies drive display and
   grouped sums. The overview labels its loaded matching sample, excludes voids
   and never sums currencies. List remaining-sort was removed because the strict
   debit list API does not support that key. Aborted reads, loaded contexts and
   pagination generations suppress obsolete fetched money; detail remounts by
   org/document. Mutations reload validated full reads, never merge numeric money.
2. Five pure/render groups exercise actual debit schemas/calculators, USD/JPY/IRR/
   KWD, signed ties, safe low digits, defaults, zero/fractional quantity, malformed/
   product/range/tax/alias rejection, legacy fallback, exact grouped sums beyond
   Number safe range and actual React English detail/overview/input/error markup.
   Application requires a sent note, recognized received/partial/overdue bill,
   same supplier/currency and positive whole-minor amount bounded by both credit
   and bill due. Pending approval is excluded. Fractional-minor/nonpositive/
   unsafe/malformed amounts fail; handlers reparse and send amountMinor, busy
   application disables duplicate submission. The UI labels the latest-100 org
   bill sample; the existing endpoint has no supplier filter, so eligibility is
   checked locally. Opening the dialog clears previous candidates/amount.
   Migrated disposable SQL fixture invokes authenticated REST and registered
   linked MCP SDK exact create/update/read/list/send/apply/void. Independent SQL
   text verifies header/price/amount/tax, quantity, account/tax IDs, currencies,
   allocation amounts, bill paid/due and per-currency sample sums. Malformed/unsafe
   REST/MCP create rejection leaves header count/sum unchanged. Existing debit
   and bill lifecycle fixtures retain tenant/role/period/stock/FX/rollback controls.
3. Scoped monetary float/fixed-two assumptions are removed. Quantity /100 remains
   physical hundredths; tax basis points and retained numeric wire aliases retain
   units. Fixed USD empty-state examples are illustrative. Debit void resets
   applied/remaining to zero and restores bill allocations, unlike credit-note
   remaining behavior. Actual debit pages contain no monetary editor/copy or cash
   refund operation; none was invented. Existing exact draft update contracts were
   still verified. No separate stored line-discount field exists. Exact registered
   direct-DB MCP already supports all adopted fields; no REST/MCP/schema/migration
   change was needed. MON-141/142 and MON-132/MON-129/MON-007 stay independently open.

## Verification

Commands ran from D:/Projects/dubbl. No full build, dev server, Docker, deployment,
outbound email/provider, browser effects, application DB or .env access occurred.

| Command | Actual result | Scope/limit |
|---|---|---|
| node --import tsx --test tests/debit-note-ui-money.test.ts | Exit 0, 5/5 | Actual adapters/calculators and React static rendering |
| node --import tsx --test tests/integration/debit-note-ui-money.test.ts | Exit 0, 1/1; final fixture rerun also passed | Real REST/MCP plus independent SQL |
| node --import tsx --test --test-concurrency=2 tests/integration/debit-note-ui-money.test.ts tests/integration/debit-notes.test.ts tests/integration/bill-lifecycle.test.ts | Existing debit and bill suites passed 2/2; initial new fixture failed, then repaired and separately passed | Not represented as an all-green initial combined run |
| pnpm test | Exit 0, 422/422 | Complete unit suite |
| pnpm typecheck; pnpm exec tsc --noEmit | Exit 0 | MDX and TypeScript; no build |
| pnpm lint | Exit 0, 0 errors/104 pre-existing warnings | Whole repository lint |
| pnpm exec eslint on nine scoped TS/TSX files | Exit 0, final pass no warnings/errors | Scoped lint; an intermediate cleanup-ref warning was corrected |
| python .agentic/scripts/money_inventory.py --write; python .agentic/scripts/money_inventory.py | Exit 0 | 415 columns, 1985 scanned files, 1481 consumers, 28304 occurrences |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0 | Independent Drizzle classification/hash/source-line verification |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0, 9 checks | Legacy-money guard |
| python .agentic/agent.py validate | Exit 0, 196 tasks | Controller structure |
| git diff --check | Exit 0 | Whitespace |
| psql fixture count; pg_ctl fast stop | Count 0; exit 0 | All disposable DBs dropped; dedicated server stopped |

Dedicated PostgreSQL 18 cluster:
C:/Users/Sajjad/AppData/Local/Temp/dubbl-mon140-pg-87316b7470e948fe93f11ff1180ba384,
127.0.0.1:55440, synthetic trust-authenticated dubbl_ci role, loopback only,
max_locks_per_transaction=256, jit=off. Explicit TEST_DATABASE_URL selected this
server. Harnesses created/migrated/dropped random dubbl_ci_* databases and passed
their DATABASE_URL to workers. No application database was read/changed. Temporary
cluster files remain. No PostgreSQL 16/hosted CI, full-int64 business workflows,
production IRR, independent accounting/human or live browser qualification is claimed.

Initial transformation scripts were corrected after a list-class selector mismatch
and accidentally renamed shared input imports. Initial fixture failures corrected
the debit-specific void expectation, an exact-decimal import name and an aggregate
comparison that ran after additional default-currency documents were inserted.
Final checks above use corrected source; these failures are not called passes.

## Review and handoff

Actual self-review is MON-140-review-1.md. No scoped blocker. Complete controller
check/submit/self-review/done, commit only task-owned files, push origin/master,
confirm remote SHA/clean tree, report next task and stop. Parent acceptance remains.
