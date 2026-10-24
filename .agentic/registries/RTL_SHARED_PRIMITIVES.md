# Shared primitive direction boundary

RTL-004 audits all 51 `components/ui/*.tsx` sources. Root language/Radix
direction is supplied by RTL-003. Shell/sidebar behavior belongs to RTL-005;
module-specific forms/tables/bidi content belongs to RTL-002. RTL-001 retains
independent combined layout, keyboard order/visibility and icon acceptance.

## Adopted sources

| Source under `components/ui/` | Change and preserved contract |
| --- | --- |
| `accordion.tsx` | Logical text start; open-state vertical chevron rotation and focus ring unchanged. |
| `avatar.tsx` | Status badge at inline end; universal status icon unchanged. AvatarGroup's existing `space-x` already emits logical margins in installed Tailwind 4. |
| `breadcrumb.tsx` | Only default navigation chevron follows its own computed direction; caller separators and universal ellipsis stay unchanged. |
| `calendar.tsx` | Logical caption spacing and range corners, inherited/explicit Radix direction, directional navigation handled once for all installed navigation layouts. Locale/calendar/numerals/UTC selection contracts unchanged. |
| `command.tsx` | Shortcut margin at logical start; search icon, DOM order, cmdk filtering/keyboard implementation unchanged. |
| `currency-input.tsx` | Prefix padding at logical start. Actual numeric input remains explicit LTR/right-aligned; hidden value and decimal callback unchanged. |
| `currency-select.tsx` | Logical margins around indicators. Search terms, ISO values, disabled choices and callbacks unchanged. |
| `dialog.tsx` | Close control at logical end and desktop heading at logical start. Physical centering, mobile text centering, DOM/focus semantics unchanged. |
| `dropdown-menu.tsx` | Logical inset/checkbox/radio/shortcut placement and submenu arrow. Actual Radix root direction and explicit popper sides/animations remain authoritative. |
| `dual-amount.tsx` | Default/start/end alignment is logical; existing explicit left/right values now retain their documented physical alignment in either direction. Exact text and bidi isolation unchanged. |
| `search-input.tsx` | Leading search/trailing clear/loading layout uses logical properties; text and clear callbacks unchanged. |
| `select.tsx` | Selection indicator and its padding use logical end; vertical arrows and physical popper geometry unchanged. |
| `sheet.tsx` | Default `end` and optional `start` map through actual Radix direction to physical geometry/animation. Existing left/right/top/bottom overrides stay physical. Close control at logical end; no DOM reorder. |
| `switch.tsx` | Native dir follows actual Radix direction or explicit component override. Checked thumb moves toward logical end; state/value/change contract and focus ring unchanged. |
| `table.tsx` | Default heading start and checkbox spacing are logical. Explicit caller text-right/dir=LTR overrides remain available. Semantic row/cell order unchanged. |
| `tabs.tsx` | Vertical active line at logical end. Real Radix orientation/dir/disabled/roving-focus implementation and DOM order unchanged. |

## Direction and navigation details

Installed Tailwind's ordinary `rtl:` variant also matches any descendant of an
RTL ancestor. That would incorrectly mirror a directional icon/thumb in an
explicitly LTR subtree. Directional icon/thumb/physical-alignment variants here
use self `:dir(rtl)` instead, which respects the element's computed local
direction. No container-wide mirror or transform is introduced. Logical CSS
properties naturally respect the same local direction.

Installed DayPicker's default and `after` navigation pass physical left/right
Chevron orientations; `around` already resolves them using dir. Calendar maps
only the first family to the actual direction and leaves `around` orientations
alone. Removing the old blanket navigation rotation avoids double reversal.
The dropdown down-arrow, previous/next callbacks, selected dates, week/day DOM
order and keyboard implementation remain unchanged. Custom component and
className overrides are still accepted.

## Actual callers and intentional physical geometry

[Sheet caller inventory](RTL-004-sheet-callers.json) records all 52 caller files
and 107 instances, including their existing explicit side overrides. Default
callers inherit logical-end behavior automatically. Explicit sides in sidebar,
landing navbar, accounting/banking, invoice details and document templates remain
physical in this primitive task; RTL-005 owns shell/default-intent caller review,
RTL-002 owns module-specific adoption. No caller source is edited here.

Remaining physical primitive utility families are intentional:

- Dialog `left:50%` plus negative half-width translation centers physically.
- Popover/select/dropdown/tooltip side animations describe actual Radix popper
  collision sides, so left/right values remain physical. Logical align=start/end
  is resolved by Radix; explicit side overrides remain unchanged.
- Sheet uses physical geometry/animations only after resolving logical side.
- Currency input retains explicit LTR text-right numeric geometry.
- Switch uses positive/negative physical translation after local-direction
  resolution. Universal icons are never globally mirrored.
- AvatarGroup's negative horizontal spacing is already logical in installed
  Tailwind; actual emitted CSS is tested.
- `sidebar.tsx` and shell/custom navigation geometry are explicitly RTL-005.
- Remaining neutral primitives need no directional rewrite; focus and vertical
  geometry, universal/animated icon paths and physical drawing coordinates stay
  unchanged. Dedicated Stripe/provider and frozen billing/pricing/checkout/mixed
  reconciliation sources are untouched under DEC-008. Shared inheritance is not
  provider-specific qualification.

## Evidence and limits

[Task evidence](../evidence/RTL-004-attempt-1.md) records actual real-component
render/callback and installed-CSS compilation checks. Real Radix Content/scopes
are used with only portal insertion made inline for SSR. Canonical search/date/
amount/ISO callbacks and values, semantic order, disabled/role attributes and
existing focus classes are verified. These checks do not prove mounted Tab/arrow
behavior, computed overlap/visibility or focus visibility. Live CUA inventory
returned no browsers/apps; no screenshot, mounted browser, native review, build
or dev-server startup is claimed. RTL-001 keeps independent combined behavioral
review. In particular, the user's desktop sidebar gap/clipping report remains
assigned to the next fresh RTL-005 agent, not fixed by this task.
