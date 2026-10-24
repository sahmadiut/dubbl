# LOC-002 combined catalog acceptance - 2026-10-24

## Identity and resumed scope

Operator/reviewer: Codex (/root). Resumed the controller's existing in-progress
LOC-002 owned by locale-task-002 on master at 55ba2454. At entry, the task,
MESSAGE_CATALOGS and MONEY_BOUNDARIES were modified, and WHOLE_CATALOG_ACCEPTANCE
and whole-catalog-integration.test.ts were untracked. These five paths all belong
to the active task. No prior unrecorded test result is claimed as current proof.

Read applicable AGENTS, START_HERE, project/repository/controller/frontend role
instructions, prerequisite evidence, consolidated source inventories and actual
catalog validator, next-intl type augmentation, provider, rich callbacks and lint
configuration. All six prerequisites were independently confirmed done with
recorded review; their status alone was not used to accept this parent.

## Implementation and acceptance mapping

1. **No missing production keys:** the current complete catalogs contain 157
   namespaces and 10,587 identical key paths per locale. The new exhaustive
   runtime test renders every real leaf in Persian/English/Persian order with
   actual next-intl, numeric/date/select/plural fixtures, structured React tags
   and adversarial caller text. The real PresentationProvider separately renders
   a key from every namespace with no diagnostics or locale-state leakage.
   Existing typed production keys and negative-key compile probes remain active.
   The combined source inventory reconciles shell/auth/settings, accounting,
   operations and public/output/background ownership with explicit data, machine,
   provider and later-formatting exceptions. Source counts are 249 app TSX and
   158 components TSX files; 136 MDX files are the existing 68 bilingual pairs.
2. **Persian plural behavior:** all 160 production plurals in each catalog check
   the selected branch's literal text and localized pound values for 0, 1, 2,
   0.5 and 1.5, including exact cases/offset handling. Runtime Persian cardinal
   categories are one/one/other for 0/1/2. Existing message-catalog tests pin
   fractional/ordinal behavior and reject missing branches, malformed/nested
   contracts and interpolation/format mismatches. Nested production selectors
   deliberately require fixture extension rather than silently losing coverage.
3. **Safe structured rich text:** exhaustive catalog rendering uses actual
   strong/em/code callbacks and React escaping. Existing validator and lint
   regressions reject catalog HTML, attributes, raw/markup bypasses and unsafe
   sinks. Caller script/markup text stays escaped; no catalog-authored arbitrary
   HTML is introduced. Custom/saved templates retain their existing boundary.

The first current typecheck found TS2339 in the unfinished plural test: a nested
function captured node.offset after the discriminated-union narrowing was lost.
Captured the already narrowed numeric offset before the function. This changes
only test typing and preserves the same branch/pound assertions. The final
focused runtime check and typecheck pass after the fix. Regenerated the money
inventory; only the new test's consumer/hash/occurrence entry differs from HEAD.
All 417 column classifications are retained.

No production implementation, locale resource, stored money/FX, date, permission,
API/MCP operation, schema/migration, dependency, IRR flag or Stripe file changes.
No new user operation or REST change calls for an MCP addition. Recorded existing
MCP gaps in child inventories remain open.

## Current verification

All commands run from D:/Projects/dubbl with installed dependencies. Results below
are from this resumed run, not inferred from draft prose or historical evidence.

- `node --import tsx --test --test-concurrency=1 tests/*.test.ts`: exit 0,
  1,462/1,462 passed, zero failed/skipped/cancelled, 854.13 seconds. All current
  child and parent compositions, source inventories, catalog regressions and
  domain/unit checks ran on the resumed tree, including the final whole-catalog
  test after its typing fix.
- `node --import tsx --test tests/whole-catalog-integration.test.ts`: exit 0,
  3/3 passed after the typing fix, zero failed/skipped, 1.94 seconds.
- `pnpm i18n:check`: exit 0, 10,587 compatible keys in each locale.
- `pnpm typecheck`: exit 0 after the fix; fumadocs-mdx plus tsc --noEmit,
  including real production keys and negative compile probes.
- `pnpm exec eslint tests/whole-catalog-integration.test.ts`: exit 0, no warnings.
- `pnpm lint`: exit 0, zero errors and 20 existing warnings outside owned code.
- `python .agentic/scripts/money_inventory.py --write`, then
  `node --import tsx .agentic/scripts/verify_money_inventory.mjs`: exit 0;
  417 columns, 1,851 consumer hashes and source occurrences verified.
- `node .agentic/scripts/verify_legacy_money.mjs`: exit 0, nine regressions pass.
- `node --import tsx --test --test-concurrency=1 tests/integration/locale-preferences.test.ts tests/integration/shell-auth-settings.test.ts tests/integration/settings-catalog-integration.test.ts tests/integration/core-ui-integration.test.ts tests/integration/inventory-catalog.test.ts tests/integration/payroll-integration.test.ts tests/integration/project-crm-pricing.test.ts tests/integration/public-portal-wire.test.ts tests/integration/document-rendering.test.ts`:
  exit 0, 9/9 passed, no failed/skipped tests, 109.77 seconds. Real authenticated
  REST, linked registered MCP and independent SQL assertions exercise additive
  locale migration/preferences, shell/settings, accounting, inventory, payroll,
  projects/CRM/pricing, public portal and document/email rendering boundaries.
- Bounded source/link inspection: 157 namespaces, 249 app/158 components TSX,
  136 MDX sources and all relative links in the four consolidated parent source
  inventories verified. Prerequisite controller metadata confirmed complete.
- `python .agentic/agent.py validate`: exit 0, 360 structurally valid tasks.
- `git diff --check`: exit 0.

The database run initialized an independent OS-temp PostgreSQL 18 UTF8/trust
cluster at 127.0.0.1:14118, timezone UTC, max_locks_per_transaction=256.
TEST_DATABASE_URL, PG_BIN and TZ were process scoped. Each fixture created/dropped
its own randomized dubbl_ci_ database; final SQL returned zero remaining fixture
databases, and pg_ctl stopped the cluster in finally. No application database or
live provider was used. OS-temp diagnostic logs are not committed.

An initial unit command could not open a pre-existing temporary log because
another process held it. That command did not run and is not counted as a pass;
the resumed unit run uses a unique log path and its own observed process exit.

## Review and handoff

See [honest Codex self-review](LOC-002-review-1.md). Independent parent acceptance
means current combined execution separate from child status; it does not claim a
separate reviewer or human/native approval. No build/dev server, browser mounted
workflow/keyboard/hydration, hosted CI, deployment, live recipient delivery,
Persian PDF shaping, native terminology or production IRR readiness is claimed.
All existing child exceptions and later L10N/RTL/output/release gates remain.
Commit only this task's reviewed files locally; no push is authorized by this
request. Stop after LOC-002 and report the live next controller task.
