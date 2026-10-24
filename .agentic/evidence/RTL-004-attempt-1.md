# RTL-004 shared primitive logical layout

Date: 2026-10-24. Agent: codex-task-010. Base:
`2d69314ecb390e5a3fc1f820f6e5cc58fc7ebf88`.

## Selection and implementation

Clean master; live controller validate/status/next selected RTL-004 with no
unmet prerequisites, 369 structurally valid tasks. Started using
`python .agentic/agent.py start RTL-004 --owner codex-task-010`.

Audited all 51 UI sources and actual Sheet callers. Converted flow-dependent
spacing/indicator placement/headings/range corners, directional chevrons and
switch movement in 16 primitives. Default Sheet opens from logical end, with
optional logical start and unchanged explicit physical side overrides. Actual
Radix direction handles nested/explicit scopes. Calendar distinguishes installed
DayPicker default/after versus already-direction-aware around navigation to
avoid double mirroring. Only directional icon variants use local computed
`:dir(rtl)`; universal icons and DOM order stay unchanged. DualAmount defaults
logical start and supports logical end while retaining explicit physical
left/right alignment contracts.

Full source/exception review:
[primitive registry](../registries/RTL_SHARED_PRIMITIVES.md),
[52-file/107-instance actual Sheet caller inventory](../registries/RTL-004-sheet-callers.json).
Sidebar/shell and caller intent changes remain RTL-005, module/bidi remains
RTL-002, independent combined behavior/layout/focus review remains RTL-001.
The user's reported left-pinned desktop sidebar and content gap/clipping issue
is not claimed fixed here; the supervisor prioritizes the next RTL-005 agent.

No schema, REST/MCP operation, locale preference, money scale/storage/payload,
route, ID, caller value, issued document or email change. Existing preference
tools control language/direction; no new tool is needed for this shared layout.
Frozen dedicated Stripe/provider/billing/pricing/checkout/mixed demo sources
remain untouched under DEC-008.

## Executed checks

- `node --import tsx --test --test-concurrency=1 tests/rtl-primitives.test.ts tests/rtl-root-direction.test.ts tests/calendar.test.ts tests/currency-labels.test.ts tests/localized-number-controls.test.ts`: **21/21 pass**, exit 0. The final listed nonexistent path was not discovered by Node; the actual 21 cases comprise primitive7, root4, calendar6 and currency4. Canonical localized input coverage is run explicitly below at its correct discovered path.
- `node --import tsx --test --test-concurrency=1 tests/localized-number-presentation.test.ts tests/shared-document-catalogs.test.ts tests/shell-catalogs.test.ts`: **19/19 pass**, exit 0. These are distinct from the 21 cases above, totaling 40 distinct focused/scoped cases.
- `pnpm typecheck`: exit 0; actual `fumadocs-mdx && tsc --noEmit`, no full build.
- Owned `pnpm exec eslint` over the 16 changed primitive sources and new test: exit 0, zero warnings.
- `pnpm lint`: exit 0, zero errors and 20 pre-existing warnings.
- `pnpm i18n:check`: exit 0, 10,702 keys per locale, catalogs unchanged.
- `python .agentic/scripts/money_inventory.py --write` and `node --import tsx .agentic/scripts/verify_money_inventory.mjs`: 417 columns/1,865 final consumer hashes verified. Parsed schema_columns independently equal HEAD; no classification change.
- `node .agentic/scripts/verify_legacy_money.mjs`: all nine checks pass.
- Live `cua.getState()` after reading computer-use skill: `apps:[]`, `browsers:[]`. No mounted browser review was possible through this tool surface.
- Strict UTF-8, local source/exception links and frozen-file comparison pass; controller validation passes for 369 tasks. Final staged whitespace/scope is checked before commit.

## Test coverage, corrections and limitations

Seven new tests run actual installed Radix Content/provider/scopes and actual
application primitives, replacing only portal insertion for SSR. They cover
four language/numeral combinations, logical/physical Sheet side overrides,
nested/opposite directions, disabled/role/checked semantics, caller DOM ordering,
focus classes, universal X/check/search/ellipsis preservation and caller-provided
breadcrumb separator. Real Calendar previous/next handlers emit canonical
Gregorian month strings under default/after/around navigation and both
directions; range corner classes and selected ISO dates are preserved. Real
search input/clear callbacks preserve caller text. Exact negative int64 monetary
text remains unchanged under logical/physical alignment. Installed Tailwind
compilation proves emitted inline logical properties and override-safe self-dir
selectors; AvatarGroup's existing spacing already uses logical margins.

Initial test-only corrections: one parenthesis syntax error, brittle attribute
order assertions and unsupported Select forceMount fixture prop. Early runs
passed five/six of seven; corrected final run passes all seven. The original
transpiled Calendar harness loaded a heavy duplicate CommonJS locale graph; its
CPU-active runner was stopped, then the same real Calendar imported normally.
No production provider fallback or keyboard mock hides errors. No interrupted
run is reported as passing.

SSR/handler/CSS checks are not mounted browser or computed-layout proof. No
Tab/arrow interaction, focus visibility, overlap/clipping or native linguistic
qualification is claimed. DEC-005 removes screenshot/unavailable-browser
requirements as blockers, not later independent behavioral/layout review.
No build, dev startup, application database writes or provider-specific work.
Only task-owned paths will be committed; supervisor handles pair push.
