# LOC-060 attempt 1

2026-10-19 (Asia/Tehran), Codex. One controller-selected task, started from a
clean tree on master. Owner requested completion and local commit only.

## Implementation and acceptance

1. Extracted all authored financial-tab presentation into 92 paired messages:
   ContactBookkeeping (13), ContactActivity (35), ContactStatement (44).
   Catalogs now contain 6,042 keys per locale. Shared activity configuration
   uses typed message keys; finite mappings cover all current activity statuses
   and statement types with safe unknown fallbacks. Scope and explicit data,
   formatting and generated-description exceptions are documented in
   [CONTACT_FINANCIAL_CATALOGS.md](../registries/CONTACT_FINANCIAL_CATALOGS.md).
2. Ten focused tests render real production templates through React/next-intl/
   PresentationProvider and execute actual authored callbacks with controlled
   IO. They cover both locales, empty/loaded/loading/busy states, all current
   statuses/types, unknown/prototype values, caller escaping, preserved select
   values, navigation, filter resets, six Gregorian date presets, reference
   reads, PATCH, activity cursor pagination, statement read/abort, PDF/email
   requests and status/JSON/shape/alias/network/missing-organization failures.
   Exact amounts retain low digits through 9,007,199,254,740,991 minor units in
   USD/JPY/KWD. AST audit checks JSX and display attributes; every Persian leaf
   contains Persian script. Portal controls expose authored children; these are
   controlled rendering/callback checks, not mounted-browser tests.
3. Registry, task handoff and honest self-review record provisional Persian
   financial wording and independent LOC-027/007/002/native/RTL acceptance.

Bookkeeping now checks organization before setting saving state; reference
requests check HTTP/envelopes/relevant row fields before adopting options and
report localized failures. Statement email failures no longer expose arbitrary
server/network prose. Existing payload fields, nullable optionals, `none`
sentinels, currency-aware credit input strings, exact response adapters, money
formatting, date calculations, pagination, routes, organization headers and
PDF/email behavior remain intact.

Existing registered contact/account/tax/activity/statement/export/email MCP
tools cover the same user operations; no new operation, REST/MCP contract,
schema/migration, financial calculation, stored-unit, IRR or Stripe work.
Statement descriptions remain opaque service data (including user references
and existing generated labels); translation of service/PDF/email content is
explicitly deferred rather than inferred from strings.

## Actual verification

| Check | Result |
|---|---|
| `node --import tsx --test tests/contact-financial-catalogs.test.ts` | 10/10 passed |
| `pnpm test` | 982/982 passed, zero failures/skips |
| `pnpm typecheck` | Exit 0 |
| ESLint on four owned TSX files, presentation helper and focused test | Exit 0, zero warnings/errors |
| `pnpm lint` | Exit 0, zero errors, 68 existing warnings |
| `pnpm i18n:check` | 6,042 compatible keys per locale |
| contact-statement + contact-wire integration tests, concurrency 1 | 2/2 migrated real REST/MCP test groups passed |
| `python .agentic/scripts/money_inventory.py --write` | 417 unchanged schema columns; 1,703 consumers |
| `node --import tsx .agentic/scripts/verify_money_inventory.mjs` | Columns, source hashes and occurrence lines verified |
| `node .agentic/scripts/verify_legacy_money.mjs` | 9 regression checks passed |
| Programmatic catalog comparison to HEAD | Every existing namespace equal; only three owned namespaces added |
| Programmatic inventory comparison to HEAD | Only four owned TSX files, helper, catalogs and focused test consumers changed; schema/classifications unchanged |
| Controller structural validation and `git diff --check` | Passed |

PostgreSQL tests used an isolated new PostgreSQL 18 cluster on 127.0.0.1:2771,
with explicit TEST_DATABASE_URL. Fixtures created, migrated and dropped random
databases. SQL confirmed zero remaining `dubbl_ci_*` databases and the isolated
server stopped. No application database was used. These tests verify preserved
transport behavior; the changed presentation uses controlled IO tests above.

All verification commands passed on this attempt. Inventory was regenerated
after final source whitespace cleanup and temporary configuration removal.

## Review and handoff

[Codex self-review](LOC-060-review-1.md) describes reviewed changes and limits;
no peer, human or native terminology review is claimed. Native Persian,
comprehensive RTL/browser layout, localized number/date presentation, hosted CI,
live provider, deployment and production/IRR qualification remain independent.
No full build, dev server, external provider delivery or deployment ran.

Complete controller disposition, commit task-owned changes, verify local commit
and clean tree, report the next task and stop. No push from this commit request.
