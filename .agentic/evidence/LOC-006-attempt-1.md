# LOC-006 attempt 1 - combined shell/auth/settings catalog acceptance

## Identity and scope

2026-10-18 (Asia/Tehran), Codex, D:/Projects/dubbl, master.
Entry HEAD: bfbf54e8e7db0063af4247bc304f40e6c996a9c8. Entry tree was clean.
The user requested completing and pushing the next task. Live controller
validate/status/next/context selected LOC-006, the independently ready integration
parent of LOC-010/011/012/013, also depending on LOC-005. Started only LOC-006;
no subagents used. Child completion was not substituted for parent acceptance.

Read root/.agentic instructions, START_HERE, PROJECT/REPOSITORY_MAP, controller,
frontend guidance, source requirement sections, dependency evidence/reviews,
source inventories and current auth/shell/settings/workspace/API/MCP code.
Applied the memory controller skill for bounded scope, verification and push.
DEC-008 excludes dedicated Stripe work; all existing Stripe files and namespaces
are preserved. No build, development server or application database access.

## Implementation and acceptance mapping

1. Combined source ownership and exceptions are recorded in
   [shell/auth/settings acceptance](../registries/SHELL_AUTH_SETTINGS_ACCEPTANCE.md),
   linking the complete auth (eight-file), shared shell (85-file), settings
   (20 in-scope pages plus layout/loading), preference and workspace inventories.
   Child source audits, typed-key checks, populated controls and interpolation
   tests are rerun with the full suite. Technical identities, user content,
   reference/legal names, saved notification/email/template content, browser/
   library messages and later date/number adapters remain explicit exceptions.
2. Added independent combined rendering of AuthLayout with sign-in/sign-up, and
   the ready dashboard shell with settings, teams and notifications in both
   production locales. Real sidebar/topbar/drawer/session/navigation/locale
   contexts compose; hostile session names remain escaped. OrgLoader intentionally
   withholds children during SSR, so the ready contents are composed explicitly;
   no simulated successful organization bootstrap is claimed.
3. Actual production callbacks exercise credential/TOTP branches, safe callback
   destinations, registration JSON/credentials/failures, both invitation token
   types and rejection/success states, and canonical country/currency/legal/
   industry/referral onboarding writes in both locales. New helpers extract and
   transpile actual function bodies with explicit browser/network/state scopes;
   they are callback behavior tests, not mounted browser event tests.
4. Reproduced a rejected sign-in request escaping the handler with loading active.
   Added a catch that shows Auth.signInFailed and resets loading. Credentials,
   provider ID, optional TOTP, invalid-code behavior and safe redirects are
   unchanged. Both catalogs add exactly this one paired key, reaching 2,161.
   JSON comparison after removing this key equals entry HEAD for both catalogs;
   provider namespaces and every other message remain unchanged.
5. New parent PostgreSQL fixture composes persisted locale REST/MCP writes,
   DB-loaded presentation, escaped team fields and the actual team-create callback
   through authenticated REST. SQL separately verifies two exact caller-data team
   rows, denied writes, tenant isolation, unchanged USD/1250 mileage units and
   zero journal writes. Notification REST/MCP list parity, unchanged saved text,
   cross-tenant read denial and null read_at are checked. Locale overrides clear
   through MCP, REST reflects them, and organization defaults resolve independently.
6. Reassessed prior handoffs: LOC-012's period-lock/automation repairs remain
   intact; its combined fixture and the broader locale-preference fixture pass
   afresh. Admin Business/pro subscription copy is assessed and preserved under
   DEC-008. Existing access/read/PEPPOL/inert-delete limits remain inventoried.
   Current source inspection corrects LOC-013's overbroad team/member MCP claim:
   no dedicated team CRUD/member-management tools exist. This pre-existing gap
   is not claimed resolved and no new user operation is introduced.
