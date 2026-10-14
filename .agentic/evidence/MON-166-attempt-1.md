# MON-166 attempt 1 - ledger, cash-flow and aging UI money

## Identity and scope

2026-10-14, coding-assistant, D:/Projects/dubbl, master. Entry HEAD
e7b00fc3bfe62204f83405ed1dadb9939e85e027; working tree was clean. Controller
selected MON-162. Actual source showed independent backend/report families;
created MON-166/167/168 and split MON-162 using the controller. MON-166 owns only
general-ledger, cash-flow, aged-receivables and aged-payables pages plus their
validation, tests and scoped orchestration documentation. No other family was
implemented. MON-162, MON-158 and MON-008 original criteria remain open.

## Acceptance mapping

1. `lib/money/ledger-aging-ui.ts` validates every consumed numeric money field
   against required canonical Minor strings, safe integers excluding negative
   zero, and explicit supported uppercase currency. State adopts bigint money.
   General ledger validates natural signs, nonnegative movements, opening plus
   period closing, deterministic running/ledger balances, duplicate identities
   and completed-page sums. Appending a page requires matching date range,
   dimension, currency, offset and saved summaries; stale/inconsistent pages
   cannot append. Request versions discard obsolete asynchronous page results.
   Cash-flow checks row/section/net sums; negative outflows are preserved. Aging
   checks currency per document, required document numbers, duplicate IDs, bucket
   labels/counts/sums and grand total. Missing/error bodies produce ErrorState
   with retry, never successful empty or zero data. Display uses currency scale
   without rescaling stored history. CSV uses explicit Minor and currency columns.
   Ledger export retains the existing loaded-entry boundary. Counts, date
   selectors, entry numbers and offsets remain nonmoney numbers. No chart in
   these four pages. Existing natural-sign, period-only ledger running balances,
   cash-flow direct/indirect heuristics and backend safe numeric range remain.

2. Eight unit behavior/source tests cover exact low digits, natural-sign and
   opening-inclusive balances, page drift/duplicates/discontinuity, malformed
   aliases, missing amounts, fractions/unsafe/negative zero, cash-flow outflows,
   aging count/currency/sum failures, explicit scales, exact CSV and failed HTTP.
   New migrated PostgreSQL fixture invokes four actual authenticated REST
   handlers and linked SDK registered direct-DB MCP tools, adopts both through
   the browser adapters, and independently checks SQL text. Fixtures retain
   period cash 9007199252999150, closing ledger 9007199252999251, first ledger
   balance 9007199253000102 and aging 9007199253001251. The ledger has 52 rows,
   initial 50 and appended 2; direct/indirect cash flow agree in this fixture.
   USD/JPY/KWD/synthetic IRR contexts preserve raw units and digits. Foreign
   organization entry/document/account data is excluded despite hostile org
   headers. Invalid REST auth and denied MCP permission fail. Malformed DTOs
   fail adoption; real persisted overflow fails REST 422 LEGACY_NUMERIC_RANGE
   and MCP, without read-time financial/audit changes. SQL-text snapshots remain
   unchanged across report, adapter, permission and overflow-read operations.
   Existing ledger-detail/cash-flow/aging integration suites separately pass.

3. `LEDGER_AGING_UI_CUTOVER.md`, MONEY_MANIFEST, TEST_MATRIX, money README and
   generator map the scoped consumers and unit exceptions. Regenerated
   MONEY_BOUNDARIES tracks LF hashes/source lines and MON-166 ownership. Removed
   four scoped legacy helper allowances. Links, money/static guards and controller
   validation pass. Parent acceptance is explicitly independent.

## Verification and environment

All commands ran from D:/Projects/dubbl. Dedicated trust-auth PostgreSQL 18
cluster in C:/Users/Sajjad/AppData/Local/Temp/dubbl-mon166-pg-6edbbd6c556b4c439f18ba0fcc6dc5d7,
127.0.0.1:1966, dubbl_ci role, max_locks_per_transaction=256, jit=off. Explicit
TEST_DATABASE_URL and PG_BIN targeted this cluster; wrappers created, migrated
and dropped randomized fixture databases. Final fixture database count was 0;
pg_ctl fast stop passed. Temporary cluster files remain. No application .env/DB,
full build, dev server, Docker, provider or production action.

| Command/check | Actual result | Limitation |
|---|---|---|
| node --import tsx --test tests/ledger-aging-ui.test.ts | Exit 0, 8/8; final rerun after UTF-8 wording fix also 8/8 | Behavior/source checks, no live browser |
| pnpm test | Exit 0, 527/527 | Unit/behavior suite |
| node --import tsx --test --test-concurrency=2 tests/integration/ledger-aging-ui.test.ts tests/integration/ledger-detail.test.ts tests/integration/cash-flow.test.ts tests/integration/aging.test.ts | Three existing suites passed; new fixture initially failed | Wrong MCP tool name in new fixture (cash_flow instead of cash_flow_statement), corrected |
| node --import tsx --test tests/integration/ledger-aging-ui.test.ts | Final exit 0, 1/1, four reports/four currencies | Real REST/MCP/SQL, no browser |
| pnpm typecheck | Final exit 0 | Initial new test dynamic-key typing failed; corrected before final run |
| pnpm exec eslint on four pages, adapter and three new test files | Exit 0, no warnings/errors | Focused check |
| pnpm lint | Exit 0, zero errors/90 warnings | Existing warnings outside scoped files |
| python .agentic/scripts/money_inventory.py --write; python .agentic/scripts/money_inventory.py | Exit 0; 415 columns, 2086 scanned paths, 1567 consumers, 30489 occurrences | Final regeneration after wording fix |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0 | Drizzle metadata, LF hashes and source occurrences |
| node .agentic/scripts/verify_legacy_money.mjs | Exit 0, 9 regressions | Legacy-helper static gate |
| Owned Markdown link existence check | Passed | Task index, coverage and new registry |
| python .agentic/agent.py validate; git diff --check | Exit 0 | Structural/integrity checks |

## Review and handoff

Honest self-review: MON-166-review-1.md. Final diff review caught a Windows Python
default-encoding artifact in existing punctuation; restored original UTF-8
wording in the owned pages and regenerated hashes. No browser/layout/PDF output
or native Persian wording qualification. Backend accounting heuristics, production
IRR enablement and full-int64 API support remain outside this slice. MON-167/168
retain the other report contracts; MON-163 owns contacts/dashboard/shared display.
Controller checks, submit, self-review and done precede user-authorized scoped
commit/push; final remote parity and tree status are reported after pushing.
