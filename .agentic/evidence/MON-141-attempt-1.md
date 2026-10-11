# MON-141 procurement UI money cutover, attempt 1

## Identity and scope

2026-10-11, Asia/Tehran. Operator: codex, the implementing assistant.
Repository: D:/Projects/dubbl, master, entry HEAD
005582a1e532048763f084034aaeab3fd960d3e0. Entry working tree was clean.
This evidence describes uncommitted task-owned work before controller completion
and commit/push; no invented commit or independent reviewer is recorded.

Scoped consumers: purchase order, requisition and goods receipt list/detail pages;
create-drawer.tsx PurchaseOrderDrawer; shared LineItemsEditor purchaseOrder policy;
new procurement-ui.ts, ProcurementMoneyDetails and RequisitionLineEditor.
CORE_UI_MONEY_CUTOVER/MONEY_MANIFEST assign their exact contracts explicitly.
MONEY_BOUNDARIES is regenerated from final source; no schema/API/MCP service changes.
Existing matching MCP operations are verified through registered real clients.

## Acceptance mapping

1. Prices remain exact decimal text and write unitPriceExact with explicit selected
   currency/default USD, matching actual REST/MCP procurement defaults independently
   of supplier/org metadata. Bigint previews use the wire calculators: PO create
   calculates tax, while draft PATCH and requisitions retain no-tax/no-discount
   policies. PATCH submits only supported line fields. Prices support 18 fractional
   digits; blank price/quantity and explicit zero retain domain semantics. Handlers
   reparse and block missing descriptions/invalid prices, quantities, references and
   ranges. Draft editing starts from saved rounded prices in saved currency and
   labels recalculation without tax/discounts. Saved canonical Minor aliases must
   agree with safe numeric units; checked numeric-only fallback never rescales.
   Header/line sums must agree. Cost aliases and physical receipt quantity aliases
   are validated. Bigint money drives all scoped displays and grouped sample sums.

2. Six pure/rendered groups cover USD/JPY/synthetic IRR/KWD, subminor and signed
   ties, fractional/blank/zero quantities, MAX_SAFE_INTEGER low digits, malformed
   price/quantity, tax availability, unsafe products, conflicting/noncanonical
   aliases, invalid header totals and quantity/tally bounds. Receipt values round
   each line before summing: two half-unit lines at one minor cost total 2, where
   the old aggregate-rounding UI displayed 1. Rendered actual editors/details
   verify English labels, decimal input names, quantities 1.25/0.25/0.5, separate
   subtotal/tax/total, currency scales, invalid alerts and scroll/wrapping structure.
   Filter/sort assertions preserve adjacent safe-edge digits and keep currency
   groups separate. Fixture uses actual authenticated REST handlers, registered
   MCP SDK clients, migrated disposable SQL and the same UI adapters/payloads.
   Both transports create/read/edit/send/receive/receipt-bill, requisition
   submit/approve/convert and direct PO-bill conversion across all four scales.
   SQL text asserts exact saved header/bill values and received/billed tallies.
   Two half-unit receipt lines total 2 in reads/bills on both transports. Safe-max
   drafts retain low digits; invalid create leaves the organization order count
   unchanged. Existing PO/requisition/receipt fixtures independently passed domain
   role/tenant/date/lock/reference/FX/stock/recognition/void/race regressions.

3. No scoped monetary float/fixed-two assumption remains. Physical hundredths,
   tax basis points, retained numeric wire coexistence and USD defaults/static
   examples retain their units. Saved subminor price text is not reconstructed:
   USD 0.005 x 3 creates PO amount 2 but saves rounded unit price 1; receiving those
   units uses the saved cost and can value 3. Direct PO draft conversion reserves
   billed quantities; a receipt bill draft changes them only at recognition. UI
   displays saved authoritative quantities, labeled billed/reserved. No posting,
   FX, cash, stock or reservation policy changes. Receipt bills remain drafts.
   Overview excludes voids and labels loaded matching samples by currency. PO
   counts can reject mixed currencies within a status; the UI states unavailability
   while preserving the valid list, never summing those currencies. Search/date/
   sort controls now operate on explicitly labeled loaded samples because actual
   services support only status/page. Amount sorting groups currency then compares
   bigint. Org/document state remounts, main reads abort and pagination generations
   reject obsolete results. Incoming amounts parse before React functional updates.
   Requisition lifecycle DTOs change only status/reason, preserving bigint state.
   Requisition sheet identity is stable during edits; optional supplier selection
   supports the existing conversion requirement. Notes/reference/date, approval,
   send/edit/delete/receive/convert controls and receipt SKU/journal/warehouse links
   remain. MON-142 and MON-132/MON-129/MON-007 combined acceptance stay separate.

