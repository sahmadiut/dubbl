# LOC-133 dashboard currency units

## Scope and root cause

Owner report: the Persian dashboard still displayed IRR instead of ریال.
The dashboard overview and forecast passed no presentation to money helpers,
so their compatible default remained English. This child adopts active provider
presentation across its actual callers; it does not complete LOC-132/LOC-115.

Changed production files:

- `app/(dashboard)/dashboard/page.tsx`: overview/stat cards, income/expense
  breakdown, aging totals/buckets, budget/action alerts and recent-entry column.
- `components/dashboard/cash-flow-widget.tsx`: summary values, exact tooltip
  values and approximate compact axis currency parts.
- `lib/money/core-presentation.ts`: optional presentation argument for grouped
  debits. Existing English defaults and unlike-currency separation remain.

Budget alerts keep explicit fixed-two decimals through budgetDecimal; IRR's
ordinary minor-unit scale is unchanged. The chart alone uses approximate geometry;
its tooltip and summaries retain original integers. No REST/MCP/schema, stored
amount, filter, organization header, ISO query, export/output or Stripe changes.
No new business operation requires a new MCP tool. Existing canonical tools stay
unchanged. The external USD currency-name edit was preserved; before this task's
commit an external actor committed it separately as
`844bec1297965ea59c9608d4b4226658aaf97d1b`. It is not part of this task's diff.

## Controller boundary

Created owner-prioritized LOC-133 and used supported `split LOC-132 --children
LOC-133` workflow. Inspection proved the dashboard uses the completed LOC-129/130
helpers independently of LOC-131's domain-page adoption. LOC-132 retains both
LOC-131 and LOC-133 dependencies and all broader scope/independent acceptance.

## Actual verification

All commands executed in D:/Projects/dubbl:

- `node --import tsx --test --test-concurrency=1 tests/dashboard-overview-catalogs.test.ts tests/dashboard-document-catalog-integration.test.ts`: exit 0, 10/10 pass, 9.9 seconds. Real production JSX under PresentationProvider/next-intl verifies literal Persian ریال in overview/aging/expense/budget/alert and journal display, signed subunits/large exact values, fixed-two budget semantics, forecast totals/axis/tooltip, escaping, English behavior, canonical IRR selection/query and org headers. Existing composition coverage includes actual activity/forecast and unchanged document controls.
- `node --import tsx --test --test-concurrency=1 tests/contact-dashboard-ui.test.ts tests/core-presentation-money.test.ts`: exit 0, 11/11 pass, 0.93 seconds. Exact aliases, scales, signed totals, grouping, financial wire validation, failed responses and tooltip geometry boundaries remain intact.
- An initial combined exploratory run stopped without a complete summary; it is not counted as a pass. The two completed commands above supersede it. No full-suite pass is claimed.
- `pnpm typecheck`: exit 0, fumadocs generation and tsc --noEmit pass.
- `pnpm exec eslint 'app/(dashboard)/dashboard/page.tsx' components/dashboard/cash-flow-widget.tsx lib/money/core-presentation.ts tests/dashboard-overview-catalogs.test.ts tests/dashboard-document-catalog-integration.test.ts`: exit 0, no warnings/errors.
- `pnpm lint`: exit 0, 20 pre-existing warnings, no errors; none in task-owned files.
- `pnpm i18n:check`: exit 0, 10,702 paired keys per locale.
- `python .agentic/scripts/money_inventory.py --write` and `node --import tsx .agentic/scripts/verify_money_inventory.mjs`: exit 0; 417 columns, 2,478 scanned files, 1,859 consumer hashes, 36,792 occurrences. UTF-8-correct JSON comparison to HEAD confirms all 417 schema-column records unchanged; only consumer hashes/locations refresh.
- `node .agentic/scripts/verify_legacy_money.mjs`: exit 0, nine legacy checks pass.
- `python .agentic/agent.py validate`: 365 structurally valid tasks. Structural validity does not prove implementation by itself.
- `git diff --check`: exit 0.

## Browser verification and limits

Read the computer-use skill before browser inspection. Port 3000 had an existing
listening server, which was left untouched. Computer-use inventory returned no
enabled apps or browsers. Explicit attempt to open the existing dashboard via
IAB returned `Browser is not available: iab`. Mounted browser verification was
therefore unavailable; actual provider-render and callback tests passed instead.
No server was started, no build run, no database operation performed, and no
mounted/hydration/browser/RTL, native-language, hosted-CI or production financial
qualification is claimed. IRR activation flags remain unchanged.

## Handoff

The supervisor handles the two-commit push after this task's local commit.
LOC-131 remains the next controller task; remaining LOC-132 and independent
LOC-115 acceptance remain open. Self-review is attributed honestly.
