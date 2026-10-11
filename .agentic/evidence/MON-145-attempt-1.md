# MON-145 attempt 1 - sales receipt UI money

## Identity and scope

2026-10-11, Asia/Tehran. Operator: coding-assistant; actual self-review only.
Entry master HEAD 0a5d17917964e3789a5ec2bc8ed24824d6437953, clean working tree.
The user authorized completing and pushing the next task. Live validate/status/
next selected MON-145; claimed exactly this child. Evidence precedes commit.
MON-136, MON-131, MON-129 and MON-007 keep independent combined acceptance.

Read root/nested instructions, controller/project/map/frontend role, task,
dependency evidence, source money/cutover sections and the actual receipt REST/
MCP/services/editor/currency contracts. Reused the adopted exact wire; no API,
MCP, schema, migration or production currency flag change was needed.

## Implementation and acceptance mapping

1. CORE_UI_MONEY_CUTOVER and MONEY_MANIFEST assign the receipt drawer/list/detail,
   sales-receipt-ui.ts and SalesReceiptMoneyDetails to MON-145. Regenerated lexical
   MONEY_BOUNDARIES with verified hashes/source lines. Currency resolution follows
   selection, customer, org, USD and sends explicit currencyCode. Aborted default
   reads and org/customer context prevent obsolete defaults. The org-keyed drawer
   and editor reload tax, customer and bank context. Exact decimal price strings
   are sent as unitPriceExact with only supported line fields. Extended-price
   preview matches salesReceiptTotals: USD 0.005 x 3 is 2 minor units. Blank price
   means zero, blank quantity one, and explicit zero/fractional quantities survive.
   Up to 18 fractional price digits and signed ties follow the existing wire.
   Unknown tax, unsafe product/sum, malformed input and unresolved currency disable
   saving; descriptions are required and submit reparses the lines. Bank selection
   remains required in this drawer; it is not implicitly converted to receipt FX.

   Canonical Minor aliases validate against safe numeric raw units before bigint
   adoption, with checked numeric-only legacy fallback. Saved currency drives list,
   detail, unit price, subtotal, tax and total. No amount is rescaled or converted
   twice. Physical quantity hundredths show fractions. Long amounts wrap or retain
   horizontal scrolling. Main reads abort on context change; context-keyed list
   rows suppress stale money and pagination checks generations. Detail state
   remounts by org/document. Failed or malformed reads expose English alerts.
   Collected uses only paid receipts, grouped by currency from the loaded matching
   sample, explicitly labeled; draft/void are excluded. Exact aggregate sums can
   exceed one document's safe-number limit. Empty groups show a dash. Search,
   sorting, dates/status filters and incremental loading are retained.

2. Five focused adapter/rendered groups verify scales, signed/sub-minor rounding,
   safe-edge low digits, aliases, malformed/range input, missing currency/tax,
   defaults, zero/blank/fractional quantities and per-currency paid-only sums.
   Actual shared editor and saved-money component renders verify exact English
   values, fractional quantity, currency headers, decimal keyboard mode, price
   labels, invalid alerts, subtotal/tax/total and horizontal scrolling.

   Migrated disposable PostgreSQL fixture uses authenticated REST and registered
   linked MCP SDK create/read/list/post/void with UI adapter payloads in USD, JPY,
   synthetic IRR and KWD. Independent SQL text checks saved price, extended amount,
   tax, total, currency, quantity, revenue/tax IDs and cash references. Positive
   small receipts post to paid with balanced exact cash/revenue/tax journal totals;
   void reads preserve saved totals and leave the collected sample. Both transports
   post/void; signed/zero/sub-minor and maximal-safe draft prices retain low digits.
   Explicit UI defaults agree with omitted transport customer/org defaults.
   Existing MON-043 receipt fixture independently passes tenant/role/period locks,
   reference/range/alias rejection, bank-currency/FX, exact saved reversal,
   inventory, concurrent lifecycle and atomicity regressions.

3. Existing creation is draft, with post/void separate operations. This bounded
   task does not add post/void/edit/copy UI or change recognition/cash/FX policy.
   Backend revenue/tax, tenant/role/period, bank currency and reversal rules stay
   authoritative. Quantity /100 and numeric physical API quantities are nonmoney;
   tax basis points and retained safe numeric wire aliases keep units. Static USD
   empty-state illustrations remain examples; shared defaults remain for pending
   editor callers. No monetary fixed-two exception remains in receipt consumers.
   MON-146/137 and combined parent acceptance remain open. Safe-number workflow
   limits remain despite bigint display/sums. Full-int64 posting, production IRR,
   browser effects, provider/PDF and financial/linguistic qualification are separate.

## Verification

All commands ran from D:/Projects/dubbl. No full build, dev server, Docker,
deployment, application database or .env access was used.

| Command | Actual result | Limits |
|---|---|---|
| node --import tsx --test tests/sales-receipt-ui-money.test.ts | Exit 0, 5/5 | Adapters and React SSR, no browser effects |
| node --import tsx --test --test-concurrency=2 tests/integration/sales-receipt-ui-money.test.ts tests/integration/sales-receipts.test.ts | Exit 0, 2/2 | Migrated disposable PostgreSQL 18, real REST/MCP/SQL |
| pnpm test | Exit 0, 427/427 | Unit suite |
| pnpm typecheck | Exit 0 | MDX generation and tsc --noEmit; no build |
| pnpm exec eslint scoped pages/drawer/helper/component/tests | Exit 0, no warnings | Eight changed/new TS/TSX files |
| pnpm lint | Exit 0, zero errors and 103 existing warnings | Warnings outside this scope; scoped lint clean |
| python .agentic/scripts/money_inventory.py --write | Exit 0 | 415 columns, 1990 scanned files, 1485 consumers, 28388 occurrences |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0 | Actual Drizzle exports/hashes/source lines |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0, 9 regression checks | Legacy guard |
| python .agentic/agent.py validate | Exit 0, 196 tasks | Structural workflow only |
| git diff --check | Exit 0 | Whitespace |
| Synthetic psql database count / pg_ctl fast stop | Count zero, stop exit 0 | Dedicated synthetic cluster only |

Initial scoped ESLint found two effect-state errors and one ref cleanup warning.
Initialized detail loading from org presence, retained the existing scoped loading
reset suppression, and kept generation changes in the effect rather than cleanup.
Final scoped ESLint has no errors/warnings. Self-review added wrapping for large
grouped card amounts. No failed/pending check is represented as passing.

Dedicated PostgreSQL 18 cluster:
C:/Users/Sajjad/AppData/Local/Temp/dubbl-mon145-pg-ccd5abcb602247bca2df3f70cc847ab7,
127.0.0.1:55445, synthetic trust-authenticated dubbl_ci role, loopback only,
max_locks_per_transaction=256 and jit=off. Explicit TEST_DATABASE_URL selected
only this cluster. Harnesses created/migrated/dropped random dubbl_ci_* databases;
workers received only disposable DATABASE_URL. Final database count zero and
cluster stopped. Temporary cluster files remain. No outbound provider/email call.

## Review and handoff

Actual self-review: MON-145-review-1.md. DEC-005 requires no screenshots.
No browser effects, hosted CI/PostgreSQL 16, provider/PDF, production IRR/full-int64
qualification or accounting/linguistic approval is claimed. Finish
controller check/submit/self-review/done, commit task-owned changes, push
origin/master, verify remote SHA/clean tree and report the live next task, then stop.