## Verification

All commands ran from D:/Projects/dubbl. No full build, unrequested dev server,
Docker, deployment, outbound email/provider, .env or application database was used.

| Command | Actual result | Limits |
|---|---|---|
| node --import tsx --test tests/procurement-ui-money.test.ts | Exit 0, final 6/6 | Adapters and React SSR; no browser effects |
| node --import tsx --test --test-concurrency=2 tests/integration/procurement-ui-money.test.ts tests/integration/purchase-orders.test.ts tests/integration/purchase-requisitions.test.ts tests/integration/goods-receipts.test.ts | Existing domain fixtures 3/3 passed; initial UI fixture failed on a draft-tally expectation | Failure corrected below; final UI fixture rerun independently |
| node --import tsx --test tests/integration/procurement-ui-money.test.ts | Exit 0, final 1/1 after supported PATCH subset change | Real migrated REST/MCP/SQL; all four scales and both transports |
| pnpm test | Exit 0, 442/442 in final run | Unit suite, not production accounting qualification |
| pnpm typecheck | Exit 0 in final run | MDX generation and tsc --noEmit; no build |
| pnpm exec eslint scoped pages/drawer/editor/helper/components/tests | Exit 0, final no warnings/errors | Fourteen changed/new TS/TSX files |
| pnpm lint | Exit 0, zero errors and 102 existing warnings | Scoped lint clean; remaining warnings outside task |
| python .agentic/scripts/money_inventory.py --write | Exit 0 | 415 columns, 2008 scanned files, 1502 consumers, 28693 occurrences |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0 | Drizzle exports, all consumer hashes/source lines |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0, 9 regression checks | Legacy lint guard |
| python .agentic/agent.py validate | Exit 0, 202 tasks | Structural controller check |
| git diff --check | Exit 0 | Whitespace |
| Synthetic psql fixture DB count / pg_ctl fast stop | Count zero; stop exit 0 | Disposable databases dropped; dedicated cluster stopped |

Intermediate TypeScript checks found a missing PO schema discount default and
generic read intersections that retained old numeric line types. Used the schema's
zero discount input for calculation, mapped adopted return types and explicit wire
DTO types. Initial lint found pagination effect-state placement and an unused old
activeCount; corrected these, with final scoped lint clean. A temporary shell edit
failed due to quoting and changed nothing; the corrected patch removed the redundant
test expression. Initial UI fixture expected billed=125 immediately after receipt
draft creation; source/existing lifecycle tests confirmed billed=0 until recognition.
Corrected the assertion and added direct PO draft reservation checks. Final scoped
and integration reruns pass. No failed/pending result is reported as passing.

Dedicated PostgreSQL 18 cluster:
C:/Users/Sajjad/AppData/Local/Temp/dubbl-mon141-pg-78b2aefddbb44cc5a0a56213b9e7c73e,
127.0.0.1:55441, synthetic trust-authenticated dubbl_ci role, loopback only,
max_locks_per_transaction=256, jit=off. Explicit TEST_DATABASE_URL selected only
this cluster. Harnesses created/migrated/dropped random dubbl_ci_* databases; workers
received only disposable DATABASE_URL. Final count zero and server stopped; temporary
cluster files remain. No application DB mutation or production IRR activation.

## Review and handoff

Actual self-review: MON-141-review-1.md. DEC-005 does not require screenshots.
Source/SSR verification covers behavior/layout; live browser effects, hosted
CI/PostgreSQL 16, provider/PDF, full-int64 posting, production IRR and accounting/
linguistic approval are not claimed. Finish controller gates, commit task-owned
files, push origin/master, verify remote SHA/clean tree and report the live next
task, then stop. Parent combined acceptance remains open.
