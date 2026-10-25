# RTL-028 remaining UI primitives and confirmations

## Identity and scope

Codex, 2026-10-25, master baseline affcf50d8502bffcc2c559be3e0d65275c225ca3; clean tree and empty staging at selection. Controller validate/status/context/next selected RTL-028 with both dependencies done. This is the first task of a two-task owner-authorized batch; commit locally and leave push to the next fresh agent. The owner's approved prior dashboard commit is preserved. Ownership registry assigns exactly 53 files below; audit reuse does not claim every file needed edits.

## Exhaustive ownership audit

Paths in this table are under components/ui/ except the explicitly named hook. Unchanged decorative geometry is not mirrored automatically: its universal object/graph meaning and animation/ref contracts are retained. Consumer controls own their accessible names and meaning.

| Assigned file | Observed result and disposition |
|---|---|
| accordion.tsx | Existing Radix trigger, logical start alignment, focus ring and nonshrinking downward disclosure icon retained; caller children and controlled expansion unchanged. |
| arrow-left-right-animated.tsx | Unchanged decorative bidirectional transfer glyph; both physical arrows, imperative start/stop refs and animation coordinates retain meaning. |
| avatar.tsx | Unchanged Radix image/fallback and logical end badge; installed Tailwind 4 space-x overlap already emits logical margin-inline-end (existing runtime CSS regression), so no reversal patch. |
| badge.tsx | Unchanged inline status badge, explicit compact nowrap and caller class overrides; enclosing module owns long status layout. |
| bidi-text.tsx | Existing isolated auto-direction BidiText and selectable LTR IdentifierText reused unchanged; preserves exact escaped caller bytes and explicit dir. |
| blur-reveal.tsx | Unchanged nested decorative animation wrapper; vertical motion has no reading direction. This task does not claim reduced-motion qualification. |
| breadcrumb.tsx | Item can shrink and break long tokens; existing nav name, logical separator mirroring, aria-current and caller separator remain unchanged. |
| button-3d.tsx | Unchanged native/Slot action with explicit caller semantics, focus/disabled styling and vertical pressed geometry; caller layout/class override retained. |
| button.tsx | Unchanged native/Slot foundation with loading/busy/disabled semantics; confirmation uses scoped wrapping overrides rather than changing every button's fixed size. |
| calendar.tsx | Existing qualified direction/locale/numeral/calendar, physical previous/next, range rounding, UTC canonical dates and focus foundation retained. Actual navigation callbacks remain covered. |
| card.tsx | Title/description can shrink and wrap unbroken caller content; grid action slot, footer, order and arbitrary children unchanged. |
| cart.tsx | Unchanged decorative cart geometry and hover/imperative animation callbacks. |
| chart-line.tsx | Unchanged decorative chart axes/trend geometry; no data/time axis inversion inferred from reading direction. |
| checkbox.tsx | Unchanged Radix checkbox, named consumer responsibility, focus/disabled/controlled state and universal check glyph. |
| circle-help.tsx | Unchanged decorative universal help glyph and animation/ref callbacks. |
| collapsible.tsx | Existing Radix state/trigger/content wrapper retained; content collapse overflow is intentional animation containment. |
| command.tsx | Named search input defaults to auto direction, accepts explicit name/direction and can shrink; items can wrap long tokens; LTR isolated nonshrinking shortcut retains original Ctrl/key bytes. Root filtering, item value/onSelect and order unchanged. |
| content-reveal.tsx | Unchanged vertical decorative reveal, arbitrary children and class contract. |
| currency-input.tsx | Qualified localized draft/prefix and hidden canonical value retained, native input stays LTR, fractions and malformed-input rejection unchanged; actual number/domain regressions cover values. |
| currency-select.tsx | Existing localized label/isolation, logical check margin, canonical ISO search/value/onSelect and disabled guards retained; no fetch/cache or selection semantics changed. |
| date-picker.tsx | Explicit non-submit trigger; isolated shrinking date/placeholder display. Gregorian date-only callback, selected calendar/timezone, open/close flow and caller placeholder unchanged. |
| dialog.tsx | Titles/descriptions shrink/wrap long copy. Physical centered coordinates intentionally retained; close remains logical end, universal X, focus and Radix dialog semantics unchanged. |
| dropdown-menu.tsx | Shortcut is LTR isolated and nonshrinking; existing logical indicators/padding, resolved physical submenu geometry, item callbacks/roles/order remain unchanged. |
| dual-amount.tsx | Qualified isolated exact bigint money and logical/explicit physical alignment retained; low digits and signed int64 values remain covered. |
| file-text.tsx | Unchanged decorative document glyph and animation geometry/ref callbacks. |
| folder-open.tsx | Unchanged decorative folder glyph and animation geometry/ref callbacks. |
| gauge.tsx | Unchanged decorative physical gauge/needle geometry and hover/ref callbacks. |
| hand-coins.tsx | Unchanged decorative hand/coins glyph, physical geometry and hover/ref callbacks. |
| input.tsx | Existing qualified email/URL LTR defaults and explicit direction override retained. Generic free text defaults stay consumer-owned; search adds its auto direction. |
| label.tsx | Existing Radix/native label association and focus/disabled consumer contract retained. |
| landmark-animated.tsx | Unchanged decorative building glyph and imperative animation callbacks. |
| layers.tsx | Unchanged decorative stack glyph and hover/ref animation callbacks. |
| percent-animated.tsx | Unchanged universal percent glyph and imperative animation geometry. |
| popover.tsx | Existing Radix content/anchor alignment, trigger-width sizing and scroll-lock-safe ref retained; physical side animations follow resolved Radix placement. |
| rate-note.tsx | Explicit selected locale/numerals replace ambient runtime formatting; existing rate / 1000000 calculation and max-six-fraction precision remain. Isolated rate/currency equation and exact raw LTR effective date; missing-rate scope isolated, link unchanged. No status/date or rate data changes. |
| receipt-animated.tsx | Unchanged decorative receipt glyph and imperative animation geometry. |
| search-input.tsx | Named auto-direction search, optional explicit aria-label; clear is type=button inside forms. Actual raw change and empty-string clear callbacks, ref/value, loading state and logical adornments retained. |
| select.tsx | Qualified Radix direction/context, logical indicator/padding, selected value, keyboard implementation and portal placement retained; caller controls truncation/labels. |
| separator.tsx | Existing semantic orientation/decorative Radix primitive unchanged; physical height/width is orientation rather than reading direction. |
| settings.tsx | Unchanged decorative gear geometry and hover/ref animation callbacks. |
| sheet.tsx | Title/description shrink and break long tokens; existing logical start/end resolution, physical side overrides, close focus and caller order retained. |
| sidebar.tsx | Existing qualified direction provider, logical placement/physical panel resolution, toggles/cookie and mobile/desktop semantics retained; its physical edge classes deliberately match resolved edge. |
| skeleton.tsx | Unchanged decorative loading box; no user text or direction-sensitive geometry. |
| sonner.tsx | Existing localized notification/close names and installed Sonner direction handling retained; caller toast options/props and icon semantics preserved. No new toast operation. |
| stagger.tsx | Unchanged decorative vertical CSS stagger and exact caller index/children. |
| switch.tsx | Existing direction-context-aware thumb and explicit override retained; boolean state/callback and universal control meaning unchanged. |
| table.tsx | Existing local horizontal scrolling, logical headings/checkbox padding and explicit physical total overrides retained; cells keep module-defined compact layout. |
| tabs.tsx | Existing Radix direction, orientation, focus styles, logical active indicator and controlled values/order retained. |
| target.tsx | Unchanged decorative target geometry and hover/ref animation callbacks. |
| textarea.tsx | Free text defaults to auto direction, caller explicit technical LTR/other direction wins; native value/onChange/name/form contract unchanged. |
| tooltip.tsx | Content bounded by viewport/rem width and breaks long tokens; portal, resolved physical side animations, delay/trigger and arrow geometry unchanged. |
| users-animated.tsx | Unchanged decorative universal users glyph, scale animation and imperative ref contract. |
| lib/hooks/use-confirm.tsx | Three translated defaults, exact isolated caller labels/title/description, wrapping bounded-height actions and non-submit button semantics. Existing cancel=false, confirm=true, async success, rejected retry/loading, dismissal guard and resolver/state logic unchanged. |

