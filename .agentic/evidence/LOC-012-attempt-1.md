# LOC-012 attempt 1 - combined settings catalog acceptance

## Identity and scope

2026-10-18 (Asia/Tehran), coding-assistant, D:/Projects/dubbl, master.
Entry HEAD: 0e8c858b05d91e63bcf633bcdade1fcb619d2d78. Entry tree was clean.
The user requested completing and pushing the next task. Controller
validate/status/next/context selected LOC-012, the independently ready settings
integration parent. Started only LOC-012; no subagents were used.

Read root/.agentic instructions, START_HERE, PROJECT/REPOSITORY_MAP, controller
and frontend guidance, source requirements, all four child reviews, inventories,
current UI/request/error/REST/MCP sources and relevant integration fixtures.
Child completion was not substituted for parent acceptance. DEC-008 applies:
Stripe remains unchanged and is excluded from dedicated work/qualification.

## Implementation and acceptance mapping

1. Audited the 21-page settings tree and supporting layout/loading/components.
   Twenty pages are in scope; Stripe is owner-excluded. Combined rendering now
   nests every in-scope page inside the real settings navigation, router context
   and production PresentationProvider in en-US and fa-IR. Child loaded-control,
   source-extraction and interpolation checks remain in the complete test suite.
   SETTINGS_CATALOG_ACCEPTANCE.md links the full inventories and explicit
   technical, saved-user-data, legal-reference and browser/date/number exceptions.
2. Resolved the period-lock handoff: the general page reads the actual
   `periodLock.lockDate` response, including null, rather than the nonexistent
   `lock` field. Failed HTTP/JSON/shape reads report translated error guidance.
   General organization-load errors now use finite/status/operation fallbacks.
3. Resolved automation handoffs: pipeline deletion copy now describes the real
   live-deal prerequisite, and the exact existing 409 maps to contextual guidance.
   Pipeline/reminder deletions reject failures before refresh/success and keep
   confirmation available for retry; both explicitly translate Cancel. Default
   pipeline, reminder toggle/save and initial list/log requests check HTTP errors
   and suppress success/state adoption on rejection. Network/malformed JSON errors
   use localized operation copy without echoing unknown server prose.
4. Added eight paired error keys in SettingsGeneral, SettingsPipelines,
   SettingsReminders and SettingsErrors; corrected both pipeline deletion
   descriptions. Both production catalogs now have 2,160 compatible keys.
   SettingsStripe and SettingsBilling namespaces compare unchanged to entry HEAD.
   No Stripe-specific file/service/tool/test was modified or dedicated test run.
5. New parent PostgreSQL coverage composes core settings, pipeline/reminder,
   access roles, document templates and notification preferences in one migrated
   tenant through real authenticated REST and linked registered MCP. Separate
   SQL-text assertions verify saved canonical dates, language/currency separation,
   unchanged `1250` mileage/`3000000001` deal cents, literal template tokens,
   soft deletion, denied/cross-tenant operations and no journal creation.
6. Persian wording stays provisional. Registry and task handoff keep native
   linguistic/financial review, RTL and LOC-006/LOC-002 independently open.
   Existing inert organization deletion, duplicate PEPPOL identity, access-page
   fetch limitations and broader MCP gaps are explicitly assessed and inventoried;
   message integration is not full business/security/provider qualification.

No REST route, MCP registration, permission, domain service, schema, migration,
dependency, ledger policy, stored money unit, FX or rollout flag changed.
All fetch calls and JSON.stringify payload constructions in the three modified
pages compare unchanged to entry HEAD using a TypeScript AST audit. Existing
MCP operations remain intact; no new user operation was introduced.

## Actual verification

All commands ran from D:/Projects/dubbl. A new PostgreSQL18 cluster used
127.0.0.1:55418 and fixture role dubbl_ci. Explicit TEST_DATABASE_URL selected
that dedicated server; fixtures created/dropped randomized migrated databases.
No application database was read or mutated. After regression tests, an explicit
pg_database query found zero `dubbl_ci_*` disposable databases; pg_ctl fast
shutdown then stopped the dedicated server successfully (exit 0).

| Command/check | Actual result |
|---|---|
| Controller validate/status/next/context; start LOC-012 | Exit 0; 247 valid tasks; one integration task selected |
| `node --import tsx --test tests/settings-integration-catalogs.test.ts` | Initial 4/5 passed; missing router context in new harness repaired; next 5/5 passed; added loader group also passes in full suite |
| `node --import tsx --test --test-concurrency=2 tests/*.test.ts` | Exit 0; 655 passed, zero failures/skips; 198.912 seconds; includes all six new parent checks and all child suites |
| `node --import tsx --test tests/integration/settings-catalog-integration.test.ts` | Exit 0; new combined REST/MCP/SQL group passed |
| `node --import tsx --test --test-concurrency=1 tests/integration/locale-preferences.test.ts tests/integration/organization-settings.test.ts tests/integration/procurement-settings.test.ts` | Exit 0; 3/3 regression groups passed |
| `pnpm typecheck` | Exit 0; fumadocs-mdx and tsc --noEmit |
| `npx tsc --noEmit` after final test files | Exit 0 |
| `pnpm lint` | Exit 0; zero errors, 75 existing warnings |
| Changed-file ESLint over all eight changed/new TS/TSX files | Exit 0; zero warnings/errors |
| `pnpm i18n:check` | Exit 0; 2,160 compatible keys per locale |
| `python .agentic/scripts/money_inventory.py --write` | Exit 0; 417 columns, 1,644 consumer files; source/hash/occurrence refresh only |
| `node --import tsx .agentic/scripts/verify_money_inventory.mjs` | Exit 0; schema/hash/occurrence checks passed |
| `node .agentic/scripts/verify_legacy_money.mjs` | Exit 0; nine regression checks |
| Ad hoc TypeScript AST comparison to entry HEAD | Exit 0; all fetch and JSON payload-construction calls unchanged in three modified pages |
| Provider catalog identity/local registry link audit | Exit 0; existing provider namespaces unchanged; 27 local links checked before evidence creation |
| `git diff --check`; controller validation | Exit 0 before disposition; repeated for final state |
| `git fetch origin`; `git rev-list --left-right --count HEAD...origin/master` | Exit 0; 0 ahead/0 behind before commit |

The initial combined-render failure was test setup, not product behavior: the
API-key page needs AppRouterContext. Added the same explicit router context used
by the existing access suite. No failed attempt is counted as a passing check.
Tests use constrained concurrency; no build or development server was run.

## Review and handoff

See [honest self-review](LOC-012-review-1.md) and
[combined inventory/limits](../registries/SETTINGS_CATALOG_ACCEPTANCE.md).
No browser click/layout/font, screenshot, native-language approval, full RTL,
live provider, document/PDF/physical-printer, hosted CI, Docker, deployment or
production IRR acceptance is claimed. Dedicated Stripe qualification is excluded.

Finish controller check/submit/self-review/done, commit only the reviewed
task-owned files, push origin/master under the user's explicit authorization,
verify remote SHA/clean tree, report the next task and stop. No parent is
automatically completed by LOC-012 acceptance.
