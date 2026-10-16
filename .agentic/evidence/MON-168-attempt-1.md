# MON-168 attempt 1 - analytical and bank report UI money

## Identity and environment

- Date: 2026-10-16. Operator/reviewer: Codex, explicitly self-review.
- Repository: D:/Projects/dubbl, master, clean entry tree at
  `965caf067e62de0fcdf0a2beb69cc86815ffbaf4`.
  Controller validate/status/next selected MON-168; started with owner codex.
- Explicit loopback TEST_DATABASE_URL targets an isolated PostgreSQL 18 cluster
  initialized for this task at port 55468, listening only on 127.0.0.1. Seven
  randomized disposable migrated fixture databases are created/dropped by the
  integration harness. No .env/application database access or provider actions.
- Fixtures finished with zero `dubbl_ci_%` databases remaining; cluster stopped
  successfully. Temporary cluster/log files remain outside the repository.

## Acceptance mapping

1. Eleven scoped pages now adopt results through pure browser-safe validators
   in `lib/money/analytical-report-ui.ts`. Safe numeric values must agree with
   required canonical Minor strings and supported currency before state changes.
   Bigint totals preserve bank inflow/outflow/running identities, aging buckets,
   expense/category/month sums, vendor sums, contact profit and KPI differences.
   Forecast reuses MON-163 validation. Numeric ratios must agree with decimal
   RatiosExact strings, which control presentation. Failed reads clear rows and
   expose alerts; superseded requests cannot replace current results. CSV buttons
   suppress stale data while loading or after failure. Vendor spend now exposes
   the existing document currency filter and uses the saved currency rather than
   implicit USD. Bank review totals remain grouped by currency.
2. Eight behavior/static test groups verify source units, signed low digits,
   USD/JPY/KWD/synthetic IRR, safe-max values, missing/conflicting/malformed/unsafe
   aliases, unsupported/mismatching currency, HTTP/JSON failures, report totals,
   grouping, exact CSV and separate ratio aliases. Seven actual REST/linked
   registered MCP fixtures adopt both transports. Independent SQL-text assertions
   reconcile UI bank net, expense totals, vendor totals, collected amounts,
   budget calendar events, forecast safe-max amounts and ratio net income.
   Existing scope/permissions/corrupt history/unsafe totals and binary export
   regressions remain intact.
3. [ANALYTICAL_REPORT_UI_CUTOVER](../registries/ANALYTICAL_REPORT_UI_CUTOVER.md)
   maps every page and existing shared REST/MCP boundary. Manifest, money README
   and test matrix link this mapping. Inventory ownership maps eleven pages and
   the shared adapter to MON-168. Eleven obsolete legacy allowances are removed
   (33 JSON lines, 53 allowed legacy formatMoney uses). MON-162, MON-158 and
   MON-008 retain independent acceptance; their criteria/status are unchanged.

Adjacent inspection: pack only constructs a server XLSX URL; schedules edit
configuration/delivery metadata with no client money; budget-vs-actual already
uses MON-157 required aliases and bigint state. No duplicate cutover is needed.

Retained units: CSV raw-minor columns and explicit payment Minor fields remain
canonical integers with currency; bank-status CSV retains exact major decimals.
Only chart geometry/axes and nonmoney counts/dates/percentages/ratios use Number.
Tooltips retain original bigint amounts. No storage rescaling, history, schema,
migration, REST/MCP operation/schema, tax policy or IRR enablement changes.

## Verification

All commands ran at the repository root. No full build or dev server ran.

| Command/check | Actual result | Limitation |
|---|---|---|
| `node --import tsx --test tests/analytical-report-ui.test.ts` | Exit 0, 8/8; included in final full suite | Pure behavior/static, no browser |
| Explicit loopback TEST_DATABASE_URL, `node --import tsx --test --test-concurrency=2` with bank-analytics, kpi-analytics, document-analytics, operational-reports, forecast-fx, payment-performance and compound integration paths | Exit 0, 7/7; final run 47.373 seconds | PostgreSQL 18, not all integration suites or PostgreSQL 16 CI |
| `pnpm test` | Exit 0, 550/550, 106.896 seconds | Full pure/static suite |
| `pnpm typecheck` | Exit 0 | fumadocs-mdx and tsc only |
| `node node_modules/eslint/bin/eslint.js` with explicit changed/new TS paths | Exit 0, zero warnings/errors | Eleven pages, adapter/test and seven workers |
| `pnpm lint` | Exit 0, zero errors/81 warnings outside task-owned files | Existing unrelated warnings preserved |
| `python .agentic/scripts/money_inventory.py --write`, then without flags; `node --import tsx .agentic/scripts/verify_money_inventory.mjs`; `node --import tsx .agentic/scripts/verify_legacy_money.mjs` | Exit 0; 415 columns, 2097 scanned files, 1576 consumers, 30895 occurrences; 9 legacy regressions passed | Static classification/hash guards |
| `python .agentic/agent.py validate` | Exit 0, 218 valid tasks | Structural, not financial proof |
| `git diff --check` | Exit 0 | CRLF notice only |
| Local Markdown link check | Exit 0, 235 changed-document links/zero missing | Path existence |
| `git fetch origin master`; divergence | Exit 0, entry 0 ahead/0 behind | Pre-delivery remote synchronization |
| Fixture database count, `pg_ctl -m fast -w stop` | Zero remaining fixture DBs; exit 0 shutdown | Temporary data/log files retained |

Intermediate checks caught a duplicate forecast-validator import and its derived
type mismatch; resolved by reusing the existing MON-163 validator. A ratio table
needed readonly tuples to retain its bigint value type. Obsolete scoped lint
suppressions were removed. The initial pnpm wrapper lint command grouped Windows
arguments incorrectly; the corrected native Node ESLint invocation passed. These
intermediate results are not represented as successful checks. Controller
criterion 2 initially hit Windows WinError 5 during atomic replacement; a
fresh retry succeeded with criterion 1 retained, without bypassing the controller.

## Review and handoff

Self-review: [MON-168-review-1](MON-168-review-1.md). Final verification passed. Complete
controller criteria/submit/self-review/done, commit task-owned files, push
authorized origin/master, verify remote SHA/clean tree and report the live next
task without starting it. Git/final response record the actual delivery SHA.

No browser/screenshot, physical download/print, hosted CI, independent peer/human
review, new accounting/native-language review, Docker, deployment or production
qualification is claimed. Existing backend accounting and safe numeric limits
remain; this child does not close its integration parents.