No dedicated Stripe source, REST/MCP, schema, database, output template, canonical currency/date/value or accounting algorithm is modified. Presentation repairs introduce no operation requiring a new MCP tool. RTL-011/008/002 retain independent integration acceptance. The three paired SharedUI keys raise catalogs from 10720 to 10723 leaves; whole-catalog fixture is reconciled in this change. New Persian defaults have UTF-8 Persian-script assertions; native linguistic approval remains separate.

## Acceptance mapping

1. All 53 assigned entries are accounted for above, distinguishing reusable foundations, object geometry, native/framework behavior and changed controls; caller, rate units, canonical date/ISO and callback contracts are preserved.
2. Actual hook/component regressions exercise promise cancellation, success, rejected async retry, raw caller search/clear values and escaped long mixed text across en-US/fa-IR x latn/arabext. Existing Calendar, dialogs, menus, sheets, tables, inputs, sidebar, exact money and provider tests pass. Installed CSS proves long-token wrapping, isolated shortcuts, shrink behavior, responsive action wrap, tooltip bounds and already-logical avatar overlap.
3. This record states every owned file and explicitly retains native/browser/output/accounting limits and parent acceptance. DEC-005 removes screenshot requirements; DEC-008 keeps Stripe unchanged and nonblocking.

## Actual verification

