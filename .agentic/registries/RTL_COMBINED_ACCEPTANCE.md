# RTL-001 independent combined acceptance

Reviewer: codex-task-012, 2026-10-25. Baseline: `36597677`.
This is an independent source, installed-runtime, actual-component and compiled
CSS review after RTL-003/004/005, not an inference from their completion states.
[74-source census](RTL-001-source-audit.json) records final normalized hashes,
directional transforms, visual order exceptions and positive-tabindex findings.
It covers all 51 UI primitive sources, the shared shell census and root sources.

## Acceptance observations

| Criterion | Independently reviewed evidence and result |
| --- | --- |
| English/Persian layout and behavior | Actual root, nested Fumadocs/Radix scopes, shared primitives and real AppSidebar composition execute under both languages and independent numeral preferences. Root direction is resolved before serialization. Logical CSS respects local direction. Installed Tailwind emits paired sidebar reservation, fixed physical edge, constrained main, logical borders, drawer geometry and local-direction icon/thumb selectors. Persian defaults to right panel plus right gap; English defaults left plus left gap. Expanded, offcanvas, icon-collapse, mobile and explicit physical/local overrides retain callback and canonical contracts. |
| Logical and visible keyboard focus | Census finds no positive tabindex or blanket DOM reversal. Shared shell DOM remains navigation before main; fields and actions retain their semantic order. Installed Radix roving-focus resolver is executed for RTL/LTR horizontal arrows, vertical arrows and Home/End. The actual installed FocusScope renders with real React; its captured Tab callback executes against explicit modeled DOM services, filtering disabled, hidden-input, hidden and display-none controls, looping first/last in DOM order in either direction and preserving modified keys. Existing controls retain focus-ring/accent styles. This independent review found keyboard-focusable TabsContent removed its outline without replacement: it now has an explicit keyboard-only ring and offset, verified in actual tabpanel output and installed Tailwind `:focus-visible` CSS. |
| Universal icons are not mirrored | Source census and actual rendered root/primitive/shell examples show no whole-container/icon mirror. Navigation/back/breadcrumb/submenu arrows alone use local `:dir(rtl)` rotation; calendar arrows resolve once against installed DayPicker. Vertical accordion/project expansion and decorative tooltip rotations keep their original meanings. Check, Search, Menu, Plus, account/status, logos and caller separators remain unchanged. |

## Independent finding and repair

`components/ui/tabs.tsx` previously rendered `TabsContent` with only
`flex-1 outline-none`. Installed Radix makes the active panel keyboard-focusable
with `tabIndex=0`; this suppressed its focus indication. Add rounded keyboard
focus ring, ring color and offset without changing focusability, IDs, DOM,
selection, keyboard behavior or caller overrides. The regression checks both
languages and both numeral preferences, escaped caller text, raw ISO and icon
contracts. No financial, database, route or REST/MCP operation is changed.

## Evidence boundary under DEC-005

The task's reviewed implementation/layout/accessibility criteria are accepted
from final source, actual rendered component semantics/callbacks, compiled CSS
and independently executed installed keyboard algorithms. This is more than
child statuses or SSR alone. The DOM services in the FocusScope test are modeled:
the test does not measure a browser's computed visibility or dispatch native
keyboard events. CUA was checked afresh after reading the computer-use skill;
it returned `apps:[]`, `browsers:[]`. No screenshot, mounted browser, computed
clipping/collision/focus visibility, screen-reader, native linguistic or WCAG
certification is claimed. DEC-005 explicitly removes unavailable browser helpers
as task blockers; it does not turn these checks into browser evidence.

RTL-002 owns module forms/tables, mixed identifiers, long text, zoom/text-spacing
and typography. Later QA/native/output qualification remains independent.
The user's observed sidebar mismatch was traced to the real physical-vs-logical
edge disagreement and repaired by RTL-005; combined tests reproduce its exact
panel/gap contract, but its final visual appearance was not observed in a browser.

## Preserved exceptions and interfaces

- Physical dialog centering and resolved popper collision/animation sides stay
  physical. Logical sides resolve before sheet/sidebar physical geometry.
- Explicit caller left/right and local direction overrides remain available.
  Sidebar trailing-edge overrides adjust only gap visual order, not semantic DOM.
- Numeric input remains explicitly LTR; canonical ISO, int64, email, IDs, routes,
  selected dates, raw input/change/save and default document/email outputs remain.
- The existing locale preference REST/MCP operations control language; direction
  is derived, so no new operation or tool is required.
- DEC-008 dedicated Stripe/provider and frozen billing/pricing/checkout/mixed
  reconciliation sources remain unchanged. No provider-specific qualification.
- All 417 money classifications compare equal to baseline; the money inventory
  adds only the new acceptance-test consumer hash.

Commands and honest run details are in [task evidence](../evidence/RTL-001-attempt-1.md).
