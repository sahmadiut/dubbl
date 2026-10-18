# LOC-038 attempt 1 - accrual catalogs

Date: 2026-10-18 (Asia/Tehran). Implementer: Codex. Repository: D:/Projects/dubbl.
Controller validate/status/next selected LOC-038 on master; entry tree was clean.
This evidence describes the verified working tree before scoped commit/push.

## Acceptance mapping

1. Added 94 paired `Accruals` messages (4,109 keys per locale) for the accrual
   list/detail routes and creation drawer. Titles, empty-state explanations,
   examples, filters, statuses, table/period labels, count/amount sentences,
   field/placeholder labels, loading, validation, confirmations and errors use
   catalogs. Scope and explicit exceptions: [registry](../registries/ACCRUAL_CATALOGS.md).
2. Production JSX renders through PresentationProvider/next-intl in both locales.
   Tests execute actual create/post/cancel/read/paging callbacks and preserve
   routes, methods, org headers, Gregorian dates, account IDs, retry keys and
   exact decimal-major create values. Saved numeric/Minor aliases are validated;
   malformed success bodies cannot trigger navigation/success. Tests cover
   unknown server prose, HTTP authorization/input/range failures, malformed JSON,
   missing/inconsistent exact aliases, local syntax/range/period validation,
   no-org saving, cancellation before confirmation, cancellation retry, escaping,
   loading errors and bigint aggregate display at 16,000,000,000,000,004 cents.
   Failed reads do not adopt bad state. Failed cancellation rethrows for the
   existing confirmation hook to retain retry state. Successful paging clears
   stale errors. Exact input/distribution/storage contracts are unchanged.
3. Registry/task handoff retain provisional Persian wording, native/RTL and
   independent LOC-024/007/002 integration acceptance. Existing namespaces and
   every sibling drawer body were compared with HEAD and are identical. All
   unchanged user operations have existing org-scoped accrual MCP tools sharing
   services with REST. No REST/MCP/service/schema/migration or Stripe changes.
   Review is honest [self-review](LOC-038-review-1.md).

## Verification

All commands ran at repository root. PostgreSQL 18 was initialized in a unique
OS temporary directory, trust auth, bound to 127.0.0.1:55438, with explicit
TEST_DATABASE_URL. Fixtures created/dropped a randomized database. The cluster
was stopped after the test; no application database was used.

| Check | Actual result |
|---|---|
| Focused catalog and accrual wire tests | 8/8 passed, no skips |
| Full unit/static suite, concurrency 4 | 801/801 passed, no skips; 79.563 seconds at checkpoint |
| Final focused catalog rerun after paging error-clear change | 6/6 passed, no skips; 6.028 seconds |
| Accrual REST/MCP/SQL integration | 1/1 passed, no skips; 29.584 seconds; allocation/scope/post/retries/rollback |
| pnpm typecheck, including final rerun | Exit 0; fumadocs-mdx and tsc --noEmit |
| pnpm i18n:check | Exit 0; 4,109 compatible keys per locale |
| Changed-file ESLint, including final rerun | Exit 0; no errors or warnings |
| Full pnpm lint | Exit 0; zero errors, 72 existing warnings outside owned sources |
| Money inventory generation/verifier | Exit 0; 417 columns, 2,233 scanned files, 1,675 consumer hashes and all source/occurrence lines |
| Legacy money gate | Exit 0; nine regression checks |
| Catalog/source ownership and Persian audit | Existing namespaces/sibling drawers identical; authored JSX/display attributes cataloged; all 94 Persian values contain Persian script |
| Pre-commit fetch/divergence | master and origin/master 0 ahead / 0 behind |
| Controller validation and git diff --check | Exit 0 |

Commands:

```text
node --import tsx --test --test-concurrency=2 tests/accrual-catalogs.test.ts tests/accrual-wire.test.ts
node --import tsx --test --test-concurrency=4 tests/*.test.ts
node --import tsx --test tests/accrual-catalogs.test.ts
node --import tsx --test --test-concurrency=1 tests/integration/accrual-schedules.test.ts
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

Intermediate checks found and corrected a broad namespace replacement in the
list translator type/hook and remaining icon-adjacent JSX text. Review found
the shared drawer's saving label and added a localized override without changing
sibling drawers. Inventory was refreshed again after the final line change;
the final verifier passes. No failures remain from these intermediate checks.

## Limits and next action

No full build, dev server, mounted browser, hosted CI wait, deployment or
production qualification ran. Tests control hooks and inline portals; they do
not constitute interactive browser acceptance. Persian native/RTL qualification
and independent LOC-024/007/002 integration acceptance remain open. Commit only
task-owned files, complete the authorized origin/master push and verify remote
SHA/clean tree separately, then report the next task and stop.
