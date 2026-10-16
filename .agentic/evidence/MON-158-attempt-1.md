# MON-158 attempt 1 - report, contact and dashboard combined acceptance

## Identity and environment

2026-10-16, Asia/Tehran; codex (implementing coding assistant), self-review only.
Repository D:/Projects/dubbl, master; clean entry HEAD
`5ef08ce4072a683d3d39bba39aa808434afe7079`. User requested completing and pushing
the next task. Live controller validate/status/next selected MON-158 after all
three child prerequisites completed; start claimed the parent. Original criteria
and independent MON-008 acceptance remain intact. No delegation or human review.

Read repository/controller/project/role instructions, selected task, dependency
attempt/review evidence, source requirements (API backward compatibility and
database/currency migration), registries and actual adapters, consumers, REST
handlers, MCP registration, shared services and existing financial fixtures.
The memory Dubbl controller-task skill guided the bounded delivery workflow.

Explicit TEST_DATABASE_URL and PG_BIN selected a dedicated PostgreSQL 18 cluster
at 127.0.0.1:55463, synthetic dubbl_ci role, trust auth, loopback listener, UTC,
max_locks_per_transaction=256 and jit=off. Cluster path:
C:/Users/Sajjad/AppData/Local/Temp/dubbl-mon158-pg-58be2c2b03e64bc8b056e585dafd1d5d.
Each fixture creates, migrates and drops its own randomized database. Final
fixture database count was zero and pg_ctl fast shutdown passed. Temporary files
remain outside Git. No application .env/database access, schema/migration change,
full build, dev server, Docker, provider, deployment or production action.

## Acceptance mapping

1. Existing MON-161/162/163 runtime implementations already compose correctly.
   REPORT_CONTACT_CUTOVER_ACCEPTANCE joins all 32 report pages, contact screens,
   auxiliary dashboard/widgets and shared display/export helpers to the actual
   child contracts. Required safe numeric or fixed-two decimal aliases agree
   with canonical Minor text and explicit currency before bigint UI adoption.
   Derived sums, signed movement, comparison and forecast totals remain exact.
   Documented budget/fixed-two, quantity/count, percentage/ratio, chart geometry,
   raw CSV, numeric XLSX, current-base/raw-history ledger and consolidation
   exceptions are retained. Source/behavior regressions cover failed adoption,
   stale request cleanup and suppressed output. No duplicated runtime service
   or public MCP operation is necessary; existing org-scoped direct-DB tools
   remain the API peers. No saved unit, FX/history or production flag changes.

2. New report-contact-cutover-acceptance test/worker independently composes
   eleven authenticated REST/linked SDK registered MCP operations through the
   actual UI adapters in separate USD/JPY/KWD/synthetic IRR tenants. Shared
   posted journals and outstanding documents preserve literal 4000000003
   revenue and 907 expense. SQL text independently proves net 3999999096 and
   maximum-safe credit limit 9007199254740991. PnL, balance-sheet assets/equity,
   ledger cash, cash flow, tracking, aging, contact debit/credit/closing balance,
   forecast inflows/outflows/net and monthly trends reconcile those literals.
   Contact activity retains each amount/currency; contact detail additionally
   has real REST/registered MCP parity and exact credit input round-trips.
   REST contact-list balances retain their richer envelope; MCP list_contacts
   intentionally has no balance aggregates. Due-tomorrow documents appear in
   forecast/aging and stay out of overdue alerts. Explicit currency display and
   raw-Minor CSV retain low digits; tooltips read original integers.

   Eleven operation pairs reject corrupt adoption, unauthorized REST and denied
   MCP. Hostile organization headers cannot change scope; foreign contact IDs
   fail in both transports. Repeated responses and full ordered SQL JSON-text
   financial/audit snapshots are unchanged (API-key usage metadata excluded).
   Balanced extra maximum-safe ledger posting plus an extra maximum-safe invoice
   makes nine report/contact/forecast operations return REST 422 and MCP
   LEGACY_NUMERIC_RANGE. UI HTTP adoption and contact-list aggregation reject;
   failed reads leave persisted rows unchanged. Joint child/domain fixtures
   retain cumulative/period comparison, negative balances, mixed currencies,
   historical FX, tax, consolidation, custom projections, bank, dashboard,
   permissions, concurrency, corruption/range and export policies.

