# Shared shell and navigation direction

## RTL-005 result and reported sidebar defect

The owner supplied a Persian dashboard screenshot with the sidebar fixed to the
left while the content had already adopted RTL. The actual cause was two
conflicting coordinate systems: `SidebarProvider`'s flex row reserves its first
child at RTL inline-start (right), but `Sidebar` defaulted to physical left.
Consequently the visible panel and its desktop reservation were on opposite
edges. This is repaired in the actual shared sidebar, not by reversing labels.

`Sidebar` now defaults to logical `start`: right in Persian, left in English.
The fixed container, border, offcanvas translation, resize rail and desktop gap
use the same resolved physical side. The provider propagates explicit/inherited
Radix direction and a matching native `dir`. A nonshrinking gap and `min-w-0`
flexible main keep content constrained to the remaining width. Collapsed icon
and offcanvas reservations retain their previous widths. Inset margins follow
the actual side rather than assuming left. The useless gap rotation is removed.

`start`/`end` follow local direction; explicit `left`/`right` stay physical.
When a physical/local override puts the panel at the provider's trailing edge,
only the gap's CSS order changes. Semantic DOM/tab order remains sidebar then
content; no array reversal, positive tabindex or whole-container mirror is used.
The mobile Sheet receives the same resolved side and direction, preserving its
actual Radix title/description, close/change semantics and existing focus code.

## Source and exception census

[20-source normalized hash census](RTL-005-shell-sources.json) records inspected
shared shell files. [Existing Sheet caller inventory](RTL-004-sheet-callers.json)
records 52 files/107 instances; this task reviews the sidebar and public-navbar
shell side overrides. Default module callers inherit RTL-004 logical end;
explicit module-specific sides and module grid/form/bidi design remain RTL-002.

| Family | Adopted or verified behavior |
| --- | --- |
| `components/ui/sidebar.tsx` | Paired physical panel/gap, logical default and override mapping, constrained main, mobile side, inward tooltip, direction-specific panel indicator, logical action/badge/submenu border and text. Rail arrows/resize cursor remain physical after resolution. |
| `components/dashboard/sidebar.tsx` | Project text and indentation use logical start/end. Closed project chevron points into flow, open chevron remains down; universal animated icons stay unchanged. |
| `components/dashboard/topbar.tsx`, `org-switcher.tsx`, `user-menu.tsx`, `notification-dropdown.tsx` | Logical shortcut margin, text/action alignment and badge placement; user menu opens toward main. Only navigation arrows mirror; Menu/Plus/notification/logo/status/account icons retain their shapes. |
| `components/dashboard/create-drawer.tsx` | All shared Sheet defaults inherit logical end; footer/heading flow already logical. Remaining Plus margins and budget-label padding are logical. No form, request, callback, amount or option changes. |
| `app/(dashboard)/layout.tsx`, command palette, page header | Existing flex/provider DOM and neutral flow preserved. Shared SidebarInset now constrains width without replacing the layout or its content container. Header gradient is decoration, not an indicator. |
| `components/admin/navigation.tsx`, admin layout | Existing first semantic sidebar follows inherited flex direction; logical inner border/margins and back arrows. Desktop/mobile route order, detail/back routing and permission-denied branch preserved. |
| `components/landing/navbar.tsx`, landing layout/footer | Public mobile menu uses logical end and forward arrows follow local direction. Link order, close callbacks, Menu/Logo/theme icons unchanged. Footer and outer layout already neutral/logical. |
| `app/(auth)/layout.tsx`, onboarding layout, not-found | Auth showcase border is logical; home/back navigation arrows follow direction. Existing form/grid semantic order preserved. Centering, orbital art, drawing coordinates, shimmer and symmetric container borders are intentionally physical decorations. |
| `app/portal/[token]/layout.tsx` | Header/tab order, flex flow, tab routes and semantic DOM already inherit root direction; no source edit or output changes needed. Portal module tables remain RTL-002. |
| `app/docs/layout.tsx` | Installed Fumadocs 16.6.8 already uses start/end sidebar insets/borders and direction-aware physical collapse transforms. RTL-003 supplies explicit matching RootProvider direction. Inspected installed index/sidebar sources; no vendor edit or mounted qualification implied. |

DEC-008 frozen `components/settings/billing-content.tsx`,
`app/(landing)/pricing/page.tsx`, `app/pay/[token]/page.tsx` and the entire mixed
`components/landing/feature-sections.tsx` source compare equal to HEAD. No
dedicated Stripe/provider file is changed. Provider-specific RTL qualification
or gaps do not block this shell task. Issued documents/PDF/print/email/saved
output retain their separate qualification and unchanged contracts.

## Verification and limits

Seven new real shell/primitive/provider tests exercise the English/Persian
panel/gap pairing; 360 desktop language/numeral/provider/local-side/collapse
combinations; 20 real mobile Sheet combinations; controlled trigger/rail and
cookie callbacks; inward tooltip/explicit tooltip-side override; actual admin
links/permission/order; and installed Tailwind CSS emission. Shared and shell
regressions preserve canonical IRR/int64/email strings, IDs, routes, escaped user
data, field/save callbacks and default output.

Compiled CSS proves the configured nonshrinking reservation, main min-width,
flex remainder, physical offcanvas edges, logical borders/alignment and visual
trailing placement rules. It is not computed browser geometry. SSR semantics,
DOM ordering, handler execution and focus-class checks are not mounted Tab,
arrow, focus visibility, collision, overflow/clipping or native language review.
Live CUA inventory after reading the skill returned `apps:[]`, `browsers:[]`;
no mounted browser/screenshot pass is claimed. No build, dev startup or database
write was run. RTL-001 retains independent combined layout/focus/icon acceptance;
RTL-002 retains module tables/forms/mixed identifiers/typography. Existing locale
preference REST/MCP tools continue to drive direction; no new operation is added.
