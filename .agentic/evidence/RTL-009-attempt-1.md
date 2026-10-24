# RTL-009 shared data-table hardening

## Scope and actual audit

Initial master tree was clean. Controller validation passed at 373 tasks and selected RTL-008. Actual source review found advanced sorting was a click handler on th without a native keyboard button/sort state; shared headers inherited nowrap sizing and the advanced toolbar used fixed-width search layout. Banking account-number fields/displays and public/admin/output identifiers have separate domain contracts. RTL-008 was split into RTL-009/010/011, retaining its unchanged unchecked criteria. RTL-002 remains an independent integration parent.

The exhaustive app/components/lib TSX census assigns 417 files: 2 RTL-009 shared tables, 276 RTL-010 dashboard files, 135 RTL-011 public/admin/shared/output files, 4 frozen provider files. Ownership is review responsibility, not a blanket pass. Imported non-TSX builders belong with consuming surfaces; mixed Stripe sections within assigned files stay frozen under DEC-008. Further bounded splits require actual domain audit. No other domain implementation is included.

## Changes and contracts

Both real shared tables expose scope=col; sortable headers have native type=button controls, accurate aria-sort, explicit visible-focus CSS, wrapped long text and nonshrinking decorative arrows. The basic omitted-sortOrder fallback matches its existing descending icon. Explicit button type prevents accidental form submission. Header cells allow intrinsic height, padding, normal whitespace and anywhere wrapping; caller classes/renderers remain authoritative. Body cells retain existing horizontal scrolling.

Advanced toolbar/footer wrap and shrink, search has explicit translated accessible name/auto direction, columns icon margin is logical, pagination arrows follow RTL and canonical page fraction has LTR isolation. Real callbacks preserve canonical sort keys/search, original selected/clicked row objects, page operations, identifiers and exact amounts beyond Number.MAX_SAFE_INTEGER. No new business operation, REST/MCP/API/schema or saved/issued/output contract is introduced.

## Verification actually performed

- Initial sandbox Node/MDX helper spawning failed with EPERM; required escalation was approved and subsequent checks ran. Initial CSS fixture lacked spacing theme and failed its min-width assertion, corrected before passing. Initial owned lint rejected test variable module, renamed compiledModule. A comparison script using Windows default decoding was corrected to explicit UTF-8; all 417 complete schema records then compared equal.
- node --import tsx --test --test-concurrency=1 tests/rtl-data-tables.test.ts tests/rtl-bidi-controls.test.ts tests/rtl-primitives.test.ts tests/rtl-acceptance.test.ts tests/account-catalogs.test.ts tests/invoice-catalogs.test.ts: **48/48 pass**, exit 0, no skips/cancellations.
- After final omitted-sortOrder semantic review and test variable rename, node --import tsx --test --test-concurrency=1 tests/rtl-data-tables.test.ts: **5/5 pass**, exit 0. Real React, next-intl/PresentationProvider and installed controls run in English/Persian with both numeral preferences. Only module-local state and JSX callback capture are instrumented. Sort cycles, exact selection objects, row click/sort keys, search reset, pagination, loading/empty states, long Persian/English headers and exact identifiers/money strings are asserted.
- Installed Tailwind compiler verifies auto height, normal whitespace/anywhere wrapping, max width, zero minimum width, logical margin, focus-visible, RTL rotation and isolation. Explicit spacing theme is supplied in this isolated CSS fixture; this proves declarations, not measured browser layout.
- pnpm typecheck: exit 0 (fumadocs-mdx and tsc --noEmit).
- pnpm exec eslint components/dashboard/data-table.tsx components/dashboard/data-table-advanced.tsx tests/rtl-data-tables.test.ts: exit 0, no warnings/errors.
- pnpm lint: exit 0, no errors, 20 existing warnings in untouched files.
- pnpm i18n:check: exit 0, 10,702 keys in each locale; catalogs unchanged.
- python .agentic/scripts/money_inventory.py --write and node --import tsx .agentic/scripts/verify_money_inventory.mjs: exit 0, 417 schema columns/1,871 consumer hashes. All complete schema records compare equal with HEAD; inventory changes describe source hashes and the new regression consumer only.
- node .agentic/scripts/verify_legacy_money.mjs: exit 0, 9/9 pass.
- Exhaustive ownership set/unique-count check: registry exactly matches all 417 current TSX paths. Four frozen source diffs against HEAD are empty.
- git diff --check: exit 0. Final controller validation and scoped staged checks precede the local task commit.

## Qualification boundaries and handoff

Native button semantics, real callbacks and installed CSS are verified. No mounted browser keyboard-event, caret/selection geometry, computed overflow at device widths, zoom/text-spacing rendering or screen-reader pass is claimed. DEC-005 removes screenshots, not later behavioral/layout/native qualification. Shared CSS allows intrinsic growth/wrapping; module charts/tooltips, technical identifiers, public/portal/PDF/output correctness and genuine native/accounting qualification remain RTL-010/011 and independent RTL-008/RTL-002 acceptance. This child does not close either parent.

No full build, dev startup, application DB write, migration, dedicated Stripe work, deployment, IRR enablement or hosted CI result is claimed. Local task commit only; supervisor handles the paired push. Next task: RTL-010.
