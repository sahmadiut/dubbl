# LOC-064 attempt 1

## Identity and scope

2026-10-19 (Asia/Tehran), Codex, `D:/Projects/dubbl`, branch `master`.
Entry HEAD `3e1135913a98ca63a2d74572a016fe09661c98d1`; entry tree was clean.
Controller validate/status/next selected LOC-064 and only this child was started.
The user requested completion and push. Fresh fetch confirms entry HEAD equals
origin/master, zero ahead/behind. Applied the remembered controller-task skill
against current instructions/source. No subagents or application DB were used.

## Implementation and acceptance mapping

1. Extracted 43 paired `VatReturn` messages, bringing each catalog to 6,238 keys.
   Includes page/document titles, basis/flat-rate controls and help, print and
   period navigation, summary and due/refund headings, known live box labels,
   calculated badge, drilldown loading/empty/table states and ICU line totals.
   The finite box-ID mapping retains statutory IDs and escaped unknown data.
   [Inventory and exceptions](../registries/VAT_RETURN_CATALOGS.md) document all
   owned surfaces, reused shared copy and preserved data/formatting contracts.
2. Actual templates/effects/callbacks are executed with controlled local state
   and IO. Real React/next-intl/PresentationProvider rendering verifies both
   locales, positive/zero/refund values across USD/JPY/IRR/KWD, all nine boxes,
   unknown/prototype-like IDs, hostile data escaping, ICU plural branches and
   exact aggregate 9007199254740993 minor units. Behavior checks preserve org
   headers, canonical dates, basis and flat-rate basis points, drill box query,
   print, CSV columns/wire labels/integer strings, cached/closing drill behavior,
   period/basis invalidation, cancellation/generation guards, no-org behavior
   and loading completion. HTTP/JSON/shape/alias/currency/network failures use
   localized fallbacks without arbitrary diagnostic prose or invalid adoption.
3. Scope registry, task handoff and honest self-review record provisional Persian
   and independent LOC-028/007/002, native, L10N/RTL/browser and statutory gates.

REST GET VAT report/drill routes and corresponding `vat_return` and
`vat_return_transactions` MCP registration were inspected. They continue through
shared report services and scoped direct DB access. No new operation, REST/MCP
implementation/schema, money helper, database migration, flag or Stripe change.
The existing filing/navigation destination was extracted under LOC-063; no
duplicate filing mutation was introduced on this report page.

## Verification

All commands ran from repository root against source and synthetic fixtures.

| Command | Actual result | Limit |
|---|---|---|
| `node --import tsx --test tests/vat-return-catalogs.test.ts tests/tax-ui-money.test.ts tests/tax-report-wire.test.ts` | 17/17 passed, exit 0 | Nine new catalog groups and eight financial/wire groups |
| `pnpm test` | 1,016/1,016 passed, no failures/skips, exit 0 | Unit/SSR and controlled IO; not live services |
| `pnpm typecheck` | Passed, exit 0 | MDX generation and no-emit TypeScript; no build |
| `pnpm i18n:check` | Passed, 6,238 keys each locale, exit 0 | ICU/parity, not native linguistic approval |
| `pnpm exec eslint 'app/(dashboard)/tax/vat-return/page.tsx' lib/i18n/vat-return-presentation.ts tests/vat-return-catalogs.test.ts` | Clean, exit 0 | Owned TS/TSX |
| `pnpm lint` | Zero errors, 68 existing warnings, exit 0 | Existing warning baseline retained |
| `python .agentic/scripts/money_inventory.py --write` | Refreshed, exit 0 | 417 columns, 1,708 consumers, 2,277 scanned files |
| `node --import tsx .agentic/scripts/verify_money_inventory.mjs` | Passed, exit 0 | Hash/occurrence inventory |
| `node .agentic/scripts/verify_legacy_money.mjs` | Nine regression checks passed, exit 0 | Existing financial guard |
| `git diff --check` | Passed, exit 0 | Normal Windows line-ending notices only |
| Prior-namespace deep equality with HEAD | Passed for both catalogs | Only VatReturn added; prior namespaces including Stripe preserved |
| Semantic inventory comparison with HEAD | Four owned consumers changed; no unrelated changes | VAT route, both catalogs, new catalog test; two new scanned paths |
| Owned task/registry/evidence relative-link audit | Passed | Referenced local files exist |
| `python .agentic/agent.py validate` | Valid, 292 tasks, exit 0 | Structural integrity; rerun after disposition |

The first focused run exposed a test harness CJS/ESM context mismatch in shared
controls. Importing the real export/date-range controls through the same module
identity as PresentationProvider corrected the harness; no production behavior
was changed to satisfy the test. Corrected focused and full suites pass.

## Limits and review

Own hooks/effects are controlled; browser mounting, visual RTL, physical print,
live REST/MCP/SQL, native terminology, statutory compliance, hosted CI, provider,
deployment and production qualification were not run. No full build or dev
server was run. Existing numeric/date/input and control-account reconciliation
semantics are retained and documented; this is catalog extraction only.

See [Codex self-review](LOC-064-review-1.md). Finish controller disposition,
stage/commit task-owned files, push origin/master, confirm remote SHA and clean
tree, report the next task and stop. This evidence is local verification and
does not assert the outcome of the subsequent hosted-CI run.
