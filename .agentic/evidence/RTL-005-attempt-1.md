# RTL-005 implementation evidence, attempt 1

Operator: codex-task-011. Date: 2026-10-24. Kind: bounded frontend shell repair.
Baseline: `4147a09a42f452661549076a4fa15c568bc41a9c`; master was clean.
No push by this task agent; supervisor handles pairs. No external edits observed.

## Result and acceptance mapping

1. Actual sidebar default was physical left, unlike the RTL provider's natural
   right-side flex gap. Shared sidebar now resolves logical start to right in
   Persian/left in English, pairs panel/reservation/collapse border/rail/mobile,
   constrains flexible main and preserves explicit physical/local overrides.
   Shell changes and complete exception census are in
   [shared-shell registry](../registries/RTL_SHARED_SHELLS.md) and
   [20-source hash inventory](../registries/RTL-005-shell-sources.json).
2. New `tests/rtl-shells.test.ts` runs actual AppSidebar/SidebarInset/Topbar,
   actual Sidebar/Sheet/Radix scopes, native server markup and real callbacks.
   Seven tests cover panel/gap pairing, 360 desktop override/collapse cases,
   20 mobile side cases, trigger/rail/cookie, inward tooltip with explicit caller
   override, admin permission/routes/order and installed Tailwind CSS emission.
   Direction is independent of numerals. Canonical IRR/int64/email text and
   semantic DOM order remain unchanged. Existing public menu close/navigation,
   shell/admin/auth and shared-document callbacks remain covered.
3. Checks below pass, remaining independent RTL-001 and module RTL-002 scope
   is explicitly retained. No mounted/native/focus/layout qualification inferred.

## Executed checks

- `node --import tsx --test --test-concurrency=1 tests/rtl-shells.test.ts tests/rtl-root-direction.test.ts tests/rtl-primitives.test.ts tests/shell-catalogs.test.ts tests/admin-catalogs.test.ts tests/auth-catalogs.test.ts tests/landing-shell-catalogs.test.ts`: **35/35 pass**, exit 0. Node did not discover the nonexistent `admin-catalogs.test.ts` argument; actual admin coverage is the new shell test plus the workspace suite below, not a claimed nonexistent suite.
- `node --import tsx --test --test-concurrency=1 tests/rtl-shells.test.ts tests/workspace-catalogs.test.ts tests/shared-document-catalogs.test.ts`: **22/22 pass**, exit 0, with the final seventh tooltip test included. Six shell cases overlap the first run; total **51 distinct completed tests**, not 57.
- Initial new-suite run passed 4/6; two expectations were corrected: projects is
  a collapsible button rather than a static `/projects` link, and installed
  Tailwind emits zero as `calc(var(--spacing) * 0)`. No production fallback or
  weakened money/callback assertion was introduced. Final new suite passes 7/7.
- First production `pnpm typecheck`: exit 0. Final test-inclusive
  `pnpm typecheck`: exit 0; actual command `fumadocs-mdx && tsc --noEmit`.
- Owned `pnpm exec eslint` over all eleven adopted source files plus the test:
  exit 0, zero errors, one pre-existing topbar unused `router` warning.
- `pnpm lint`: exit 0, zero errors and 20 pre-existing warnings.
- `pnpm i18n:check`: exit 0, 10,702 keys per locale; catalogs unchanged.
- `python .agentic/scripts/money_inventory.py --write` and
  `node --import tsx .agentic/scripts/verify_money_inventory.mjs`: exit 0,
  417 columns/1,866 final consumer hashes. Parsed schema_columns independently
  compare equal to HEAD, so no classification change.
- `node .agentic/scripts/verify_legacy_money.mjs`: all nine checks pass.
- Strict UTF-8/source-hash/local-link/frozen-file/controller/diff checks pass;
  369 tasks structurally validate. No financial/database/API operation changed.

## Boundary review and limits

The skill/controller workflow was used, with user-authorized sequential fresh
agents and supervisor pair push. Frozen billing/pricing/checkout/mixed source
files compare equal to HEAD; no dedicated provider or Stripe work. Existing
locale preference REST/MCP controls still drive direction; no new tool needed.

After reading computer-use skill, live `cua.getState()` returned empty apps and
browsers. There is no mounted browser/layout/focus/screenshot/native approval.
The reported overlap is repaired in actual source and regression/CSS constraints;
its final visual appearance is not independently observed in an enabled browser.
DEC-005 means unavailable browser helpers/screenshots do not block this bounded
implementation task, while RTL-001 retains independent layout/focus behavior
review. No build/dev server startup, application DB mutation, hosted CI/build
qualification, parent completion or IRR activation is claimed.

## Handoff

Review is honestly self-attributed in the separate review record. Complete this
child only; RTL-001 independently accepts combined root/primitive/shell behavior,
RTL-002 owns module forms/tables/bidi/typography. Supervisor pushes only after the
next separately committed task, per owner instructions.