- `node --import tsx --test --test-concurrency=1 tests/rtl-confirm-controls.test.ts tests/rtl-primitives.test.ts tests/rtl-bidi-controls.test.ts tests/shell-catalogs.test.ts tests/currency-domain-presentation.test.ts tests/whole-catalog-integration.test.ts`: final **32/32 pass**, exit 0. Final required execution used sandbox escalation after a child-process spawn EPERM. One earlier escalation call waited for approval and was aborted without running; no bypass or false result is claimed.
- The first test run had 30/32 pass: a new CSS test assumed literal min-width:0 rather than installed spacing calculation; corrected its assertion and supplied breakpoint theme. Old shell rate assertion assumed Latin decimal glyphs; corrected it to derive the actual selected presentation. Final run above has no failures/skips/cancellations. All four new meaningful tests exercise production source with actual provider; hook test controls only hook state scheduling/portal mounting and captures actual returned callbacks. Real focus/painting is unqualified.
- `pnpm typecheck`: pass, exit 0 (fumadocs-mdx and tsc).
- Scoped `pnpm exec eslint` on all twelve changed sources, the new regression and two adjusted catalog tests: final pass, exit 0. Hook test uses one narrowly documented globals-rule suppression for instrumenting returned callbacks; no product suppression.
- `pnpm lint`: pass, zero errors and 20 existing unrelated warnings. Initial scoped harness assignments were corrected; final scoped lint confirms no new issue.
- `pnpm i18n:check`: pass, 10723 paired keys; explicit new Persian-script assertion passes.
- `node --import tsx .agentic/scripts/verify_legacy_money.mjs`: all nine regression checks pass.
- `python .agentic/scripts/money_inventory.py --write` and `node --import tsx .agentic/scripts/verify_money_inventory.mjs`: pass, 417 columns and 1886 consumer source hashes/occurrence lines. Only lexical source metadata refresh, no schema/data changes; MONEY_COLUMNS has no content diff.
- `git diff --check`: pass. Controller validate passes all 415 tasks at entry; final completion validation is recorded with controller state.

## Review and handoff

Codex self-review is permitted by current START_HERE step 6 and CONTROLLER for this human_review=false task. Separate review evidence records findings. No human, peer or native reviewer is impersonated. No full build, dev startup, application database mutation, Stripe work, screenshot, production/IRR activation or deployment occurred. Mounted browser keyboard/AT, pixel clipping/zoom/selection/caret, reduced motion, native Persian, real PDFs/email/printing and accounting qualification remain unverified. Screenshot waiver does not substitute for those checks. Commit this task locally; parent delegates the next controller task to a fresh agent, which performs the second commit and batch push.
