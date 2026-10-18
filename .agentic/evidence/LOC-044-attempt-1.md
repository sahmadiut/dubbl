# LOC-044 attempt 1 - customer prepayment catalogs

## Identity and scope

2026-10-18 (Asia/Tehran), Codex, D:/Projects/dubbl, master.
Entry HEAD: 52f56eef030c0faef70c3ed873795e40e825b5c3. Entry tree was clean.
The user requested completing and pushing the next task. Live controller
validate/status/next/context selected LOC-044. Started only this bounded child
of LOC-025; parent LOC-025/007/002 acceptance remains independent.

Read root/.agentic instructions, controller, project/repository map, frontend
guidance, selected/parent scope and catalog registry, LOC-006 dependency evidence,
the Farsi strategy/configuration source sections, actual prepayment routes,
creation form, balance cards, financial helpers and REST/MCP services/tests.
Applied the memory controller skill for task ownership, verification and push.
No subagents, full build, dev server, application DB access or Stripe work.

## Implementation and acceptance mapping

1. Added 103 paired CustomerPrepayments messages (4,755 compatible keys per
   locale), covering owned list/detail/form/cards, finite status/source display,
   guidance, controls, failure outcomes and ICU count. The source/search memo
   responds to locale changes. Status/source own-key checks preserve unknown
   and prototype-like values as escaped data. See the complete
   [scope and exceptions](../registries/CUSTOMER_PREPAYMENT_CATALOGS.md).
2. Read/currency failures store stable message codes and translate at render
   time; locale changes do not cause data-fetch effects. Unknown server/parser
   prose is replaced by reviewed catalog fallbacks. A malformed created identity
   cannot trigger success/close/navigation. A successful application with
   unreadable JSON/balance aliases clears the usable balance, closes the dialog
   and requires a reload without a success toast.
3. Added production-syntax rendering/callback tests with real React, next-intl,
   PresentationProvider, table/date controls, balance cards and financial helpers.
   Both locales cover guidance, populated controls, localized source search,
   ICU counts, Persian script, safe hostile data and unknown statuses/sources,
   exact multi-currency summaries and balance subtraction, canonical creation/
   application payloads, HTTP/network/JSON/shape/alias failures, cancelled reads,
   stale pagination, currency resolution and same-customer/currency eligibility.
   A JSX/display-attribute audit checks extraction. State/navigation/portal and
   out-of-slice picker boundaries are controlled; this is not mounted browser QA.
4. Existing UI-money card rendering now uses PresentationProvider. Financial
   helpers, services, REST/MCP routes, schema, migrations, FX and IRR flags are
   unchanged. Existing disposable REST/MCP/SQL tests verify monetary persistence,
   ledger effects and isolation. Prior namespaces and every other drawer equal
   entry HEAD. Money inventory schema classifications remain identical; only
   eight owned consumers and two new scanned source paths are refreshed.
5. Recorded source ownership, explicit caller-data/illustration/shared-component
   exceptions, existing MCP coverage and independent parent/native/RTL handoff.
   Persian wording remains provisional; catalog parity is not native acceptance.

## Actual verification

All commands ran in D:/Projects/dubbl. Integration tests used PostgreSQL 18 in a
fresh random temporary cluster, trust authentication bound only to 127.0.0.1 on
an allocated port, with explicit TEST_DATABASE_URL. Fixtures migrated and dropped
random dubbl_ci_* databases. Cleanup query returned zero fixture databases and
pg_ctl stopped the server in finally. This is not PostgreSQL 16/production QA.
The stopped cluster files remain in the OS temporary directory. Automatic review
rejected the original command containing recursive directory cleanup with only
"blocked by policy" as its reason; the successful safer command omitted file
deletion. No approval was requested and no application database was accessed.

| Check | Actual result |
|---|---|
| Focused catalog/UI-money/wire | Exit 0; 19/19 passed, no skips; 24.308 seconds |
| Full unit/static suite, concurrency 2 | Exit 0; 856/856 passed, no skips; 383.953 seconds |
| Credit lifecycle and prepayment UI-money REST/MCP/SQL | Exit 0; 2/2 groups passed, no skips; 55.583 seconds |
| pnpm typecheck | Exit 0 |
| pnpm i18n:check | Exit 0; 4,755 compatible keys per locale |
| Changed-file ESLint | Exit 0; zero errors/warnings |
| pnpm lint | Exit 0; zero errors, 69 existing unrelated warnings |
| Money inventory generation/verification | Exit 0; 417 columns, 2,244 scanned files, 1,682 consumer hashes and occurrence/source lines verified |
| Legacy money gate | Exit 0; nine regression checks passed |
| Ownership/source audit | Exit 0; 103 paired messages, Persian script, earlier namespaces and all other drawers unchanged |
| Inventory diff audit | Exit 0; schema classifications unchanged; eight owned consumers and two source additions |
| Controller validation | Exit 0; valid 292-task graph |
| Fetch/divergence before commit | Exit 0; HEAD versus origin/master 0 ahead/0 behind |
| git diff --check | Exit 0 |

```text
node --import tsx --test tests/customer-prepayment-catalogs.test.ts tests/customer-prepayment-ui-money.test.ts tests/credit-wire.test.ts
node --import tsx --test --test-concurrency=2 tests/*.test.ts
node --import tsx --test --test-concurrency=1 tests/integration/credits.test.ts tests/integration/customer-prepayment-ui-money.test.ts
pnpm typecheck
pnpm i18n:check
pnpm exec eslint <two prepayment pages> components/dashboard/create-drawer.tsx components/dashboard/customer-prepayment-money-details.tsx i18n/customer-prepayment-presentation.ts tests/customer-prepayment-catalogs.test.ts tests/customer-prepayment-ui-money.test.ts
pnpm lint
python .agentic/scripts/money_inventory.py --write
node --import tsx .agentic/scripts/verify_money_inventory.mjs
node .agentic/scripts/verify_legacy_money.mjs
python .agentic/agent.py validate
git fetch --quiet origin
git rev-list --left-right --count HEAD...origin/master
git diff --check
```

The exploratory inventory comparison omitted the two catalog consumers from its
expected set; adding those task-owned catalogs passed without product changes.
No product test failure was observed in focused or integration verification.

## Review and handoff

Final self-review is recorded in [review evidence](LOC-044-review-1.md).
No unresolved finding blocks this bounded catalog task. Registry links and final
diff checks pass; all three criteria have implementation and verification evidence.
Native terminology, RTL/browser, date/numeral adapters, shared forms, independent
LOC-025/007/002 acceptance, hosted CI, deployment/provider and production IRR
qualification remain open. Finish controller disposition, task-owned commit/push
and remote SHA/clean-tree checks;
report the next task and stop.
