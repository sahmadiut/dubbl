# RTL-012 shared dashboard summary/navigation adoption

## Scope and source audit

Six actual production components are assigned to RTL-012: PageHeader, TabLayout, Section, EmptyState, ErrorState and StatCard. Caller strings were rendered without isolation; summary/value layouts imposed intrinsic-width constraints; tab badges used physical left margin and a fixed circle; error messages lacked alert semantics and the retry button had fixed height. Banking account settings independently expose unlabelled technical fields and inherited identifier direction, while accounting/tax, sales/purchases, inventory, payroll, relationships/projects, settings, reports/charts and shared editors have different saved-value/output contracts. These findings justify RTL-010's domain split rather than claiming 276 module files qualified by a shared-widget repair.

The exhaustive 417-file census preserves every path and every other owner, including four frozen provider sources. Its 276 dashboard entries are assigned once each: RTL-012 6, RTL-013 11, RTL-014 31, RTL-015 36, RTL-016 18, RTL-017 27, RTL-018 31, RTL-019 21, RTL-020 36, RTL-021 59. Ownership is responsibility, not qualification. RTL-010/008/002 criteria remain independent and unchecked.

## Implementation and behavior

- Shared BidiText isolates exact mixed caller titles, descriptions, error messages, tab labels/badges, summary values and changes with auto direction and arbitrary-token wrapping. No trimming, parsing, translating, Unicode-marker insertion or canonical string rewriting occurs.
- Page actions can shrink/wrap; Section's content track explicitly has zero minimum; empty/error text is constrained by the available width; stat values and sparklines can wrap onto separate rows. Icons retain their proportions. Chart data point order and values remain identical in RTL.
- Tab links retain canonical href/title/navigation behavior and horizontal overflow; growing badges use logical margin and minimum dimensions instead of a fixed circle. Only the exact current href receives aria-current=page, including overlapping tab paths; detail-page hiding remains unchanged.
- Error text is an alert, fallback/retry names remain catalogued, retry height grows for wrapped labels and the exact callback executes. Decorative summary sparkline is hidden from accessibility APIs while its displayed total remains text.

## Actual verification

- `node --import tsx --test --test-concurrency=1 tests/rtl-dashboard-summaries.test.ts tests/rtl-data-tables.test.ts tests/rtl-bidi-controls.test.ts tests/rtl-root-direction.test.ts tests/rtl-typography.test.ts`: 26/26 pass, exit 0.
- `node --import tsx --test --test-concurrency=1 tests/shell-auth-settings-integration.test.ts tests/dashboard-overview-catalogs.test.ts tests/report-catalog-integration.test.ts tests/settings-integration-catalogs.test.ts tests/rtl-shells.test.ts`: 29/29 pass, exit 0. Actual production consumers retain canonical actions, payloads, report/money behavior and navigation.
- Final `node --import tsx --test --test-concurrency=1 tests/rtl-dashboard-summaries.test.ts`: 5/5 pass after exact-current-path review correction. Four presentations cover en-US/fa-IR with latn/arabext, long mixed strings, escaped user text, exact values/links/callbacks, zero badges, growing badges, detail routes, overlapping routes, and unmirrored chronological chart points. Installed Tailwind emits real zero-minimum tracks, logical margins, wrapping/isolation and intrinsic-height declarations.
- `pnpm typecheck`: exit 0. Scoped ESLint for all six components and the test: exit 0 with no diagnostics; final changed-tab/test ESLint also exit 0. `pnpm lint`: exit 0, zero errors and 20 existing warnings outside task sources.
- `pnpm i18n:check`: exit 0, 10,702 keys in each locale. `node --import tsx --test tests/legacy-money-lint.test.ts`: 1/1 pass. `node --import tsx .agentic/scripts/verify_legacy_money.mjs`: 9 checks pass.
- `python .agentic/scripts/money_inventory.py --write` then `node --import tsx .agentic/scripts/verify_money_inventory.mjs`: exit 0, 417 columns/1,872 consumers. Explicit UTF-8 comparison with HEAD confirms all complete schema column records unchanged; generated differences only record owned consumer/test hashes.
- Exhaustive ownership comparison with HEAD: all 417 unique paths preserved; only the original 276 RTL-010 entries reassigned to children. Other owners/frozen files unchanged. Controller validates 386 tasks; final controller completion and Git whitespace/staged-scope checks precede commit.

Two sandbox test starts returned spawn EPERM before tests executed; required escalation reruns passed. One initial legacy command used a nonexistent filename and was corrected to the actual suite. An audit script initially queried the wrong money JSON key; corrected schema_columns comparison passed. Neither is a product defect or a successful test claim.

## Limits and handoff

Real SSR/provider/event bodies and installed CSS declarations support the bounded semantic/layout repairs. No mounted browser caret/selection/keyboard geometry, computed clipping/zoom/text-spacing, screen-reader/native linguistic/accounting, PDF/print, hosted replacement CI or deployment qualification is claimed. DEC-005 excludes screenshots, not later independent behavior/layout review. No full build/dev server, DB write/schema change, endpoint/MCP change, IRR enablement or dedicated Stripe work occurred. Existing operation contracts are untouched, so no corresponding MCP change is necessary. Supervisor handles the paired push; this agent commits only. Next selected task is determined from the live controller after closure.
