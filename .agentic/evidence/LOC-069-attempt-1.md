# LOC-069 attempt 1 - combined CRM catalog acceptance

## Identity and scope

2026-10-21 (Asia/Tehran), Codex, D:/Projects/dubbl, master. Initial HEAD
14c21760; clean entry tree. Owner requested one next task completed and pushed.
Controller selected and started LOC-069 after LOC-099..102 were done.

Read the current task/parent scopes, controller and frontend guidance, message
contract, four child scope registries, current production CRM source,
presentation/read helpers, child tests, prior project-parent acceptance pattern,
CRM service/registered tools and migrated integration workers. Earlier child
evidence remains historical and unchanged; this is independent parent acceptance.

## Acceptance mapping

1. Reconciled all seven CRM route TSX components and DealDrawer against four
   namespaces with 224 paired messages; 8,775 compatible leaves per locale.
   Every CRM Persian message contains Persian script. The
   [combined registry](../registries/CRM_CATALOG_ACCEPTANCE.md) maps complete
   ownership and caller/machine/symbol/shared-control/compatibility/output
   exceptions. The source audit found no additional product/catalog change
   needed. Wording remains provisional pending native terminology review.
2. Added six combined tests using real production layout/DealContext, sibling
   page JSX and next-intl/PresentationProvider, along with independent namespace
   and AST source checks. Reran current child rendering/behavior suites and
   actual migrated REST/linked MCP/independent SQL fixtures. Fixed-two cents,
   canonical Minor aliases, safe maxima, date/quantity semantics, organization
   isolation, authorization, history and machine contracts remain unchanged.
3. This attempt, separate honest Codex self-review, task handoff and combined
   ownership registry retain independent LOC-008/002/native/RTL/adjacent output
   and release qualification. No peer/human/native approval is implied.

## What the combined tests establish

`tests/crm-catalog-integration.test.ts` passes one checked detail response and
checked activity feed through the actual layout and shared DealContext into
overview, activity and settings in both locales. It checks every canonical tab
destination and active-tab class, escaped caller content, shared exact value,
bigint weighted cents and Gregorian date input. Every sibling is hidden behind
unavailable or previous-route state. The previous-route case retains the existing
loader behavior; a failed refresh may retain already verified same-route data.

Checked pipeline list, detail and analytics responses compose under one
PresentationProvider across USD/JPY/KWD labels, retaining identical maximum safe
fixed-two cents. The actual activity-page handler invokes the actual layout
creation callback: successful checked creation alone clears the draft and
refreshes; HTTP/foreign-identity failure retains the draft and avoids refresh.
Creation success and refresh failure produce distinct translated feedback.
Request organization headers, content type, JSON body and feed query are asserted.

The AST audit pins all seven components, DealDrawer and shared footer/section
ownership, rejecting authored JSX/display-attribute/toast/document-title literals
and imports of the removed untranslated timeAgo helper. Current child suites
cover forms/options/confirmation, pagination, cleanup/races, read/mutation
rejection, exact aliases and counts, stage/won/lost, dates and analytics. Tests
control hooks/IO/motion/portal boundaries; they are not mounted-browser tests.

Existing registered CRM tools cover all 16 operations through AuthContext and
wrapTool with shared services/direct DB access. Current migrated fixtures retain
real REST/MCP operation and envelope differences plus SQL-text, scope/auth,
currency isolation, lifecycle, audit, retry/history and rollback checks. No new
MCP/REST contract is introduced by this acceptance.

Only the new combined test, its generated money inventory entry, registries,
task handoff and unique evidence/review files change. All existing consumer
entries and 417 schema classifications match entry HEAD. No product/catalog,
service/API/tool/auth, schema/migration, ledger, currency/IRR flag or Stripe
source changed.

## Actual verification

Commands ran from D:/Projects/dubbl using installed dependencies. No full build
or dev server ran. No skips in the reported passing tests.

| Check | Observed result |
|---|---|
| node --import tsx --test tests/crm-catalog-integration.test.ts | Final 6/6 pass, 3.007 seconds |
| node --import tsx --test --test-concurrency=1 tests/crm-catalog-integration.test.ts tests/crm-analytics-catalogs.test.ts tests/crm-activity-catalogs.test.ts tests/crm-detail-catalogs.test.ts tests/crm-pipeline-catalogs.test.ts tests/budget-project-crm-ui.test.ts tests/crm-wire.test.ts tests/message-catalogs.test.ts tests/locale.test.ts | Final 65/65 pass, 25.531 seconds |
| Explicit loopback TEST_DATABASE_URL and PG_BIN; node --import tsx --test --test-concurrency=1 tests/integration/crm.test.ts tests/integration/budget-project-crm-ui.test.ts | 2/2 pass, 25.368 seconds |
| pnpm typecheck | Pass twice, including final combined callback test; fumadocs-mdx and tsc --noEmit |
| pnpm i18n:check | Pass; 8,775 compatible keys per locale |
| pnpm exec eslint tests/crm-catalog-integration.test.ts | Final pass, no findings |
| pnpm lint | Pass, zero errors and 24 existing warnings outside owned changes |
| python .agentic/scripts/money_inventory.py --write; node --import tsx .agentic/scripts/verify_money_inventory.mjs | Pass; 417 columns, 2,428 scanned files, 1,819 checked consumers |
| node .agentic/scripts/verify_legacy_money.mjs | Nine regression checks pass |
| Compare inventory with HEAD | All old consumers/schema classifications unchanged; only combined test consumer added |
| Relative Markdown links in owned task/evidence/registries | 125 resolve |
| python .agentic/agent.py validate; git diff --check | Pass; repeated at closure |

Database checks used process-scoped TEST_DATABASE_URL/PG_BIN and a unique
OS-temp PostgreSQL 18 cluster on loopback 127.0.0.1:6473, trust auth and
max_locks_per_transaction=256. Fixtures created/migrated/dropped randomized
dubbl_ci_* databases. The final admin query returned zero fixture databases;
pg_ctl stopped the cluster. Application .env/database credentials were unused.

The initial five-test combined suite passed; a sixth shared-callback composition
case was then added and the final complete focused suite/typecheck/lint passed.
No product regression or failing test was hidden by this acceptance.

## Review and handoff

See [Codex self-review](LOC-069-review-1.md). This accepts LOC-069 alone.
LOC-008/002, native terminology, full RTL/calendar/numerals, browser/keyboard,
adjacent output, hosted CI, provider, deployment and production/IRR qualification
remain independent. Full unit/integration suites were not run; task-appropriate
focused checks above passed. Commit/push and live remote parity follow controller
closure and scoped staging; this evidence does not claim a hosted CI result.
