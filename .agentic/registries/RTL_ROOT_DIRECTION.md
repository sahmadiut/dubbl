# Root direction foundation

## RTL-003 implemented boundary

The active resolved language is the single structural direction source:
`fa-IR` maps to `rtl`, `en-US` to `ltr`. Numerals, calendar, time zone and
font preferences remain independent. The existing serialized `Presentation`
shape, locale precedence, saved preferences and REST/MCP contracts do not change.

| Source | Implemented behavior |
| --- | --- |
| `i18n/locale.ts` | `localeDirection` derives the supported reading direction from language. |
| `i18n/provider.tsx` | The actual installed Radix Direction provider wraps translated children; explicit primitive/nested overrides remain available. No wrapper DOM or reordering is added. |
| `app/layout.tsx` | Server-resolved `html lang/dir`, matching nested Fumadocs direction and matching notification direction/position. No client post-mount direction flip. |

Fumadocs supplies its own nested Radix DirectionProvider with a default of LTR.
Passing `dir` there is necessary even with the outer PresentationProvider;
otherwise real application primitives below it silently return to LTR. The
root regression executes the actual root JSX and installed Fumadocs base
provider, with framework request/navigation/font/session I/O controlled.

Global notifications retain bottom-right in English and use bottom-left in
Persian (logical end). Direction is passed explicitly rather than relying on
Sonner's browser auto-detection. Root native language/dir and Radix direction
agree on the initial server response and serialized render.

## Verification and preserved behavior

`tests/rtl-root-direction.test.ts` exercises actual Tabs/Select/provider output,
explicit opposite-direction overrides, nested scopes, independent numeral
preferences, server root composition and serialization. It preserves canonical
IRR/int64/id/email strings, semantic First/Last DOM ordering, existing focus
classes, and universal search/check icons. It does not simulate mounted browser
Tab/arrow events or claim computed layout, focus visibility or native review.

Existing locale, date/calendar, localized number input, currency labels,
shell/navigation and public/document/email regression suites retain their
original canonical callback/output assertions. No endpoint, operation, schema,
money amount, route, ID, user data, technical ISO code or issued snapshot changes.
The existing `get_locale_preferences`/`update_locale_preferences` and organization
language operations continue to control language; direction is derived, not a
new setting or tool. No new MCP operation is required.

## Remaining ownership and explicit exceptions

- RTL-004 owns logical CSS, flow indicators/chevrons, shared drawer defaults and
  shared primitive layout/behavior. Existing physical styles are not qualified
  by this root-only change. Inherently physical centering and actual popover-side
  animation contracts require case-by-case review there.
- RTL-005 owns shared sidebar and dashboard/admin/public/docs/auth shell and
  custom drawer callers, including logical shell animation/geometry.
- RTL-001 remains an independent combined English/Persian behavior/layout,
  keyboard order/visibility and directional-icon acceptance task. Child status
  and SSR assertions alone do not satisfy that review.
- RTL-002 owns module forms/tables, typography and mixed identifiers.
- DEC-005 removes screenshots and unavailable browser helpers as blockers;
  actual later behavioral/layout/accessibility and native review still apply.
- DEC-008 frozen dedicated Stripe/provider files, subscription/billing/pricing
  labels, checkout page and mixed reconciliation example are unchanged. Global
  root direction is a shared locale foundation, not dedicated provider work.
- Printed/issued document, PDF, email and saved-output direction contracts are
  unchanged and retain their separate qualification tasks.
