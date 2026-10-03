# MON-052 attempt 1 - exact goods receipt contracts

## Identity and scope

2026-10-04, Asia/Tehran. Operator: coding-assistant, implementing assistant.
Entry HEAD 0d629c6, clean master tree. User requested the next task and commit/
push after complete implementation. Controller validate/status/context selected
MON-052 and start claimed it. No delegation or independent reviewer was used.
This evidence records the verified uncommitted change before task closure/commit.

Read root/nested AGENTS, START_HERE/controller/project/repository map, backend
role, task/dependency review evidence, ADR-006, source migration/API compatibility
sections, money manifest, current PO/receipt/bill/stock/FX schemas/services/routes/
MCP and integration harness. MON-020 retains combined procurement acceptance;
MON-024 retains other inventory writers and tracked allocation. No schema changes.

## Implementation result

- New goods-receipt-wire.ts defines described REST/MCP quantity/list/ID schemas,
  exact physical quantity agreement, int32 hundredths, whole stock, exact extended
  minor costs and named output aliases. Invalid JSON now returns 400.
- New goods-receipts.ts supplies list/detail/receive/create-bill to thin REST routes
  and registered MCP goods-receipts.ts. Removed duplicate receipt implementations
  from purchasing.ts, preserving its other tools. Added get_goods_receipt and
  create_bill_from_goods_receipt. Full registry tests verify unique registration.
- Organization/PO/line/item/receipt locks serialize supported writes; supplier,
  warehouse, stock, PO, journal and account ownership/availability is checked.
  Reads carry numeric costs plus unitCostMinor, physical quantityReceivedExact,
  and explicit nested monetary aliases; no bigint crashes or automatic rescale.
- Receipts persist source PO costs, exact receipt-date FX legs and transactional
  audit FX/base/accrual snapshot. Exact GL conversion, base stock value, moving
  average, warehouse quantities and FIFO layers share one transaction. The shared
  billStockMovement helper now accepts goods_receipt references and zero-value
  nullable journal links, enforcing positive whole receipt units/nonnegative value.
  Serial/lot, indivisible FIFO and negative FX residual legs reject.
- Atomic create-bill copies received quantities/minor costs, rounds extended amounts
  exactly, retains zero tax, links PO/receipt lines and copies source expense account
  for nonstock. Header/lines/sequence/link/two audit events/preflight commit together.
  Active linked bills, including drafts/partial quantities, reject repeated creation;
  bill void releases the guard. Creation does not post or advance recognized tallies.
- Bill lifecycle now handles nonstock receipt recognition/void through expense/AP
  without requiring nonexistent GRNI. New full single foreign stock receipts can
  clear at identical saved FX, unchanged costs and no stock tax. Audit/base/currency/
  journal/sourceId/amount and saved leg rates must agree; used/partial/changed FX or
  missing snapshot fails. Stock is never received twice. Existing base receipt,
  PO conversion and debit-note regression workers pass.
- Contract registry, manifest, inventory hashes, test matrix, bill lifecycle registry
  and MON-024 handoff document the exact supported ranges and shared writer bridge.

## Acceptance mapping

1. GOODS_RECEIPT_WIRE_CONTRACTS inventories all four actual REST operations and MCP
   parity, envelopes, units, aliases, dates, roles, safe numeric money and int32
   quantities/numbering, saved FX, supported stock/GRNI and explicit limits. There
   were no receipt draft-edit/delete endpoints; no destructive workflow is invented.
2. goods-receipts-worker uses actual handlers/API keys/custom roles and full SDK
   registry. REST/MCP numeric/exact/dual inputs, list/detail/create-bill, foreign
   tenant IDs/references, conflicting organization headers, write roles and invalid
   keys are exercised. Monetary costs originate from saved PO prices; receipt
   input cannot override them. Nested aliases and safe-max reads are asserted.
3. Pure ratios and real PostgreSQL business snapshots prove exact unit/rounding
   contracts and unchanged persisted rows after errors. Coverage includes malformed
   dates/JSON, duplicate/wrong lines, fractional stock, over-receipt, int32 bounds,
   unsafe raw SQL history/products/stock totals, missing FX, serial stock, FIFO
   division, negative residuals, active bills, locks and injected stock/audit errors.
   Concurrent receive and mixed REST/MCP conversion each have one winner. Receipt/
   stock/journal/warehouse/FIFO values, source linkage, nonstock recognition/void,
   full foreign clearing/base scales and unchanged stock after recognition are asserted.

