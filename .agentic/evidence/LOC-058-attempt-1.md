# LOC-058 attempt 1

2026-10-19 (Asia/Tehran), Codex. Completed one controller-selected child:
contact list, picker and ContactDrawer catalogs. Initial working tree was clean.
The owner requested completion and commit; no push is authorized by this turn.

## Implementation and acceptance

- Added 86 paired `Contacts` messages (5,874 keys per locale), covering all owned
  copy, ICU loaded-row counts, fields/actions, confirmations, busy states and
  operation failures. See [scope and explicit exceptions](../registries/CONTACT_LIST_CATALOGS.md).
  Persian wording is provisional. Existing catalog namespaces compare equal to
  HEAD after excluding the new namespace, including Stripe.
- Actual production templates render through React/next-intl/PresentationProvider
  in both locales with controlled hooks/navigation/portal boundaries. Actual
  callback bodies verify exact paths, org headers, filter/sort/date/pagination
  values, selected IDs, creation optional nulls/defaults/navigation, cancellation,
  HTTP/JSON/envelope/network failures and exact aliases/bigint display through
  9007199254740991 minor units. Source audit covers all owned JSX/display
  attributes with enumerated technical exceptions; Persian script and plural
  0/1/2 checks pass. These are not mounted-browser tests.
- Failed delete requests no longer remove a row/report success; translated
  failure rejects the confirmation callback for retry. Picker failures no longer
  reject unhandled promises or adopt malformed list envelopes; reopening retries.
  Creation does not expose arbitrary server prose or report malformed responses
  as success, and missing organization does not leave its busy flag set.
  Existing creation fields/nulls and zero-to-30 payment-term fallback are retained.
- Money adapters/calculations, saved units, REST/MCP handlers, auth, schemas,
  migrations, IRR flags and Stripe source are unchanged. A programmatic comparison
  verifies all create-drawer content before ContactDrawer and from ProjectDrawer
  onward matches HEAD exactly. Existing contact MCP operations cover the slice;
  pre-existing filter/limit/balance differences are inventoried without claiming
  full transport parity. LOC-027/007/002 remain independently accepted tasks.

## Actual verification

All commands ran in D:/Projects/dubbl. No full build, dev server, application DB,
provider request, deployment or hosted-CI wait.

| Check | Result |
|---|---|
| `node --import tsx --test tests/contact-list-catalogs.test.ts` | 8/8 focused checks passed |
| `pnpm test` | 964/964 passed; zero skipped/failures |
| `pnpm typecheck` | Exit 0, including new typed catalog keys/test source |
| Owned-source/test ESLint | Zero errors; one existing unused `total` warning |
| `pnpm lint` | Exit 0; zero errors, 68 existing warnings |
| `pnpm i18n:check` | 5,874 paired compatible keys per locale |
| Contact-wire + report-contact-cutover integration tests, concurrency 1 | 2/2 migrated real REST/MCP/SQL groups passed |
| `python .agentic/scripts/money_inventory.py --write` | Refreshed line/hash references; 417 schema columns unchanged, 1,700 consumers |
| `node --import tsx .agentic/scripts/verify_money_inventory.mjs` | All columns, hashes and occurrence lines verified |
| `node .agentic/scripts/verify_legacy_money.mjs` | 9 regression checks passed |
| Catalog/drawer equality assertions against HEAD | Prior namespaces and other drawers unchanged |
| Controller validation and `git diff --check` | Passed |

Database checks used a newly initialized PostgreSQL 18 cluster bound only to
127.0.0.1 on a free port and explicit TEST_DATABASE_URL. Fixtures created,
migrated and dropped randomly named databases. Cleanup SQL verified zero
remaining `dubbl_ci_*` databases and the isolated server stopped. The first
Windows wrapper hung after pg_ctl startup because inherited capture pipes stayed
open. That wrapper was stopped, its isolated server shut down, and the check
reran successfully with disk-backed pg_ctl output. No application database used.

Initial rendering checks exposed test-loader context duplication and fragile
attribute ordering; corrected harness imports/assertions without weakening the
rendered-copy assertions. Lint caught a new synchronous effect state update;
the picker now begins retry loading in its open event. Full unit/static gates
above reflect the corrected final source.

The generated money manifest also reconciles pre-existing committed source drift
for line-items-editor and purchasing-catalog-integration (no edits to those
sources). Column classifications, money units and ownership remain unchanged.

## Remaining qualification and handoff

Provisional Persian, native terminology, full RTL/browser layout, number/date
adapters, hosted CI and production/IRR acceptance remain separate. LOC-059 owns
detail shell/overview; LOC-060 financial tabs. Parent LOC-027/007/002 acceptance
is independent. No Stripe work. Commit only the reviewed task/evidence/catalog/
source/test/inventory changes, verify clean tree, report next controller task and
stop. Do not push from this commit-only request.
