# LOC-117 attempt 1 - 2026-10-23

Operator: Codex. Base: 203d10e84c3c64e35143b5383d1ca8cdbee1f0df.

Implemented 99 paired DashboardOverview messages in the dashboard page and cash
forecast widget. Covers greetings, onboarding, accessible dismissal, table/status
labels, five validated aging positions, alerts, summary/KPI labels, periods,
legend and tooltip series labels. Finite error keys translate at render time.
Exact bigint payload lookup keys, chart data keys, amounts, routes, organization
headers, drawer actions and onboarding PATCH remain unchanged. Removed three
already-unused imports from the touched widget.

Audited the loading route, BrandLoader, ActivityFeed and ErrorState: these already
use SharedUI, JournalActivity and SettingsAudit. Explicit formatting/data exceptions
and native/RTL/parent handoff are in registries/DASHBOARD_OVERVIEW_CATALOGS.md.
Inspected existing get_dashboard_alerts and cash_flow_forecast MCP tools; this
presentation extraction changes no REST/MCP operation, schema, permission or Stripe
file. No application database or fixture needed or touched.

Verification:
- `node --import tsx --test tests/dashboard-overview-catalogs.test.ts tests/message-catalogs.test.ts tests/contact-dashboard-ui.test.ts`: 23 passed. Four new production JSX/callback tests cover real next-intl/PresentationProvider in both locales, escaped caller content, status/aging/alert labels, exact KWD/JPY displays and tooltip carriers, navigation/drawer callbacks, period/currency controls, forecast HTTP/JSON/invalid-money/network failures and onboarding PATCH headers/body.
- Persian-script assertions caught shell-pipe encoding damage; rewrote using a UTF-8-safe file path and confirmed every Persian value contains Persian script. ICU validation also caught a missing plural placeholder before correction.
- `pnpm i18n:check`: 9536 paired keys passed.
- `pnpm typecheck`: passed after tightening greeting/error/bucket keys and const test key arrays.
- Changed-file ESLint: passed, zero warnings/errors.
- `python .agentic/scripts/money_inventory.py --write`, then verification without --write and `node --import tsx .agentic/scripts/verify_money_inventory.mjs`: passed; 417 columns, 1836 consumers. Refresh also indexes the already-committed LOC-116 test omitted from the prior inventory snapshot.
- `node --import tsx .agentic/scripts/verify_legacy_money.mjs`: nine checks passed.
- Controller validation and `git diff --check`: passed before submission; rerun at completion.

Full-repository lint result is recorded in the review evidence after completion.
No build, dev server, browser workflow, hosted-CI or deployment run. Persian wording
remains provisional. Native linguistic/RTL/calendar/numeral qualification and
LOC-071 combined acceptance remain independent. LOC-118/119 retain document
workspace/send-controls ownership.

Acceptance mapping: criterion 1 uses paired catalogs, production components and
exception registry; criterion 2 uses rendering/callback/adapter/catalog/static
checks; criterion 3 uses the registry and task handoff.
