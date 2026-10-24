# RTL-003 root direction propagation

Date: 2026-10-24. Agent: codex-task-009. Base: `30f6246545a8fd45912631cf5af3db41a23e4262`.

## Selection and bounded scope

Started from clean `master`. Controller validation passed for 366 tasks and selected
RTL-001. Inspection found three distinct implementation families: missing root
direction/context, physical shared primitive layout, and physical shell/sidebar
geometry. Created RTL-003/004/005 with actual prerequisite ordering and used
`python .agentic/agent.py split RTL-001 --children RTL-003 RTL-004 RTL-005 --note ...`.
RTL-001 retains every original acceptance criterion and independent combined
review. RTL-002 keeps forms/tables/typography/mixed identifiers. Structural
validation after splitting passes for 369 tasks. Only RTL-003 is completed here.

## Implementation and reviewed behavior

- `localeDirection` derives `rtl` solely from `fa-IR`, otherwise the supported
  `en-US` is `ltr`. It adds no saved preference and does not change locale
  precedence or the serialized Presentation shape.
- `PresentationProvider` wraps the actual installed Radix Direction provider
  around translated children without adding DOM or changing child order.
- Actual async root JSX emits matching native `html lang/dir` from the server
  presentation. There is no client useEffect direction flip.
- The nested Fumadocs RootProvider receives explicit matching direction. Its
  installed implementation otherwise defaults its own nested Radix provider to
  LTR and would override the global Persian direction.
- Global notifications receive explicit direction and logical-end placement:
  bottom-right in English, bottom-left in Persian. The imported Sonner contract
  accepts dir/position. Existing notification styling is preserved.
- Real Tabs and Select roots inherit active direction. Explicit opposite
  component directions and nested Direction.Provider scopes remain valid.
- Canonical IRR/int64/id/email values, DOM First/Last order and focus classes
  remain unchanged. Search/check icons receive no mirror or rotation style.
- Existing REST/MCP locale preference operations continue to control language;
  direction is derived, not a new operation or stored field. No DB or migration
  changes, application DB access or new endpoint/tool.

The ownership and remaining review surface are recorded in
[RTL_ROOT_DIRECTION.md](../registries/RTL_ROOT_DIRECTION.md).

## Executed checks

1. `node --import tsx --test tests/rtl-root-direction.test.ts tests/locale.test.ts tests/localized-number-presentation.test.ts tests/calendar.test.ts`: **24/24 pass**, exit 0. Includes four real root/provider tests, independent language/numeral combinations, primitive overrides, serialization, existing canonical date/number callbacks and preference/auth behavior.
2. `node --import tsx --test --test-concurrency=1 tests/shell-catalogs.test.ts tests/public-output-catalog-integration.test.ts tests/currency-labels.test.ts`: **13/13 pass**, exit 0. Actual shell/table/shared controls and public/document/email defaults retain their canonical route/value/callback/output assertions.
3. Final narrow `node --import tsx --test tests/rtl-root-direction.test.ts`: **4/4 pass**, exit 0 after test-only lint/type fixes. This overlaps check 1; it is not four additional distinct tests.
4. `pnpm exec eslint app/layout.tsx i18n/locale.ts i18n/provider.tsx tests/rtl-root-direction.test.ts`: exit 0, zero warnings.
5. Final `pnpm typecheck`: exit 0 after the final test typing/lint corrections.
6. `pnpm lint`: exit 0, zero errors and the same 20 pre-existing warnings. None are in the four owned source/test files.
7. `pnpm i18n:check`: exit 0, 10,702 keys in each locale; catalogs unchanged.
8. Final `python .agentic/scripts/money_inventory.py --write` and `node --import tsx .agentic/scripts/verify_money_inventory.mjs`: 417 columns and 1,864 final consumer hashes verified after the test-only edits. Parsed schema_columns independently equal HEAD exactly. No classification or money semantics change.
9. `node .agentic/scripts/verify_legacy_money.mjs`: all nine regression checks pass, exit 0.
10. Structural controller validation (369 tasks), strict UTF-8 and 11 new local links pass. Frozen billing/pricing/checkout/mixed demo sources equal HEAD. `git diff --check` passes; final task-owned staged scope/whitespace is checked before commit.

## Controlled corrections and limits

The first new four-test run passed three and failed the root harness because the
actual Fumadocs I18nProvider requires framework context. Supplying its real
FrameworkProvider with controlled navigation resolved the harness and the
subsequent 24/24 run passed. Initial owned lint rejected passing children in
createElement props; the fixture now passes its child as the third argument.
Initial typecheck caught unsupported data-testid props in createElement's Lucide
type overload; probes now use supported aria-label attributes and the narrow
four-test run passes. These were test-harness defects, not hidden production
fallbacks. Final static results are recorded separately above.

No build, dev server startup, screenshot, mounted browser interaction, computed
layout/visibility, keyboard Tab/arrow interaction or native linguistic/accounting
review was performed or claimed. DEC-005 removes screenshots/unavailable browser
helpers as blockers but retains actual later review. SSR DOM-order/focus-class
assertions are limited structural evidence, not proof of mounted focus behavior.
RTL-004/005 and independent RTL-001 acceptance retain those surfaces explicitly.

Dedicated Stripe/provider, frozen billing/pricing/checkout files and mixed
reconciliation example are unchanged under DEC-008. No provider-specific work,
output-document rewrite, IRR financial enablement, ISO replacement in machine
values or canonical money rescaling occurs. Global direction inheritance is
shared locale infrastructure, not dedicated provider qualification.

## Handoff

Implementation and required checks complete. Record the honestly attributed
self-review/controller closure and commit only task-owned files. No push from
this agent; the parent orchestrates the two-task pair push. Next expected ready
child is RTL-004; RTL-001 remains open independently. No further source/test work
is required for this child.
