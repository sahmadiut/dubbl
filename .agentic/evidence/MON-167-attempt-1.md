# MON-167 attempt 1 - report result UI money

## Identity and environment

- Date: 2026-10-16. Operator: Codex. Review is explicitly self-review.
- Repository: D:/Projects/dubbl, master; entry HEAD
  `8c933f8636595ae305fb5bd24771c111b65fe325`, clean entry tree. Controller
  validate/status/next selected MON-167; started with owner codex.
- Synthetic, randomized disposable databases via explicit loopback
  TEST_DATABASE_URL on an isolated PostgreSQL 18 Windows cluster (port 55467),
  initialized for this task with trust auth on 127.0.0.1 only. No .env or
  application database access. Temporary cluster/logs retained outside Git;
  fixture databases removed and cluster stopped after integration checks.

## Implementation and acceptance mapping

1. All seven scoped result pages now use `lib/money/report-result-ui.ts` before
   adopting server results. Required canonical numeric/Minor pairs preserve
   source integers and reject absent/conflicting/malformed/unsafe amounts or
   unsupported currencies. Display and bigint totals use explicit saved currency.
   Tax-summary and VAT signed identities and tracking column/row/net identities
   are validated. Consolidation account/summary totals and entity maps validate
   without equating pre-elimination entity columns to post-elimination totals.
   Its grouped totals use bigint. Report errors clear results and expose alerts;
   superseded consolidation/custom/saved runs cannot replace newer data.
   Custom/saved read projections include hidden carriers and row currency;
   original saved configurations and filters/date ranges are preserved.
2. Six behavior/static test groups cover scales, refunds, low digits, invalid
   money/HTTP/JSON, array alignment, consolidation/CSV and custom null/Minor
   projections. Four extended real authenticated REST/linked registered MCP
   fixtures consume both transport results with these adapters. Independent
   SQL-text assertions verify 1099 sums, tracking net income, translated large
   amounts and signed custom source values. Existing authorization, org scope,
   corrupt/unsafe history, unchanged failures, concurrency and server export
   regressions remain. USD/JPY/KWD/synthetic IRR units remain unchanged.
3. [REPORT_RESULT_UI_CUTOVER](../registries/REPORT_RESULT_UI_CUTOVER.md) maps every
   scoped consumer, REST/MCP pair, unit exception and validation boundary. Manifest,
   money README and test matrix link the mapping. Inventory ownership maps these
   seven pages/shared adapter to MON-167; generated artifacts are current. Five
   obsolete legacy formatting allowances are removed (15 JSON lines, 49 allowed
   formatMoney uses). MON-162, MON-158 and MON-008 retain independent acceptance.

Raw-unit exceptions: CSV and explicit Minor columns preserve canonical integer
strings; quantity/count/percentage/date/text fields keep their existing units.
Consolidation retains backend raw-unit translation and elimination semantics.
CSV adds currency to 1099/consolidation; organization IDs distinguish duplicate
entity labels so exports cannot overwrite other entity or total columns.

## Verification

All commands ran from the repository root; no full build or dev server ran.

| Command / check | Actual result | Limits |
|---|---|---|
| `node --import tsx --test tests/report-result-ui.test.ts` | Exit 0, 6/6 | Pure behavior/static and exact formatting, no browser |
| `TEST_DATABASE_URL=loopback node --import tsx --test --test-concurrency=2 tests/integration/{tax-report,compound,consolidation-report,custom-reports}.test.ts` (explicit paths in PowerShell) | Exit 0, 4/4; final run 29.290 seconds | Current migrations, real REST/MCP/SQL on disposable PostgreSQL 18, not all integration suites or PostgreSQL 16 CI |
| `pnpm test` | Exit 0, 542/542; final run 20.193 seconds | Full pure/static suite |
| `pnpm typecheck` | Exit 0 | fumadocs-mdx and tsc only |
| `pnpm exec eslint` on every changed/new TypeScript file | Exit 0, zero warnings/errors | Seven pages, adapter/unit test, four integration workers |
| `pnpm lint` | Exit 0, zero errors/81 warnings outside task-owned files | Existing unrelated warnings preserved; scoped warnings cleaned |
| `python .agentic/scripts/money_inventory.py --write`, then without flags | Exit 0; 415 columns, 2095 scanned files, 1574 consumers, 30798 occurrences | Lexical ownership/hash guard |
| `node --import tsx .agentic/scripts/verify_money_inventory.mjs` | Exit 0, Drizzle/consumer hashes/source occurrences verified | Static consistency |
| `node --import tsx .agentic/scripts/verify_legacy_money.mjs` | Exit 0, 9 regression checks | Existing legacy guard |
| `git diff --check` | Exit 0 | CRLF conversion notices only |
| Local Markdown link check across mapping, evidence, manifest, README and test matrix | Exit 0, 230 links/zero missing | Path existence only |
| `python .agentic/agent.py validate` | Exit 0, 218 structurally valid tasks | Controller structure, not financial proof |
| `git fetch origin master`; divergence | Exit 0, entry `0 0` | Pre-delivery remote synchronization |
| Fixture database count; `pg_ctl -m fast -w stop` | Zero remaining `dubbl_test_%` databases; exit 0 shutdown | Synthetic temporary files retained |

Initial lint caught unescaped apostrophes in new unit guidance and unused scoped
imports/directives; corrected. An intermediate typecheck caught one stale
`exportData` reference after extracting export helpers; corrected. Inventory
verification during overlapping source edits detected drift; final regeneration
and both inventory gates passed after source settled. These intermediate failures
are not reported as passed checks.

## Review and handoff

Self-review: [MON-167-review-1](MON-167-review-1.md). No task blocker remains.
Complete controller criteria/submit/self-review/done, commit only task-owned files,
push authorized origin/master, verify remote SHA/tree and report the live next
task without starting it. Git and the final reply record actual commit/push
results; no future SHA or push is invented here.

No browser/screenshot, physical print/download, hosted CI, accounting/native
linguistic review, production/provider/IRR action, Docker, schema/migration change,
or independent peer/human review is claimed. Existing tax policy and safe numeric
compatibility limits remain. Parent acceptance is separate.