## Actual verification

All commands ran at D:/Projects/dubbl using installed dependencies. Created an
isolated PostgreSQL 18.6 trust-auth cluster at
D:/Temp/dubbl-mon052-pg-65a1cdfc6f7b46369f9831723acf4672, loopback port 55462,
synthetic dubbl_ci superuser. Hidden pg_ctl startup redirected output; explicit
TEST_DATABASE_URL selected this server. Harness migrated/dropped random fixture
databases only. Configured .env/database was not read, migrated or reset; no
credentials or real customer data were printed/persisted. Worker provider keys blank.

| Command/procedure | Actual result | Limit |
|---|---|---|
| Controller validate/status/context/start MON-052 | Exit 0; selected ready task in valid 104-task graph | Structural only |
| node --import tsx --test tests/goods-receipt-wire.test.ts | 2/2 pass | Pure units |
| npm test | Exit 0; 161/161 | Unit suite; no independent financial approval |
| Final four-worker goods-receipts/bill-lifecycle/purchase-orders/debit-notes integration command | Exit 0; 4/4 pass | Migrated synthetic PG18.6, actual handlers/full SDK |
| Final strengthened goods-receipts worker rerun | Exit 0; 1/1 pass | Added positive legacy/dual MCP and partial/missing-snapshot foreign guards |
| Final npx tsc --noEmit | Exit 0 | Installed dependencies and existing generated sources |
| Final full npm run lint | Exit 0; 0 errors/155 existing warnings | Same warning count as entry evidence |
| Affected source/route/tool/test eslint; final worker eslint | Exit 0; clean | All changed TypeScript paths |
| Final money_inventory.py --write, then verify | Exit 0; 410 columns/1429 paths/1175 consumers/22848 occurrences | Lexical inventory, not dataflow proof |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0; Drizzle metadata and consumer/occurrence hashes match | Source-only |
| node .agentic/scripts/verify_legacy_money.mjs | Exit 0; 9 regression checks | No new deprecated money usage |
| pg_isready, remaining fixture count, pg_ctl fast/wait stop | Ready during tests, zero fixture DBs, shutdown exit 0 | Synthetic server stopped |
| git fetch origin; rev-list HEAD...origin/master | Exit 0; 0 ahead/0 behind before commit | Commit/push follows closure |
| git diff --check | Exit 0 | LF/CRLF notices only |

Initial typecheck caught missing array typing/conditional relation inference and
fixture column names; corrected before final passes. Early integration failures
were incorrect fixture FX field names, missing today's UTC FX date (client Tehran
date was already the next day) and an incorrect expected period-lock status (422,
not 403). These were fixed; none is presented as an initial pass. Running inventory
metadata verification without its documented --import tsx initially failed module
resolution; the correct documented command passes. Self-review added active
source account/journal scoping, nullable journal barriers, linked foreign snapshot
proof, tracked/range/FIFO/negative residual guards and their actual fixtures.

No build/dev/Docker/live provider/browser/session/OAuth/deployment/schema migration
or production enablement occurred. No full configured database migration was run.

## Review, limits and handoff

See MON-052-review-1 for honest implementing-assistant self-review. No slice blocker
remains. All aliases intentionally retain safe numeric business ranges; full int64
is separate work. Foreign differing-rate/partial/multiple-receipt/tax/variance
allocation, zero-accrual variance repair, serial/lot and other inventory writers,
historical ambiguous allocations, broader cross-writer/configuration races, production
migration and independent accounting/security/native-language/release/IRR gates
remain assigned qualification, not inferred from these fixtures. Existing PO
conversion's unknown partially billed allocation guard remains applicable when
mixing receipt-cost bills with PO net/tax allocation; no historical data is repaired.

Next: controller check/submit/self-review/done, validate/status, commit/push as
authorized, then stop. Next task is MON-053 exact payable bulk contracts.
