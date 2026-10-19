# LOC-063 attempt 1

## Identity and scope

2026-10-19 (Asia/Tehran), Codex, `D:/Projects/dubbl`, branch `master`.
Entry HEAD `409e6bc0`; entry tree was clean. Controller validate/status/next
selected LOC-063; only this bounded child was started. User requested completion
and push. After fetching origin/master, HEAD was two commits ahead and zero
behind; the push will include that existing committed ancestry without rewriting
it. Applied the remembered Dubbl controller-task skill against current source
and instructions. No subagents, build, dev server or application DB were used.

## Implementation and acceptance mapping

1. Added 93 paired `TaxPeriods` messages, bringing each catalog to 6,195 keys.
   Covered the tax-period list/detail, creation/filing/settlement sheets and
   shared settlement preview. Finite type/status mappings preserve canonical
   values and supply safe unknown labels. Notifications, titles, fields, help,
   loading/empty/error states, filing urgency/day plurals and submitted-count
   sentences use next-intl. Added the delete button's localized accessible name.
   [Scope inventory and explicit exceptions](../registries/TAX_PERIOD_CATALOGS.md)
   cover persisted statutory/user data and unchanged formatting/machine values.
2. Real React/next-intl/PresentationProvider rendering and actual production
   callback bodies with controlled IO verify both locales and behavior. The
   parser, exact-money/currency/alias checks, org headers/guard, REST/MCP payloads,
   dates, account filters, prefill and filing heuristic are unchanged. Failed
   list HTTP/JSON/envelopes are caught without adopting invalid lists. Detail
   failures clear invalid data with a localized fallback; aborted reads remain
   ignored. No-org reads release loading. Settlement errors no longer expose
   arbitrary server/parser prose; blank/invalid inputs and response mismatches
   receive localized feedback. Retry inputs remain intact.
3. Scope, handoff and honest self-review preserve LOC-028/007/002 independent
   acceptance and LOC-064/065 ownership. Persian wording is provisional; native
   terminology, full RTL/browser and statutory/release qualification stay open.
   Existing MCP operations already cover these workflows; no API, MCP service,
   schema, migration, financial helper, flag or Stripe source changed (DEC-008).

## Verification

Commands ran from the repository root with installed dependencies.

| Command/check | Actual result | Boundary |
|---|---|---|
| `node --import tsx --test tests/tax-period-catalogs.test.ts tests/tax-ui-money.test.ts tests/tax-period-wire.test.ts` | 19/19 passed, exit 0 | Includes 12 new catalog groups; real templates/provider, controlled state/IO and inline sheets |
| `pnpm test` | 1,007/1,007 passed, exit 0 | Entire unit suite |
| `pnpm typecheck` | Passed, exit 0 | fumadocs generation and tsc; no full build |
| `pnpm exec eslint 'app/(dashboard)/tax/periods/page.tsx' 'app/(dashboard)/tax/periods/[id]/page.tsx' components/dashboard/tax-settlement-preview.tsx lib/i18n/tax-period-presentation.ts tests/tax-period-catalogs.test.ts tests/tax-ui-money.test.ts` | Clean, exit 0 | All owned TS/TSX |
| `pnpm lint` | Exit 0, zero errors, 68 existing warnings | Warnings remain in unchanged code |
| `pnpm i18n:check` | 6,195 paired keys, exit 0 | ICU structure/parity; Persian script also asserted in tests |
| `python .agentic/scripts/money_inventory.py --write` | Refreshed, exit 0 | 417 columns; 1,707 consumers |
| `node --import tsx .agentic/scripts/verify_money_inventory.mjs` | Passed, exit 0 | Hash/occurrence inventory; not a financial runtime audit |
| `node .agentic/scripts/verify_legacy_money.mjs` | 9 checks passed, exit 0 | Existing financial regression guard |
| Prior-namespace deep equality with HEAD | Passed for both catalogs | Only TaxPeriods added; all prior namespaces including Stripe preserved |
| Semantic money-inventory comparison with HEAD | Only eight task-owned consumers changed | Two new scanned paths; no unrelated consumer changes |
| `git diff --check` | Passed, exit 0 | Normal Windows line-ending notices only |
| `python .agentic/agent.py validate` | Valid, 292 tasks, exit 0 | Structural integrity; rerun with final disposition |

The first focused run caught an overly strict AST assertion on the existing `%`
symbol. Added that symbol to the explicitly documented formatting exceptions;
the corrected focused and full suites passed. No application behavior changed
to satisfy that assertion. Existing tax money preview tests now use the same
PresentationProvider context as the application.

## Coverage and limits

Tests cover populated/empty/loading/error pages, known/unknown status/type labels,
hostile name/reference/notes/box-data escaping, date/box identifiers, filing
thresholds (-2/-1/0/1/2/14/15), ICU plurals, positive/negative/zero/missing net,
sheet fields/busy actions, actual Select element values and bank asset/currency
filters, exact preview scales (JPY/IRR/USD/KWD), max-safe values, invalid precision,
overflow/blank/negative/exponent input, create/file/delete reset/retry behavior,
pay/refund/zero payloads, stale/no-org/account guards, HTTP/JSON/network/array
failures, response currency/alias/amount mismatches and aborted read results.

No full build, dev server, mounted browser, screenshot, live REST/MCP/SQL,
provider, native linguistic review, complete RTL, hosted CI, deployment or
production qualification was performed. Existing formatting exceptions and
stored statutory labels remain explicitly documented. No new user operation
was introduced, and existing REST/MCP source contracts were inspected.

## Review and handoff

See [Codex self-review](LOC-063-review-1.md). Complete controller disposition,
commit task-owned files and push `origin/master` with its existing ancestry.
Verify remote HEAD parity and clean tree, report the next selected task, and
stop. This evidence records local verification, not a hosted-CI outcome.
