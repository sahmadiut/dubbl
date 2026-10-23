# LOC-070 combined reporting catalog evidence

## Identity and result

2026-10-23 (Asia/Tehran). Operator: Codex, on master; clean tree at entry,
baseline HEAD 3b9980f9. This is independent combined acceptance after LOC-103..114,
not a new report feature or acceptance of LOC-008/002.

Audited all 34 reporting TSX components, shared controls, child catalog scope and
their actual production rendering/transport tests. Fourteen namespaces contain
654 paired messages; both full catalogs contain 9,430 compatible keys. The new
report-catalog-integration.test.ts pins unique component ownership, audits
authored source text, and exercises checked income/P&L data with shared pack
filters under real next-intl/PresentationProvider. Tests preserve exact low
digits, escaped caller data, USD/JPY/KWD presentation, CSV bytes, canonical
Gregorian date/basis callbacks and scoped failed-read rejection.

No product/catalog source change was needed. Added combined acceptance registry,
message-index link, evidence/review and task handoff. Money inventory adds only
the new test scan/consumer; 417 schema columns and previous consumer records
remain unchanged. REST/MCP, schema/migrations, stored values/history, exports,
IRR flags and Stripe are unchanged.

## Acceptance mapping

1. All 34 components and their fourteen namespaces have one explicit owner.
   Authored display copy is catalogued; source/rendering checks and the current
   child scope audits pass. REPORT_CATALOG_ACCEPTANCE.md records saved data,
   statutory, shared-control, formatting, protocol/export and opaque server-title
   exceptions. All 654 Persian messages contain Persian script; no native
   linguistic approval is inferred.
2. Four combined and the current child/catalog/locale checks pass, alongside
   eleven migrated real REST/linked registered MCP/SQL suites. Exact money,
   organization scope, canonical filters/payloads, CSV/workbook contracts,
   cancellation and finite failures retain their behavior. The tests exercise
   production JSX/controls and actual transport services, not translated fixture
   labels alone.
3. The combined registry, handoff and honest self-review record provisional
   Persian terminology and independent LOC-008/002/native/RTL/output/release
   ownership. Completed children did not close their parent automatically.

## Verification

Executed from D:\Projects\dubbl:

- Focused Node tests: selected report-catalog-integration, report-directory,
  income, balance-cash, ledger, aging-vendor, analytical, forecast-calendar, tax,
  banking, custom, scheduled, consolidation-pack catalogs plus message-catalogs
  and locale test files through PowerShell Get-ChildItem and
  `node --import tsx --test --test-concurrency=1 @focused`: 83 passed, zero
  failures, skips or cancellations. Includes four new combined checks.
- `node --import tsx --test --test-concurrency=1` with integration files
  financial-report-integration, operational-report-integration,
  auxiliary-report-integration, report-dashboard-integration, budget-report,
  forecast-fx, tax-report, custom-reports, report-schedules, consolidation-config
  and consolidation-report: 11 passed, zero failures/skips/cancellations.
- PostgreSQL 18 OS-temp unique cluster, trust auth, loopback 127.0.0.1:6495,
  max_locks_per_transaction=256; explicit TEST_DATABASE_URL. Each fixture creates
  and drops a randomized database and applies current migrations. Final SQL
  count of dubbl_ci_* databases was zero, and pg_ctl stopped the cluster.
  Application database/configuration credentials were not used.
- `pnpm typecheck`: passed, including generated MDX and tsc --noEmit.
- `pnpm exec eslint tests/report-catalog-integration.test.ts`: passed, no findings.
- `pnpm lint`: passed, zero errors and 24 existing warnings outside owned files.
- `pnpm i18n:check`: 9,430 compatible keys per locale passed.
- `python .agentic/scripts/money_inventory.py --write` and
  `node --import tsx .agentic/scripts/verify_money_inventory.mjs`: passed,
  417 columns, 2,444 scanned files and 1,834 consumer hashes.
- `node .agentic/scripts/verify_legacy_money.mjs`: nine checks passed.
- `git diff --check` and controller validation: passed before submission.

Initial combined execution caught an incorrect expected catalog count (754);
corrected it to the source-derived 654 and the complete focused run passed.
An inline Node inspection command lost quotes through Windows argument parsing;
the replacement Python stdin inspection succeeded. Neither failed attempt changed
production behavior. No unresolved task-owned failure remains.

## Review and handoff

See LOC-070-review-1.md for Codex self-review and final static-check outcome.
No full build, dev server, mounted browser, full repository test suite, hosted CI,
deployment, native terminology, statutory or production acceptance is claimed.
Opaque calendar fallback titles, statutory labels, unchanged exports/documents
and current runtime date/numeral formatting have explicit continuing ownership.
LOC-008/002 and full RTL/output/release acceptance remain separate. Commit/push
and remote synchronization are verified after controller closure; stop after
this task and report the next controller selection.
