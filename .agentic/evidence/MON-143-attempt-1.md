# MON-143 attempt 1 - quote creation and lifecycle UI money

## Identity and scope

2026-10-11, Asia/Tehran. Actual operator: codex, self-review only.
Entry master HEAD 4fe3856a8ef2b2d07ced0ae0a722c5fe7d8b9bae, clean tree.
The user authorized completing and pushing the next task. Controller selected
MON-136. Source inspection verified four distinct currency/rounding/lifecycle
contracts in quotes, credit notes, cash receipts and prepayments. Created
MON-143..146 with inherited prerequisites plus completed shared editor/invoice UI
dependencies, validated, split MON-136 through the controller, then started the
first ready child MON-143. All parent criteria remain unchecked and intact.
This evidence is written before the task commit/push.

Read root/nested instructions, entry/controller/project/map/frontend role,
selected and dependency task evidence, exact money/quote wire contracts,
registries, actual UI and REST/MCP services, and fixture harnesses. Existing
registered direct-DB quote tools already accept unitPriceExact and return Minor
aliases; no new operation or duplicated tool is required. No REST/MCP schema,
database schema/migration, posting history or production flag changed.

## Implementation and acceptance mapping

1. Ownership is explicit in CORE_UI_MONEY_CUTOVER, MONEY_MANIFEST, TEST_MATRIX,
   task index and source coverage. QuoteDrawer uses explicit USD default as both
   quote transports do, independently of customer/organization currency. Currency
   selection is sent explicitly. Shared exact editor preview uses price-first
   rounding and 18 fractional price digits; quoteEditorLines preserves decimal
   strings as unitPriceExact and filters to the quote schema's supported fields.
   Quantity remains a physical numeric API control; explicit zero is retained.
   Malformed/range/missing-tax previews suppress totals and saving; descriptions
   disable submission and are reparsed in the handler. Changes invalidate preview
   readiness; org-keyed editor remounts reload tax context. Reselecting the same
   currency retains readiness.

   quote-ui.ts validates currency and canonical Minor strings against safe numeric
   raw units, with a checked legacy-only fallback. Saved headers/billedTotal and
   lines become bigint. English saved prices/totals and SendDocumentDialog use
   saved currency; no rescaling or repeated FX. List sample/status sums use bigint
   grouped by currency, and absent statuses show a dash. Overview explicitly says
   the summary covers displayed quotes. Physical quantity hundredths show actual
   fractions. Detail includes subtotal and tax. Existing horizontal scrolling and
   wrapping retain complete large money values. Invalid reads show an English
   alert and suppress actions. List/detail main fetches abort on context changes;
   loaded keys suppress old money, and refreshes use context checks. Send/status
   actions reload complete normalized reads instead of merging numeric responses.
   Conversion keeps the existing empty remaining-billing request and redirects.

2. Four adapter/rendered tests verify USD/JPY/synthetic IRR/KWD currency scales,
   safe-edge low digits, explicit USD default, signed sub-minor ties, blank/zero/
   fractional quantities, malformed/unsafe/product/missing-tax/alias rejection,
   grouped exact sums above a single document's safe-number limit, and English
   output. Actual React shared editor and QuoteMoneyDetails renders verify exact
   saved prices/totals/quantity, currency labels, text/decimal input, alert behavior
   and horizontal scroll. UI payloads pass actual strict REST and MCP schemas.

   Disposable migrated SQL sends UI payloads through authenticated REST and linked
   registered MCP SDK creation/read/list/status operations. Independent SQL text
   checks saved prices, tax, totals, currency, account and tax IDs. Both transports
   preserve safe large draft prices. Normal positive documents convert through
   REST and retain exact quote total/currency in SQL invoice and billedTotal.
   USD 0.005 x 3 previews and saves 3 minor units. USD -0.005 retains the existing
   zero tie result. Default USD is independently checked with customer KWD/org JPY.
   SQL grouped sums validate the displayed draft summary. Existing quotes worker
   separately passes tenant/role/lock, transport alias, draft edit, pricing-tier,
   partial/residual/milestone conversion, overbilling and atomicity regressions.

