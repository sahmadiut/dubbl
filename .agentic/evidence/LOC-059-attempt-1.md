# LOC-059 attempt 1

2026-10-19 (Asia/Tehran), Codex. One controller-selected task, started from a
clean working tree on master. Owner requested completion and local commit only.
No push is authorized by this turn.

## Implementation and acceptance

1. Extracted contact detail layout/overview into 76 paired `ContactDetails`
   messages, bringing each locale to 5,950 keys. Includes six tabs, navigation,
   merge search/dialog/confirmation, editing/defaults/credit fields, notes,
   danger section, busy state, both confirmation buttons and operation outcomes.
   [Scope and explicit exceptions](../registries/CONTACT_DETAIL_CATALOGS.md)
   enumerate retained data/technical examples, sibling activity labels and
   independent parent/native/RTL acceptance. Persian wording is provisional.
2. Eight focused checks render actual production templates with real React,
   next-intl and PresentationProvider, controlling hooks/navigation/portal
   boundaries. Actual callback bodies verify navigation, drawer defaults, all
   update fields/nulls, source-to-survivor merge direction, organization headers,
   search/reference requests, cancellation, HTTP/JSON/envelope/row/network
   failures, escaping and busy state. Existing exact adapters retain aliases
   through 9,007,199,254,740,991 minor units in USD/JPY/KWD. Source audit covers
   owned JSX/display attributes; Persian-script checks pass. These are not
   mounted-browser tests.
3. This evidence, honest self-review and updated task/catalog registry hand off
   LOC-060 and independent LOC-027/007/002/native/RTL qualification. No parent is
   completed by this child.

Deletion now requires successful HTTP before reporting success/navigating and
rejects its confirmation callback on failure to retain retry. Its button no
longer submits the edit form. Merge errors use localized fallbacks rather than
arbitrary server prose; network failure resets busy state. Search/reference reads
check status, envelopes and relevant row properties before adopting options.
Missing organization does not leave initial loading or update saving stuck.

Existing PATCH fields, optional nulls, `none` sentinels, zero/empty-to-30 terms
fallback, currency codes, exact `creditLimitMinor` strings and money adapters
remain unchanged. Merge still POSTs the duplicate ID with current contact as
target. Existing registered MCP operations cover these workflows; no REST/MCP,
schema, migration, auth, financial calculation, stored-unit, IRR or Stripe change.
Existing US/1099 presentation and delete warning semantics are retained; actual
deletion remains the existing soft delete.

## Actual verification

All commands ran in D:/Projects/dubbl; results below reflect final source.

| Check | Result |
|---|---|
| `node --import tsx --test tests/contact-detail-catalogs.test.ts` | 8/8 passed |
| `pnpm test` | 972/972 passed, zero failures/skips |
| `pnpm typecheck` | Exit 0, including typed production keys and tests |
| ESLint on layout/overview/focused test | Exit 0, zero warnings/errors |
| `pnpm lint` | Exit 0, zero errors, 68 existing warnings |
| `pnpm i18n:check` | 5,950 compatible paired keys per locale |
| contact-wire + report-contact-cutover-acceptance integration tests, concurrency 1 | 2/2 migrated real REST/MCP/SQL groups passed |
| `python .agentic/scripts/money_inventory.py --write` | 417 unchanged schema columns; 1,701 consumers |
| `node --import tsx .agentic/scripts/verify_money_inventory.mjs` | Columns, hashes and source/occurrence lines verified |
| `node .agentic/scripts/verify_legacy_money.mjs` | 9 regression checks passed |
| Programmatic catalog comparison to HEAD | Previous namespaces equal in both locales; only 76 ContactDetails messages added |
| Programmatic generated-inventory comparison to HEAD | Only owned layout/overview/catalog/test consumers changed; columns/classifications unchanged |
| Controller structural validation and `git diff --check` | Passed |

PostgreSQL checks used a newly initialized PostgreSQL 18 cluster bound to
127.0.0.1 on a free port with explicit TEST_DATABASE_URL. Fixtures migrated and
dropped randomly named databases; SQL confirmed zero remaining `dubbl_ci_*`
databases, and the isolated server stopped. No application database used.
Integration checks cover preserved workflows, not a new API implementation.

Initial lint caught a test-harness children-prop style error, fixed by using the
React children argument. Initial typecheck exposed an existing settings test's
flat-message assumption when a new nested tab object widened its inferred value
union. ContactDetails now uses the repository's flat-key convention, without
changing unrelated tests. Final complete reruns pass. Money inventory changes
only reconcile owned source hashes/line references and the new test consumer.

## Review and handoff

[Codex self-review](LOC-059-review-1.md) records review scope and limitations.
No human, independent peer or native terminology approval is claimed. Native
Persian, full RTL/browser layout, locale-specific number/date presentation,
hosted CI, deployment and production/IRR qualification remain independent.
No full build, dev server, provider call or deployment ran. Preserve Stripe.

Finish controller disposition, commit only owned source/catalog/test/registry/
evidence/task files, verify local commit and clean tree, report LOC-060 and stop.
No push from this commit-only request.
