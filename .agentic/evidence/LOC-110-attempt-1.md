# LOC-110 attempt 1 - Tax report catalogs

## Identity and scope

2026-10-23 (Asia/Tehran), Codex, D:/Projects/dubbl, master. Clean entry tree
at e6b896d3. Controller validate/status/next selected LOC-110; started with owner
codex. The owner authorized completion and push of the next bounded task. No
other task was started. No subagents, full build, dev server, deployment or
application database operations were used. Stripe remains unchanged (DEC-008).

## Acceptance mapping and implementation

1. Added 64 paired TaxReports messages across 1099, tax-summary and vat-return.
   Headings, descriptions, help, threshold/withholding/form badges, columns,
   due/refund phrases, nine VAT box explanations, official-label prefix, links,
   empty and finite failure copy are cataloged. Existing catalog namespaces are
   unchanged; every new Persian message contains Persian script. The
   [scope registry](../registries/TAX_REPORT_CATALOGS.md) records explicit shared
   component, statutory-label, machine, date, money and number exceptions.
2. Six production JSX/behavior tests render both locales through real next-intl,
   PresentationProvider and shared UI, with controlled page hooks/IO/animation.
   They assert every added message, escaped caller data, exact KWD low-order
   digits, USD/JPY/IRR scales, refund/due branches, 1099 CSV exact integers and
   headers/booleans, year/date/basis callbacks, nine VAT boxes, raw/drill URLs,
   expansion and aria-expanded. HTTP/JSON/envelope/money/network failures cannot
   adopt unsafe data or expose raw diagnostics. Loading/empty/error, missing org,
   URL date initialization and cancelled success/rejection retain behavior.
   Existing migrated PostgreSQL suites exercise real REST, linked MCP and SQL.
3. Registry/task handoff, this evidence and honest self-review preserve separate
   LOC-070/008/002 combined acceptance and native/RTL/output/release gates.
   Persian tax wording remains provisional; no native review is claimed.

The existing report_1099, tax_summary and vat_return tools already cover these
operations. No REST/MCP/auth/schema/migration/ledger/FX/IRR flag changes were
needed. Official statutory labels, US/EU meanings, rate names, tax identifiers,
dates/year/basis/organization/query keys and export fields/values remain. Raw
failure messages are replaced by reviewed finite localized copy. No Iranian
statutory tax compliance is implied.

## Actual verification

All commands ran at the repository root. No full build or dev server ran.

| Command / procedure | Actual result |
|---|---|
| node --import tsx --test --test-concurrency=1 tests/tax-report-catalogs.test.ts tests/report-result-ui.test.ts tests/tax-report-wire.test.ts tests/report-directory-catalogs.test.ts tests/message-catalogs.test.ts tests/locale.test.ts | 38/38 pass, zero skips |
| Final node --import tsx --test tests/tax-report-catalogs.test.ts | 6/6 pass after test-only typing correction, zero skips |
| Explicit loopback TEST_DATABASE_URL; node --import tsx --test --test-concurrency=1 tests/integration/tax-report.test.ts tests/integration/operational-report-integration.test.ts | 2/2 pass, zero skips; actual REST/linked MCP/SQL on migrated random disposable databases |
| pnpm typecheck | Final pass, fumadocs-mdx and tsc --noEmit |
| pnpm i18n:check | Pass; 9,243 compatible catalog keys per locale |
| pnpm exec eslint on three scoped pages and new test | Final pass, no findings |
| pnpm lint | Pass; zero errors, 24 existing warnings outside owned files |
| python .agentic/scripts/money_inventory.py --write; node --import tsx .agentic/scripts/verify_money_inventory.mjs | Pass; 417 columns and 1,829 consumer hashes/source occurrences |
| node .agentic/scripts/verify_legacy_money.mjs | Nine regression checks pass |
| Structured catalog/inventory comparison | Existing catalog namespaces and money classifications preserved; changed consumer entries limited to owned pages/test |
| python .agentic/agent.py validate; git diff --check | Pass; 347 structurally valid tasks, no whitespace errors |

The initial typecheck identified an inferred fixture object missing amountMinor
in the deliberate corrupt-alias test. Object.assign now injects the negative
test field; the corrected typecheck and six product tests pass. No runtime fix
was needed for this test typing issue.

PostgreSQL 18 used a unique OS-temp cluster at 127.0.0.1:6490 with trust auth and
max_locks_per_transaction=256. Suites created, migrated and dropped random
dubbl_ci_* databases. Final admin count was zero and pg_ctl stopped the cluster.
Application .env/database credentials and data were unused.

## Review and handoff

See [Codex self-review](LOC-110-review-1.md). LOC-070/008/002 remain independent.
Native linguistic/full RTL/date/numeral/browser, adjacent output, full repository
test suite, hosted CI, deployment and production qualification are not claimed.
Next bounded task is LOC-111. Commit/push SHA and remote parity are reported
separately after controller closure.
