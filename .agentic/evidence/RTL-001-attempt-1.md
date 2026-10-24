# RTL-001 independent acceptance evidence

Operator: codex-task-012. Date: 2026-10-25. Baseline: `36597677`.
Clean master/controller 369 tasks verified before starting. No push; supervisor
handles the pair with RTL-005. No external changes observed.

## Result

Reviewed actual root/primitives/shell source independently and created a
[74-source final hash census](../registries/RTL-001-source-audit.json).
[Combined acceptance matrix](../registries/RTL_COMBINED_ACCEPTANCE.md) maps all
three original criteria to actual source, rendered components, installed
keyboard algorithms and compiled CSS observations, with explicit limitations.
The review found/fixed one real omission: active Radix TabsContent is focusable
but its wrapper removed the outline without a replacement. It now has a
keyboard-only ring with offset; no callback, focus order or API value changes.

## Executed checks

- `node --import tsx --test --test-concurrency=1 tests/rtl-acceptance.test.ts tests/rtl-root-direction.test.ts tests/rtl-primitives.test.ts tests/rtl-shells.test.ts tests/shell-catalogs.test.ts tests/workspace-catalogs.test.ts tests/shared-document-catalogs.test.ts tests/public-output-catalog-integration.test.ts tests/localized-number-controls.test.ts`: **45/45 pass**, exit 0, 61 seconds. The last requested localized-number-controls filename does not exist and Node ignored it; no coverage of that nonexistent suite is claimed. The other eight actual suites supply the 45 reported cases, including canonical shared-document inputs/output tests.
- Final `node --import tsx --test tests/rtl-acceptance.test.ts`: **3/3 pass**, exit 0; these overlap the 45 above. Final instrumentation cleanup uses a real React callback wrapper to keep owned lint clean. Tests execute actual installed Radix roving key resolver and actual FocusScope Tab callback with explicitly modeled DOM services. Real tabpanel and installed CSS prove the replacement focus style exists. No vendor code is changed.
- `pnpm typecheck`: exit 0, actual `fumadocs-mdx && tsc --noEmit`, after final source/test edits.
- `pnpm exec eslint components/ui/tabs.tsx tests/rtl-acceptance.test.ts`: exit 0, no warnings/errors. Initial instrumentation useCallback forwarding emitted one warning, corrected narrowly before final check.
- `pnpm lint`: exit 0, zero errors and 20 pre-existing warnings.
- `python .agentic/scripts/money_inventory.py --write`; `node --import tsx .agentic/scripts/verify_money_inventory.mjs`: exit 0, 417 columns/1,867 final consumer hashes. Parsed schema classifications compare equal to HEAD; no financial source/schema change.
- `node .agentic/scripts/verify_legacy_money.mjs`: all nine checks pass.
- `pnpm i18n:check`: exit 0, 10,702 keys per locale, catalogs unchanged.
- Final 74 normalized source hashes, UTF-8, local links, frozen source equality,
  unchanged classifications, controller structural validation and diff checks
  reproduced before closure. One initial ad-hoc audit assertion exited 1; the
  final exact census/schema/frozen comparison passed with no extra source change.

## Scope and review limitations

DEC-005 removes screenshot/unavailable-browser-helper blockers while retaining
actual review. This task performs independent code/runtime/CSS review, not a
mounted browser or human/native approval. Fresh CUA inventory returned empty
apps and browsers. Modeled DOM focus execution does not establish computed
clipping/collision/contrast/focus visibility, screen-reader behavior, native
language, long translations/zoom or module typography. These remain RTL-002 and
later QA/native/output qualification surfaces. No criterion was deleted or
weakened, and no child status was substituted for independent review.

No full build, dev-server start, screenshot capture, database write, hosted CI,
production deployment, IRR activation or provider qualification was performed.
Dedicated/frozen Stripe billing/pricing/checkout/mixed sources compare unchanged.
Existing REST/MCP locale controls, exact money, routes, ISO/identifier values,
issued snapshots/default email/document output and unrelated code are preserved.
Approval is honestly self-attributed in [review](RTL-001-review-1.md).

## Handoff

Complete only RTL-001. Next controller task is independently selected after done;
RTL-002 module form/table/bidi/typography work is not accepted by this task.
Supervisor pushes only after the separate RTL-005 and RTL-001 commits are ready.