3. Numeric quantity/100 and tax/discount basis points retain nonmoney units. The
   quote pages had no monetary edit/copy UI; no new workflow was invented. Saved
   raw prices have already been rounded; unseen source precision is not inferred.
   Public/email/PDF rendering remains with its owners. Shared editor compatibility
   defaults remain for unmigrated callers; this quote slice passes explicit props.
   Credit/receipt/prepayment UI remains MON-144..146; recurring is MON-137. MON-136,
   MON-131, MON-129 and MON-007 retain independent combined acceptance. Single
   document inputs/reads retain existing safe-number workflow limits; arbitrary
   bigint grouped display is not full signed-int64 public workflow support.

## Verification

All commands ran from D:/Projects/dubbl. No full build, Next dev server, Docker,
deployment, application database or .env access was used.

| Command | Actual result | Limits |
|---|---|---|
| node --import tsx --test tests/quote-ui-money.test.ts | Exit 0, 4/4 | Actual adapters/React SSR, no browser effects |
| Focused test-concurrency=2 run of quote-ui-money and quotes integration | Existing quotes worker passed; new worker initially failed only its aggregate-string assertion | All preceding REST/MCP/SQL/save/conversion assertions passed; replaced aggregate assertion with independent SQL currency sums |
| node --import tsx --test tests/integration/quote-ui-money.test.ts | Exit 0, 1/1, 5.91s | Final real REST/MCP/SQL fixture |
| pnpm test | Exit 0, 412/412 | Complete unit suite |
| pnpm typecheck | Exit 0 | Final MDX generation/TypeScript, no build |
| pnpm exec eslint on all eight changed/new TS/TSX files | Exit 0, no warnings/errors | Final source |
| pnpm lint | Exit 0, 0 errors, 104 existing warnings | Repository lint |
| python .agentic/scripts/money_inventory.py --write, then verify | Exit 0 | 415 columns, 1974 scanned files, 1472 consumers, 28069 occurrences |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0 | Actual Drizzle exports, hashes and source lines |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0, 9 regression checks | Legacy guard |
| python .agentic/agent.py validate | Exit 0, 196 tasks | Structural workflow only |
| git diff --check | Exit 0 | No whitespace errors |
| Synthetic psql database count / pg_ctl fast stop | Count 0, stop exit 0 | Dedicated cluster only |

Initial TypeScript checking exposed a generic spread retaining numeric line types;
used an explicit homomorphic mapped result type for normalized lines. Initial
render test had an escaped interpolation instead of currency text; corrected the
assertion. Initial lint caught synchronous list state resets; replaced them with
context-keyed loaded state and derived loading/error/rows. All final checks above
passed after repairs. No failed check is represented as passing.

Dedicated PostgreSQL 18 cluster:
C:/Users/Sajjad/AppData/Local/Temp/dubbl-mon143-pg-461d5d7ff56d4c1796bbb955ea18c516,
127.0.0.1:55443, synthetic trust-authenticated dubbl_ci role, loopback only,
max_locks_per_transaction=256, jit=off. Explicit TEST_DATABASE_URL targeted only
this cluster. Wrappers created/migrated/dropped random dubbl_ci_* databases and
workers received only disposable DATABASE_URL. No email/provider call was made;
MCP send_quote only changes state. Final database count zero; cluster stopped.
Temporary dedicated cluster files remain.

## Review and handoff

Actual self-review: MON-143-review-1.md. No scoped blocker. DEC-005 does not require
screenshots. No browser interactions/effect simulation, PostgreSQL 16/hosted CI
result, provider/PDF review, production IRR, full signed-int64 public workflow,
accounting/linguistic approval or parent completion is claimed. Complete controller
check/submit/self-review/done, commit task-owned files, push origin/master, verify
remote SHA and clean tree, then report the live next task without starting it.
