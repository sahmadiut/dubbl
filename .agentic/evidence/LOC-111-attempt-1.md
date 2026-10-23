# LOC-111 attempt 1 - Banking report catalogs

## Identity and scope

2026-10-23 (Asia/Tehran), Codex, D:/Projects/dubbl, master, clean entry at
33981a87. Controller validate/status/next selected LOC-111, started by Codex.
The owner authorized completion and push of one next task. No other task,
subagent, full build, dev server, deployment or application database operation.

## Acceptance mapping

1. Both scoped report pages use 34 paired BankingReports messages for all
   authored headings, descriptions, help, filters, cards, table headings,
   empty/error states, gap/review phrases and notes. Group values remain
   day/week/month. Filter selects have translated accessible names. All new
   Persian values contain Persian script. Explicit exceptions are recorded in
   [the registry](../registries/BANKING_REPORT_CATALOGS.md).
2. Production JSX renders through real next-intl and PresentationProvider with
   shared components; page hooks, IO and animation are controlled. Tests cover
   every message, caller escaping, exact low-order KWD digits, currency-separated
   totals above safe Number range, exact bigint/major-decimal CSV data and
   headers/filenames, navigation, date/account/group callbacks, scoped requests,
   valid adoption, HTTP/JSON/envelope/money/network failures and cancellation.
   Finite localized failures prevent raw diagnostics being shown. Existing
   migrated bank analytics integration verifies real REST, linked MCP and SQL.
3. Registry, task handoff, this evidence and honest self-review retain separate
   LOC-070/008/002 combined acceptance and native Persian/RTL/release gates.

Existing bank_cash_flow, bank_reconciliation_status and list_bank_accounts
operations cover the unchanged user workflows. No REST/MCP/auth/schema/migration,
ledger, FX, Stripe or IRR activation changes. Canonical Gregorian/UTC dates,
organization/filter/header keys, currency codes and exported machine contracts
are preserved. Missing-org loading and silent picker failure behavior remain.

## Verification

Commands ran at the repository root; no full build/dev server ran.

| Command / procedure | Result |
|---|---|
| node --import tsx --test --test-concurrency=1 tests/banking-report-catalogs.test.ts tests/analytical-report-ui.test.ts tests/report-directory-catalogs.test.ts tests/message-catalogs.test.ts tests/locale.test.ts | 33/33 passed, zero skips |
| Explicit loopback TEST_DATABASE_URL; node --import tsx --test --test-concurrency=1 tests/integration/bank-analytics.test.ts | 1/1 passed, migrated real REST/MCP/SQL |
| pnpm exec eslint on two scoped pages and new test | Passed, no findings |
| pnpm typecheck | Final pass after test typing correction |
| pnpm lint | Passed, zero errors and 24 existing warnings outside owned files |
| pnpm i18n:check | Passed, 9,277 compatible keys per locale |
| Final node --import tsx --test tests/banking-report-catalogs.test.ts | 2/2 passed after test typing correction |
| python .agentic/scripts/money_inventory.py --write; node --import tsx .agentic/scripts/verify_money_inventory.mjs | Passed, 417 columns and 1,830 consumers |
| node .agentic/scripts/verify_legacy_money.mjs | Nine checks passed |
| python .agentic/agent.py validate; git diff --check | Passed |

Initial typecheck found a readonly-array cast in the CSV assertion. Passing a
mutable copy of the asserted columns fixed the test typing; final typecheck,
changed-file lint and the affected tests passed. No runtime change was needed.

PostgreSQL 18 used a unique OS-temp cluster at 127.0.0.1:6491, trust auth,
max_locks_per_transaction=256. The suite created/migrated/dropped its random
dubbl_ci_* database. Final count was zero; pg_ctl stopped the cluster. No
application credentials/data were used.

An initial UTF-8 pipeline check caught lost Persian characters before acceptance;
translations were rewritten via UTF-8 files. Assertions and paired render tests
then passed. No claim of native terminology approval is made.

## Review and handoff

See [Codex self-review](LOC-111-review-1.md). Native terminology, full RTL,
calendar/numeral presentation, browser/output, full repository tests, hosted CI,
deployment and production qualification remain independent and unclaimed.
Next bounded task: LOC-112. Commit/push parity is reported after closure.
