# MON-144 attempt 1 - credit note creation and lifecycle UI money

## Identity and scope

2026-10-11, Asia/Tehran. Actual operator: codex; self-review only.
Entry master HEAD 13319a72, clean working tree. The user authorized completing
and pushing the next task. Live validate/status/next selected MON-144; claimed
via start. This evidence is written before the task commit/push. No sibling or
parent criteria are completed by this child.

Read root/nested rules, controller/entry/project/map/frontend role, selected task
and dependency evidence, source money/migration/PR sections, ownership/manifest,
credit wire inventory, actual UI/shared editor and REST/MCP service/fixture code.
Used the memory controller skill for scoped delivery. Existing registered direct-
DB credit tools already support exact prices/amountMinor and emit Minor aliases;
no operation, REST/MCP schema, DB migration, posting policy or feature flag changes.

## Acceptance mapping

1. CORE_UI_MONEY_CUTOVER, MONEY_MANIFEST and TEST_MATRIX assign scoped ownership.
   CreditNoteDrawer explicitly defaults to USD, as both transports do, regardless
   of customer/org currency. Selection is sent as currencyCode. Eighteen-digit
   exact decimal prices remain unitPriceExact strings; shared preview uses the
   actual extended-price calculator. USD 0.005 x 3 previews/saves 2 minor units,
   while a signed negative tie retains the existing zero rule. Blank price means
   zero, blank quantity means one, and explicit zero/fractional quantity survives.
   Invalid tax/price/quantity/range suppresses preview/save; descriptions must be
   present, and handlers reparse supported line fields. Org-keyed editor reloads
   tax context and currency/line changes invalidate preview readiness.

   credit-note-ui.ts validates saved numeric aliases against canonical Minor
   strings and safe workflow limits, with checked numeric-only legacy fallback.
   Saved headers/lines and summary buckets become bigint without rescaling.
   List/detail/price/subtotal/tax/applied/remaining and SendDocumentDialog display
   saved currency. Fractional saved hundredths show physical quantity fractions.
   Large values wrap or use retained horizontal scrolling. Summary keeps its
   existing all-status/all-filter single-currency contract; mixed currencies or
   unsafe sums show Unavailable/server error, and missing/empty currency a dash.

   Application lookup is customer-scoped and filters outstanding same-customer/
   currency invoices. Only due money is consumed and validated from candidates.
   Saved-currency text/decimal controls show accessible labels/invalid alerts.
   Positive whole-minor amount input rejects fractional minor units, malformed
   and unsafe values or either balance bound; submit reparses and sends amountMinor.
   Backend roles, date locks, recognition, allocations and reversal remain intact.
   Main reads abort on context changes; list/summary results are context-keyed and
   detail/dialog state remounts by org/document. Opening application discards old
   candidates and amounts. Pagination appends only normalized context-matched
   rows. Lifecycle actions reload full reads instead of merging numeric responses.

2. Five adapter/rendered cases verify actual strict transport schemas, scales,
   safe-edge low digits, defaults, signed extended rounding, blank/zero/fractional
   quantities, malformed/range/product/tax rejection, numeric/Minor disagreement,
   summary currency/aliases and application customer/currency/status/bounds.
   Real shared editor, CreditNoteMoneyDetails and InvoiceAmountInput renders
   verify English currency totals, prices, subtotal/tax/remaining, fractional
   quantity, labels, decimal keyboard mode, invalid alerts and horizontal scroll.

   Migrated disposable PostgreSQL uses authenticated REST and registered linked
   MCP SDK create/read/list/summary/send/apply/void with UI adapter payloads in
   USD/JPY/synthetic IRR/KWD. Independent SQL text checks price/extended amount/
   tax/total/currency/quantity/account/tax IDs, invoice paid/due and allocation
   units. Real invoice creation and MCP recognition provide application targets;
   targets are not fabricated posted rows. REST and MCP applications both settle
   exact units, and REST/MCP void unwind allocations/invoice balances. Summary
   agrees with independent SQL sums; empty currency and mixed/unsafe rejection
   are checked. Safe-edge draft prices preserve every low digit. USD sub-minor
   and signed ties plus omitted USD default with KWD customer/non-USD org are
   checked independently. Existing credit worker separately passes tenant/role/
   locks, strict transport aliases, inventory/FX, unsafe history and atomicity.