3. New combined registry, MONEY_MANIFEST, TEST_MATRIX and money README document
   ownership and supersede MON-158-pending notes without rewriting completed
   child evidence. Regenerated MONEY_BOUNDARIES adds the two new fixture paths
   and current consumer records; runtime child ownership stays intact. Inventory,
   source/legacy/static, local-link and controller guards pass. MON-008 remains
   independently open; completion does not imply production qualification.

## Verification

All commands ran from D:/Projects/dubbl. The joint integration command was
`node --import tsx --test --test-concurrency=2` with these explicit paths under
tests/integration (no shell brace expansion):

```text
report-contact-cutover-acceptance.test.ts auxiliary-ui-cutover-acceptance.test.ts
financial-statement-ui.test.ts contact-wire.test.ts contact-statement.test.ts
forecast-fx.test.ts dashboard-data.test.ts kpi-analytics.test.ts
cumulative-statement.test.ts period-statement.test.ts ledger-aging-ui.test.ts
budget-project-crm-ui.test.ts tax-report.test.ts consolidation-report.test.ts
custom-reports.test.ts bank-analytics.test.ts
```

| Check | Actual result | Limitation |
|---|---|---|
| Initial new parent fixture alone, explicit loopback TEST_DATABASE_URL | Exit 0, 1/1, 35.551 seconds | Before final explicit currency/activity/overdue assertions |
| Joint integration command above | Exit 0, 16/16, 206.815 seconds, zero skips | Includes final strengthened parent worker; selected combined families, not all historical integrations |
| pnpm test | Exit 0, 550/550, 39.691 seconds | Full unit/behavior/static suite; no live browser |
| pnpm typecheck | Exit 0, including final run after worker assertions settled | fumadocs-mdx plus tsc, no build |
| Native Node ESLint on both new TypeScript files | Exit 0, zero warnings/errors, including final run | Task-owned TypeScript only |
| pnpm lint | Exit 0, zero errors/81 existing warnings in unchanged files | Existing warnings retained |
| python .agentic/scripts/money_inventory.py --write; then without flags | Exit 0; 415 columns, 2101 scanned files, 1579 consumers, 30980 occurrences | Lexical inventory; final worker hash separately compared with artifact |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0, columns/consumer hashes/source lines verified | Final worker SHA256 matches generated record after edits |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0, 9 regression checks | Existing legacy money gate |
| Changed documentation local Markdown links | Exit 0, 243 links/zero missing | Local existence only; evidence/review links checked before submission |
| python .agentic/agent.py validate; git diff --check | Exit 0 | Structure/whitespace only, repeated after completion |
| git fetch origin master; divergence check | Exit 0, 0 ahead/0 behind before delivery | Actual pre-delivery synchronization |
| psql fixture DB count; pg_ctl fast stop | 0 remaining dubbl_ci_% databases; exit 0 shutdown | Dedicated synthetic cluster only; temporary files retained |

No test failure was observed. Source discovery corrected nonexistent path probes
and a malformed PowerShell search; these were not successful checks. Self-review
strengthened currency, activity cardinality and due-tomorrow alert assertions;
the final joint fixture, final typecheck, lint and worker inventory hash passed.
A final verification shell call stalled while collecting controller output;
resuming it confirmed exit 0. Integration timing above is the test runner's
actual duration, not that shell/tool wait.

## Review and handoff

Honest implementing-agent self-review: [MON-158-review-1](MON-158-review-1.md).
No scoped blocker remains. Complete controller check/submit/self-review/done,
stage only task-owned files, commit/push the authorized origin/master, verify
remote SHA and clean tree, report the live next task and stop. Git/final response
record the actual delivery SHA after the commit; no future push is invented here.

Existing trial-balance natural-sign accounting defect (PAR-008/QA-001), backend
current-base/raw-history conventions, full-int64 business support, MON-008,
migration, production IRR, native-language/accounting/security and release gates
remain independent. No browser/screenshot/physical print/download, hosted CI,
independent peer/human approval, provider/deployment or production qualification.
Local PostgreSQL 18 results do not qualify hosted PostgreSQL 16 or CI.
