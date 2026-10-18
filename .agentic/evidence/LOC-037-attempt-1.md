# LOC-037 attempt 1 - budget catalogs

Date: 2026-10-18 (Asia/Tehran). Implementer: Codex. Repository: D:/Projects/dubbl.
Controller validate/status/next selected LOC-037 on master; entry tree was clean.
This evidence describes the verified working tree before scoped commit/push.

## Acceptance mapping

1. Added 145 paired `Budgets` messages (4,015 keys per locale). List, detail
   layout/overview/settings and BudgetDrawer use catalogs, including generated
   period labels, whole variance/count sentences, rich amount summaries, chart
   labels, accessible amount/remove controls, confirmations and failures. See
   [scope and exceptions](../registries/BUDGET_CATALOGS.md). Persian is provisional.
2. Real production JSX renders through PresentationProvider in both locales.
   Tests execute production create/save/delete/toggle callbacks, check routes,
   methods, organization headers, Gregorian dates, period enums, unchanged saved
   labels and exact Minor strings at 4,000,000,000,000,001 minor units. Tests cover
   failed writes, cancellation before onConfirm, draft syntax/range validation,
   missing organization, escaping caller data, chart tooltip identity, HTTP
   auth/validation/unknown errors, malformed JSON and corrupt monetary aliases.
   Existing budgetJson/budgetLinesInput keep exact-money validation and wire
   behavior. Delete/toggle errors retain confirmation and cannot announce success;
   missing org no longer leaves budget creation in saving state.
3. Registry and task handoff record native terminology, RTL and independent
   LOC-024/007/002 acceptance. Existing namespaces and sibling drawer bodies were
   compared against HEAD and are identical. No REST/MCP/service/schema/migration
   or shared money adapter changes; existing org-scoped budget tools cover all
   unchanged operations. Stripe remains unchanged. See honest
   [self-review](LOC-037-review-1.md).

## Verification

All commands ran at repository root. PostgreSQL 18 was initialized in a unique
OS temporary directory with trust auth, bound to 127.0.0.1:55437 and explicit
TEST_DATABASE_URL. Fixtures created/dropped randomized databases. The temporary
cluster was stopped after tests. No application database was used.

| Check | Actual result |
|---|---|
| Focused budget catalog/money/wire/report suite | 22/22 passed; no skips |
| Full unit/static suite, concurrency 4 | 795/795 passed; no skips; 67.606 seconds at verification checkpoint |
| Budget CRUD, report and combined UI REST/MCP/SQL integrations | 3/3 passed; no skips; 36.167 seconds |
| pnpm typecheck | Exit 0; fumadocs-mdx and tsc --noEmit |
| pnpm i18n:check | Exit 0; 4,015 compatible keys per locale |
| Changed-file ESLint | Exit 0; no errors or warnings |
| Full pnpm lint | Exit 0; zero errors, 72 existing warnings outside owned sources |
| Money inventory generation and verifier | Exit 0; 417 columns, 2,231 scanned files, 1,673 consumer hashes and all occurrence/source lines |
| Legacy money gate | Exit 0; nine regression checks |
| Source/catalog ownership audit | Existing namespaces and sibling drawer bodies unchanged; no authored JSX copy/display attributes outside declared exceptions; Persian script audit with placeholder-only monthLabel exception |
| Pre-commit fetch/divergence | master and origin/master 0 ahead / 0 behind |
| Controller validation and git diff --check | Exit 0 |

Commands:

```text
node --import tsx --test --test-concurrency=2 tests/budget-catalogs.test.ts tests/budget-project-crm-ui.test.ts tests/budget-wire.test.ts tests/budget-report-wire.test.ts
node --import tsx --test --test-concurrency=4 tests/*.test.ts
node --import tsx --test --test-concurrency=1 tests/integration/budget-wire.test.ts tests/integration/budget-report.test.ts tests/integration/budget-project-crm-ui.test.ts
pnpm typecheck
pnpm i18n:check
node node_modules/eslint/bin/eslint.js <owned TS/TSX paths>
pnpm lint
python .agentic/scripts/money_inventory.py --write
node --import tsx .agentic/scripts/verify_money_inventory.mjs
node .agentic/scripts/verify_legacy_money.mjs
python .agentic/agent.py validate
git diff --check
```

Intermediate checks found and corrected a broad identifier replacement,
test fixture objects containing report-only bigint fields, test DatePicker
module context, chart-stub TypeScript typing, remaining grand-total/spent copy,
and an unapproved rich tag (changed to the existing approved strong tag).
The Persian source audit explicitly permits the placeholder-only month template.
Final focused tests/catalog validation/typecheck/changed-file lint passed.

## Limits and handoff

No full build, dev server, mounted browser test, hosted CI wait, deployment or
production qualification ran. Rendering controls hooks and inlines portals/chart
shells; callbacks are not interactive browser acceptance. Persian/native and RTL
qualification and independent LOC-024/007/002 acceptance remain open. Review is
self-review, not peer/human approval. Finish scoped commit and authorized push,
then verify remote SHA and clean tree separately and report the next task.