3. Physical quantity/100, numeric quantity input and tax basis points retain
   nonmoney units. Static USD illustration remains an example. No monetary credit
   edit/copy workflow exists in these pages, so none was introduced. Shared editor
   defaults remain for pending callers, while this slice passes explicit currency/
   precision/rounding. Numeric wire coexistence and safe-number workflow limits
   remain; bigint display is not full signed-int64 business support. Invoice
   candidate lookup remains latest 100, now customer-scoped. Public/email/PDF,
   browser effects, production IRR and accounting review stay separate. MON-145/
   146/137 and MON-136, MON-131, MON-129, MON-007 combined acceptance remain open.

## Verification

All commands ran from D:/Projects/dubbl. No full build, dev server, Docker,
deployment, application database or .env access was used.

| Command | Actual result | Limits |
|---|---|---|
| node --import tsx --test tests/credit-note-ui-money.test.ts | Exit 0, 5/5 | Adapters and real React SSR, no browser effects |
| node --import tsx --test --test-concurrency=2 tests/integration/credit-note-ui-money.test.ts tests/integration/credits.test.ts | Exit 0, 2/2, 17.90s | New UI and existing credit contract fixtures |
| node --import tsx --test tests/integration/credit-note-ui-money.test.ts | Exit 0, 1/1, 6.10s | Final typed fixture after annotation repair |
| pnpm test | Exit 0, 417/417 | Complete unit suite |
| pnpm typecheck | Final exit 0 | MDX plus TypeScript; no build |
| pnpm exec eslint on all eight changed/new TS/TSX files | Exit 0, no warnings/errors | Final scoped source; repaired worker separately checked |
| pnpm lint | Exit 0, zero errors, 103 existing warnings | No scoped warning remains |
| python .agentic/scripts/money_inventory.py --write, then verify | Exit 0 | 415 columns, 1979 scanned files, 1476 consumers, 28187 occurrences |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0 | Actual Drizzle exports/hashes/source lines |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0, 9 regression checks | Legacy guard |
| python .agentic/agent.py validate | Exit 0, 196 tasks | Structural workflow only |
| git diff --check | Exit 0 | Whitespace |
| Synthetic psql database count / pg_ctl fast stop | Count zero, stop exit 0 | Dedicated synthetic cluster only |

Initial scoped lint found a conditional rows-array dependency warning; memoized
the context rows before final lint. Initial TypeScript after adding the new
fixture exposed dynamic JSON type inference in application candidates; added
explicit credit/target wire and created invoice ID annotations. Final checks
passed; no failed or unavailable check is represented as passing.

Dedicated PostgreSQL 18 cluster:
C:/Users/Sajjad/AppData/Local/Temp/dubbl-mon144-pg-5559f4b141594173a89f1d4808bab37b,
127.0.0.1:55444, synthetic trust-authenticated dubbl_ci role, loopback only,
max_locks_per_transaction=256 and jit=off. Explicit TEST_DATABASE_URL selected
only this cluster. Harnesses created/migrated/dropped random dubbl_ci_* databases;
workers received only disposable DATABASE_URL. Final database count zero and
cluster stopped. Temporary cluster files remain. No outbound email/provider call.

## Review and handoff

Actual self-review: MON-144-review-1.md. No scoped blocker. DEC-005 requires no
screenshots. No browser effects, hosted CI/PostgreSQL 16, provider/PDF, production
IRR/full-int64 qualification or accounting/linguistic approval is claimed.
Complete controller check/submit/self-review/done, commit task-owned files,
push origin/master, verify remote SHA and clean tree, then report live next task.
