# LOC-001 attempt 1: locale preferences without URL changes

## Identity

2026-10-17 (Asia/Tehran), coding-assistant. Entry HEAD `27bda370`, branch master,
clean tree. Selected LOC-001 from live controller validate/status/next and claimed
it with `start LOC-001 --owner coding-assistant`. Read root/.agentic instructions,
START_HERE, CONTROLLER, PROJECT, REPOSITORY_MAP, frontend role, plan locale/config
sections, CI-002 attempt-1 and MON-010 review-3 dependency evidence. This evidence
describes the uncommitted task diff; it does not invent a final commit SHA.

## Implementation

- Added next-intl 4.14.9 (peer-compatible with installed Next 16.1.6/React 19) and
  its plugin around the existing MDX configuration. Retained routes, standalone
  output and auth proxy/configuration. The official
  [App Router setup](https://next-intl.dev/docs/getting-started/app-router) and
  [request configuration](https://next-intl.dev/docs/usage/configuration) were
  checked for supported request/user-setting locale resolution.
- `i18n/locale.ts` validates exact persisted locale tags, negotiates supported
  Accept-Language ranges with quality/order, and resolves user, org, cookie,
  header, English fallback. Invalid values fall through individually. Language
  never infers currency or timezone. UTC is the deterministic timezone fallback;
  calendar and numerals have separate nullable overrides.
- `i18n/server.ts` caches per request. The root document language, next-intl
  request configuration and explicit client provider share resolved locale and
  timezone, catalogs and request `now`. A separate client context carries numeral
  and calendar preferences for subsequent adapter tasks.
- Added nullable user language/time_zone/numerals/calendar and organization
  default_language columns. Ran `pnpm exec drizzle-kit generate`, producing
  `0013_shiny_harry_osborn.sql`, its snapshot and journal entry. The SQL contains
  only five additive nullable text columns. No amounts, dates or existing rows
  are rewritten.
- `GET/PATCH /api/v1/user/locale-preferences` and registered
  `get_locale_preferences`/`update_locale_preferences` share the direct DB service.
  Writes are strict nonempty partial objects, allow null reset, reject unknown
  keys, address only the authenticated user and require current live org membership.
  Update/audit are atomic. Organization defaultLanguage uses existing strict
  organization REST/MCP schema, manage:billing and audited service.
- Settings exposes personal preferences and organization default. Initial en-US
  and fa-IR catalogs contain this feature's messages. Existing English screens
  are retained; broad extraction/translation, adapter adoption and RTL remain
  later tasks. No native linguistic approval is claimed.
- A shared browser helper preserves activeOrgId localStorage and mirrors it to
  a scoped cookie. Server code validates UUID, membership and live org before
  reading its default. With no selection, a single live membership is unambiguous;
  multiple memberships wait for selection. Anonymous/foreign/deleted org cookies
  do not expose tenant defaults. OrgLoader migrates existing selection once and
  avoids a loop when cookies are blocked.
- Preference saves, org changes and successful auth/invitation transitions
  reload the document so root layout cannot retain a guest/previous-org locale.
  Same-origin callback path/query/hash behavior is preserved without prefixes;
  invalid/external callbacks fall back to /dashboard.
- Refreshed money source hashes/line references after schema/source additions;
  all 417 numeric/JSON column classifications remain the same. See
  [locale contracts](../registries/LOCALE_PREFERENCES.md).

## Acceptance mapping

1. Existing URLs/auth redirects/English compatibility: unchanged route tree,
   auth configuration and proxy, MDX plugin retained; callback tests preserve
   existing paths and queries. Organization integration regression passes.
   New locale preferences are opt-in/null by default; unsupported requests fall
   back to en-US. Initial feature catalog key parity/rendering is tested.
2. Precedence/invalid values: seven pure/provider tests plus migrated REST/MCP/SQL
   fixture exercise each precedence level, invalid saved values/cookies/headers,
   q weights, null clearing, strict writes, cross-tenant input, permissions,
   invalid JSON, membership revocation and selected/sole/multiple memberships.
3. Server/client agreement: real server resolution with stubbed Next request and
   session accessors is exercised against PostgreSQL. Provider serialization and
   equivalent server/client renders are compared for both languages and UTC,
   America/Los_Angeles and Asia/Tokyo. An additional focused run under
   TZ=Pacific/Honolulu passes. Locale/timezone/messages/now are explicit, with no
   browser timezone discovery or Tehran assumption. This is deterministic render
   contract coverage; live-browser hydration/layout was not executed.

## Verification

All commands from D:/Projects/dubbl. PostgreSQL 18 was initialized in a unique
temporary directory, bound only to 127.0.0.1:55477. Explicit TEST_DATABASE_URL
targets that disposable server; withDatabase creates/drops randomized databases.
Application .env/DATABASE_URL target was not used for fixture writes.

| Command | Actual result |
|---|---|
| `pnpm add next-intl` | Exit 0; pnpm-lock updated; installed peer range includes Next 16/React 19 |
| `pnpm exec drizzle-kit generate` | Exit 0; five nullable text columns only |
| `pnpm test` final | Exit 0; 565 passed, zero failed/skipped |
| `node --import tsx --test tests/locale.test.ts` with TZ=Pacific/Honolulu | Exit 0; 7 passed |
| `node --import tsx --test tests/integration/locale-preferences.test.ts tests/integration/organization-settings.test.ts` with explicit loopback TEST_DATABASE_URL | Exit 0; 2 passed, zero skipped |
| `node --import tsx --test tests/integration/locale-preferences.test.ts` after sole-membership refinement | Exit 0; 1 passed |
| `pnpm typecheck` final, after sole-membership refinement | Exit 0; fumadocs-mdx and tsc --noEmit |
| `pnpm lint` final | Exit 0; zero errors, 81 existing warnings |
| Changed-file ESLint over implementation/tests | Exit 0 after test fix; six existing warnings in Settings/onboarding; new code has none |
| `pnpm exec eslint lib/api/locale-preferences.ts tests/integration/locale-preferences-worker.ts tests/locale.test.ts` after final service refinement | Exit 0 |
| `python .agentic/scripts/money_inventory.py --write` | Exit 0; 417 columns, 1599 conservative consumer files |
| `node --import tsx .agentic/scripts/verify_money_inventory.mjs` | Exit 0; schema classifications/hashes/occurrence lines verified |
| `node --import tsx .agentic/scripts/verify_legacy_money.mjs` | Exit 0; nine regression checks |
| `python .agentic/agent.py validate` | Exit 0; 218 valid tasks before final disposition |
| `git diff --check` | Exit 0 |
| Local Markdown target check across task/evidence/contracts | Exit 0; 14 targets exist |
| `git fetch origin master` and pre-commit divergence check | Exit 0; local HEAD and origin/master initially equal |

Initial fixture attempts failed because of an incorrect historical migration tag
and JSON parsing of SDK-level MCP validation text; corrected the fixture to the
actual 0012_currency_regimes checkpoint and support structured/SDK errors, then
reran successfully. Initial lint found two new createElement children-prop errors;
corrected to conventional child arguments and reran successfully. A package-lock
refresh was inspected and discarded because it rewrote unrelated historical
dependencies; pnpm is the declared and CI-used installer. package-lock has no
content change in this task.

No full build, dev server, Docker, application/production migration, hosted CI,
browser/JWT login or visual-layout verification was run. No deployment or native
Persian terminology review is claimed. Apply the additive migration before running
the changed application against an existing database.

## Review and handoff

Same implementing coding-assistant performed the source/diff self-review; see
[review record](LOC-001-review-1.md). No independent/human approval is claimed.
Final controller disposition and scoped commit/push follow verified evidence.
The next task must be queried from the controller after completion; do not start
catalog extraction or adapter/RTL work in this delivery.