7. Persian wording remains provisional, including the new sign-in failure text.
   LOC-002 integration, native linguistic/financial review, complete workflows,
   date/number adapters and RTL remain independent. No IRR enablement is claimed.

No REST handler, domain service, MCP registration, authorization, schema,
migration, dependency, stored unit, FX policy or feature flag changes. The money
inventory refresh contains new scanned test paths, two conservative test consumers
and sign-in source/hash/line updates; no classification or financial policy change.

## Actual verification

All commands ran from D:/Projects/dubbl. A newly initialized PostgreSQL18 cluster
used 127.0.0.1:55419 and fixture role dubbl_ci. Explicit TEST_DATABASE_URL selected
that dedicated server; each integration test migrated and dropped its randomized
disposable database. The application database was not accessed. An explicit
pg_database count after the final integration run found zero dubbl_ci_* databases,
then pg_ctl fast shutdown stopped the dedicated server successfully (exit 0).

| Command/check | Actual result |
|---|---|
| Controller validate/status/next/context; start LOC-006 | Exit 0; 247 valid tasks; selected only this integration parent |
| `node --import tsx --test tests/shell-auth-settings-integration.test.ts` | Final focused run exit 0; 5/5 groups passed in both locales |
| `node --import tsx --test --test-concurrency=2 tests/*.test.ts` | Final exit 0; 660 passed, zero failures/skips; 217.123 seconds |
| `node --import tsx --test --test-concurrency=1 tests/integration/shell-auth-settings.test.ts tests/integration/settings-catalog-integration.test.ts tests/integration/locale-preferences.test.ts` | Final exit 0; 3/3 groups passed, zero skipped; 82.331 seconds |
| `pnpm typecheck` | Final exit 0; fumadocs-mdx and tsc --noEmit |
| `pnpm i18n:check` | Final exit 0; 2,161 compatible keys per locale |
| `pnpm lint` | Final exit 0; zero errors, 75 existing warnings |
| `pnpm exec eslint 'app/(auth)/sign-in/page.tsx' tests/shell-auth-settings-integration.test.ts tests/helpers/source-callback.ts tests/integration/shell-auth-settings.test.ts tests/integration/shell-auth-settings-worker.ts` | Final exit 0; no warnings/errors |
| `python .agentic/scripts/money_inventory.py --write` | Exit 0; 417 columns, 2,202 scanned files, 1,646 conservative consumers |
| `node --import tsx .agentic/scripts/verify_money_inventory.mjs` | Exit 0; schema/hash/occurrence verification passed |
| `node .agentic/scripts/verify_legacy_money.mjs` | Exit 0; nine regression checks |
| Catalog JSON/changed-file identity audit against entry HEAD | Exit 0; only Auth.signInFailed added, no Stripe-specific file changed |
| Local registry-link audit and `git diff --check` | Exit 0; 27 existing local links checked before review creation; final evidence links/diff/controller validated before disposition |
| `git fetch origin`; `git rev-list --left-right --count HEAD...origin/master` | Exit 0; 0 ahead/0 behind before commit |

The initial composed test expected a relative redirect while the existing helper
returns an absolute same-origin URL; corrected the test expectation. A deliberate
network-rejection probe then failed before the production catch was added and
passed after it. An early broad run overlapped that key/test edit and loaded the
old message snapshot; it is not counted as final passing verification. The full
suite was restarted after production/test/catalog sources stabilized.

## Review and handoff

See [honest self-review](LOC-006-review-1.md). No browser click/layout/font,
screenshot, successful live login/OAuth, native-language approval, complete RTL,
provider/email delivery, PDF/physical printing, hosted CI, Docker, deployment,
production IRR or full business/security workflow acceptance is claimed.
Dedicated Stripe qualification is excluded by DEC-008.

Finish controller check/submit/self-review/done, stage only reviewed task-owned
files, commit and push origin/master under the user's authorization, verify remote
SHA/clean tree, report the live next task and stop. No other task or LOC-002 parent
is automatically completed by this acceptance.
