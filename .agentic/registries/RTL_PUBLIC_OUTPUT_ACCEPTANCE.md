# RTL-011 public/admin/output integration acceptance

Audit baseline: `684a0d0faa47dc701b7073451c7dcd3ea02922f4`, 2026-10-25 through 2026-10-26.
This is the independent technical integration record for RTL-011, not the native
linguistic, mounted browser, accounting, email-client or Persian PDF release gate.
See [actual evidence](../evidence/RTL-011-attempt-1.md) and
[self-review](../evidence/RTL-011-review-1.md). Source ownership remains authoritative
in [RTL_MODULE_OWNERSHIP.json](RTL_MODULE_OWNERSHIP.json).

## Exhaustive reconciliation

The current app/components/lib census has no unowned TSX, no duplicate entries and
no missing assigned file. Exactly 135 entries belong to RTL-022 through RTL-029:
4 authentication, 9 administration, 3 onboarding, 35 public/shell, 9 portal/signing,
14 settings/import, 53 primitives/hook, and 8 email/PDF. Existing child file-by-file
dispositions remain evidence, while the parent independently reruns their actual
production-component/callback/CSS regressions together with the shared provider,
root direction, typography and cross-surface financial fixture tests. No source
repair was necessary during this combined acceptance.

| Owner | Files | Current direct component regression | Detailed source dispositions |
|---|---:|---|---|
| RTL-022: Authentication and consent | 4 | [production regression](../../tests/rtl-auth-consent.test.ts) | [file audit](../evidence/RTL-022-attempt-1.md) |
| RTL-023: Administration | 9 | [production regression](../../tests/rtl-admin.test.ts) | [file audit](../evidence/RTL-023-attempt-1.md) |
| RTL-024: Onboarding | 3 | [production regression](../../tests/rtl-onboarding.test.ts) | [file audit](../evidence/RTL-024-attempt-1.md) |
| RTL-025: Public marketing, legal, docs and shells | 35 | [production regression](../../tests/rtl-marketing.test.ts) | [file audit](../evidence/RTL-025-attempt-1.md) |
| RTL-026: Customer portals and signing | 9 | [production regression](../../tests/rtl-public-portals.test.ts) | [file audit](../evidence/RTL-026-attempt-1.md) |
| RTL-027: Shared settings and import controls | 14 | [production regression](../../tests/rtl-shared-settings.test.ts) | [file audit](../evidence/RTL-027-attempt-1.md) |
| RTL-028: UI primitives and confirmation hook | 53 | [production regression](../../tests/rtl-confirm-controls.test.ts) | [file audit](../evidence/RTL-028-attempt-1.md) |
| RTL-029: Email and document outputs | 8 | [production regression](../../tests/rtl-output.test.ts) | [file audit](../evidence/RTL-029-attempt-1.md) |

## Preserved contracts and exceptions

- App mixed caller text uses native `bdi`/BidiText with auto direction; technical
  identifiers use explicit LTR IdentifierText, selectable text and exact escaping.
  Isolation adds markup/CSS rather than invisible controls or changes to data.
- Credential, raw HTML/JSON/CSV/code, email, URL, ISO, hex and identifier inputs
  intentionally retain LTR technical order; freely entered names/notes use auto
  direction. Local direction differs from root reading direction by design.
- Root HTML, PresentationProvider, Radix and Fumadocs inherit resolved language
  direction independently of selected numerals. Explicit local overrides remain.
- Existing server-only auth/redirect/composition delegates, framework/native
  primitives, logo/icon geometry and symmetric decorative animation stay intact.
  Chart chronology, pointer canvas coordinates, device-pixel-ratio scaling and
  terminal/code syntax remain physical/technical rather than being mirrored.
- Portal document values, issued party snapshots, download/signing payloads,
  accepted/denied status paths, template `srcDoc`, machine CSV/JSON bytes and
  exact-money DTOs retain their existing contracts. The combined financial
  fixture traverses actual portal/signature JSX, HTML, document email and digest
  with USD/IRR/JPY/KWD and a safe-integer maximum while alternating languages.
- `lib/documents/pdf-generator.ts` is the imported non-TSX HTML builder owned with
  RTL-029; it emits escaped native bidi scopes and logical/wrapping layout.
  `lib/email/render-document-email.ts`, document render-wire/service, source/MDX
  lookup and other unchanged consumer builders retain the child audit boundaries.
- React Email uses self-contained inline isolation, explicit technical direction,
  wrapping and locale-selected physical left/right fallback because web-app
  Tailwind utilities do not travel with email. Browser CSS proof is not substituted
  for an email-client rendering pass.
- The legacy React-PDF path remains **English labels and Helvetica**. Actual binary
  generation and exact data conversion pass; this does not establish Persian font
  coverage, glyph shaping, selectable mixed-script order, pagination or visual
  correctness. This is an explicit implementation exception, not a PDF pass.
  [L10N-011](../tasks/L10N-011.md) owns embedding the licensed Persian font,
  native-script financial output and actual human document review.
- Frozen `app/pay/[token]/page.tsx` and `components/settings/billing-content.tsx`
  count in their assigned audit ownership but are unchanged exceptions under
  DEC-008. `components/settings/stripe-integration-card.tsx` remains the separately
  frozen owner. Provider-specific admin/pricing/legal subtrees are preserved by
  the child source audits; no dedicated Stripe work or provider qualification
  is performed or made blocking.

## Qualification retained by other gates

DEC-005 removes screenshot requirements and forbids using unavailable browser
helpers as a continuation blocker; it does not manufacture a browser/native pass.
Actual mounted focus/caret/selection, keyboard/assistive-technology behavior,
computed clipping at widths/zoom/text spacing, reduced motion, and old email-client
layout are unrun. Runtime components/callbacks and installed CSS declarations are
technical evidence of implementation only. Native Persian terminology/accounting
review stays with L10N-001/L10N-012 and the financial QA/release process. Persian
PDF remains L10N-011/PDF-01, explicitly NOT RUN; no snapshot is rewritten and no
release/production IRR switch is activated.

The higher [RTL-008](../tasks/RTL-008.md) and [RTL-002](../tasks/RTL-002.md) combined
acceptance remains unchecked. They must reuse these truthful limits rather than
count child or parent status as mounted/native/output qualification. Other domain
ownership, all REST/MCP operations, schema/migrations and machine export contracts
are unchanged; no new operation or database fixture is needed for this audit.

## Continuation snapshot

Owner-authored commit `c01b07a26939e84ca266959ec11388da899b800a` arrived during
the usage-limit interruption and is retained unchanged. None of the 135 assigned
TSX sources changed; shared docs-width CSS and adjacent dashboard/contact/sidebar
changes received a bounded current 31-test regression and scoped lint run. The
initial 193-test combined result remains accurately identified with its snapshot.
The final evidence records post-owner TypeScript and the source-only money
inventory refresh. Local owner inspection scripts/assets are preserved, not
claimed as executed visual/browser qualification.

## Every assigned census path

Each row is an audit responsibility, not an assertion that the file needed edits
or that a native/output exception passed. The group proof and detailed source
disposition above apply to each listed file; exceptions are explicit above.

| Owner | Assigned source |
|---|---|
| RTL-023 | `app/(admin)/admin/email-preview/page.tsx` |
| RTL-023 | `app/(admin)/admin/layout.tsx` |
| RTL-023 | `app/(admin)/admin/organizations/[id]/page.tsx` |
| RTL-023 | `app/(admin)/admin/organizations/page.tsx` |
| RTL-023 | `app/(admin)/admin/page.tsx` |
| RTL-023 | `app/(admin)/admin/settings/page.tsx` |
| RTL-023 | `app/(admin)/admin/users/page.tsx` |
| RTL-022 | `app/(auth)/layout.tsx` |
| RTL-022 | `app/(auth)/mcp-authorize/page.tsx` |
| RTL-022 | `app/(auth)/sign-in/page.tsx` |
| RTL-022 | `app/(auth)/sign-up/page.tsx` |
| RTL-025 | `app/(landing)/layout.tsx` |
| RTL-025 | `app/(landing)/page.tsx` |
| RTL-025 | `app/(landing)/pricing/page.tsx` |
| RTL-025 | `app/(landing)/privacy/page.tsx` |
| RTL-025 | `app/(landing)/terms/page.tsx` |
| RTL-024 | `app/(onboarding)/layout.tsx` |
| RTL-024 | `app/(onboarding)/onboarding/page.tsx` |
| RTL-025 | `app/docs/[[...slug]]/page.tsx` |
| RTL-025 | `app/docs/layout.tsx` |
| RTL-025 | `app/layout.tsx` |
| RTL-025 | `app/not-found.tsx` |
| RTL-026 | `app/pay/[token]/page.tsx` |
| RTL-026 | `app/portal/[token]/invoices/page.tsx` |
| RTL-026 | `app/portal/[token]/layout.tsx` |
| RTL-026 | `app/portal/[token]/page.tsx` |
| RTL-026 | `app/portal/[token]/payments/page.tsx` |
| RTL-026 | `app/portal/[token]/quotes/page.tsx` |
| RTL-026 | `app/portal/[token]/statements/page.tsx` |
| RTL-026 | `app/sign/[token]/page.tsx` |
| RTL-026 | `app/sign/[token]/signature-canvas.tsx` |
| RTL-023 | `components/admin/navigation.tsx` |
| RTL-023 | `components/admin/site-settings-form.tsx` |
| RTL-027 | `components/bulk-import-wizard.tsx` |
| RTL-025 | `components/landing/bento-features.tsx` |
| RTL-025 | `components/landing/cta-section.tsx` |
| RTL-025 | `components/landing/dashboard-preview.tsx` |
| RTL-025 | `components/landing/faq.tsx` |
| RTL-025 | `components/landing/feature-sections.tsx` |
| RTL-025 | `components/landing/footer.tsx` |
| RTL-025 | `components/landing/gradient-background.tsx` |
| RTL-025 | `components/landing/hero.tsx` |
| RTL-025 | `components/landing/how-it-works.tsx` |
| RTL-025 | `components/landing/integrations.tsx` |
| RTL-025 | `components/landing/navbar.tsx` |
| RTL-025 | `components/landing/open-source.tsx` |
| RTL-025 | `components/landing/testimonials.tsx` |
| RTL-025 | `components/landing/trust-bar.tsx` |
| RTL-025 | `components/legal/legal-page-layout.tsx` |
| RTL-025 | `components/legal/legal-toc.tsx` |
| RTL-024 | `components/onboarding/onboarding-wizard.tsx` |
| RTL-027 | `components/settings/api-key-fields.tsx` |
| RTL-027 | `components/settings/approval-condition-help.tsx` |
| RTL-027 | `components/settings/audit-activity-text.tsx` |
| RTL-027 | `components/settings/billing-content.tsx` |
| RTL-027 | `components/settings/cost-center-delete-description.tsx` |
| RTL-027 | `components/settings/data-management-content.tsx` |
| RTL-027 | `components/settings/document-template-content.tsx` |
| RTL-027 | `components/settings/locale-preferences.tsx` |
| RTL-027 | `components/settings/notification-preferences-form.tsx` |
| RTL-027 | `components/settings/procurement-settings-form.tsx` |
| RTL-027 | `components/settings/reminder-template-fields.tsx` |
| RTL-027 | `components/settings/role-permission-fields.tsx` |
| RTL-027 | `components/settings/tag-fields.tsx` |
| RTL-025 | `components/shared/animated-counter.tsx` |
| RTL-025 | `components/shared/container.tsx` |
| RTL-025 | `components/shared/grid-background.tsx` |
| RTL-025 | `components/shared/hero-background.tsx` |
| RTL-025 | `components/shared/logo.tsx` |
| RTL-025 | `components/shared/orbital-decoration.tsx` |
| RTL-025 | `components/shared/scroll-reveal.tsx` |
| RTL-025 | `components/shared/section-header.tsx` |
| RTL-025 | `components/shared/theme-provider.tsx` |
| RTL-025 | `components/shared/theme-toggle.tsx` |
| RTL-028 | `components/ui/accordion.tsx` |
| RTL-028 | `components/ui/arrow-left-right-animated.tsx` |
| RTL-028 | `components/ui/avatar.tsx` |
| RTL-028 | `components/ui/badge.tsx` |
| RTL-028 | `components/ui/bidi-text.tsx` |
| RTL-028 | `components/ui/blur-reveal.tsx` |
| RTL-028 | `components/ui/breadcrumb.tsx` |
| RTL-028 | `components/ui/button-3d.tsx` |
| RTL-028 | `components/ui/button.tsx` |
| RTL-028 | `components/ui/calendar.tsx` |
| RTL-028 | `components/ui/card.tsx` |
| RTL-028 | `components/ui/cart.tsx` |
| RTL-028 | `components/ui/chart-line.tsx` |
| RTL-028 | `components/ui/checkbox.tsx` |
| RTL-028 | `components/ui/circle-help.tsx` |
| RTL-028 | `components/ui/collapsible.tsx` |
| RTL-028 | `components/ui/command.tsx` |
| RTL-028 | `components/ui/content-reveal.tsx` |
| RTL-028 | `components/ui/currency-input.tsx` |
| RTL-028 | `components/ui/currency-select.tsx` |
| RTL-028 | `components/ui/date-picker.tsx` |
| RTL-028 | `components/ui/dialog.tsx` |
| RTL-028 | `components/ui/dropdown-menu.tsx` |
| RTL-028 | `components/ui/dual-amount.tsx` |
| RTL-028 | `components/ui/file-text.tsx` |
| RTL-028 | `components/ui/folder-open.tsx` |
| RTL-028 | `components/ui/gauge.tsx` |
| RTL-028 | `components/ui/hand-coins.tsx` |
| RTL-028 | `components/ui/input.tsx` |
| RTL-028 | `components/ui/label.tsx` |
| RTL-028 | `components/ui/landmark-animated.tsx` |
| RTL-028 | `components/ui/layers.tsx` |
| RTL-028 | `components/ui/percent-animated.tsx` |
| RTL-028 | `components/ui/popover.tsx` |
| RTL-028 | `components/ui/rate-note.tsx` |
| RTL-028 | `components/ui/receipt-animated.tsx` |
| RTL-028 | `components/ui/search-input.tsx` |
| RTL-028 | `components/ui/select.tsx` |
| RTL-028 | `components/ui/separator.tsx` |
| RTL-028 | `components/ui/settings.tsx` |
| RTL-028 | `components/ui/sheet.tsx` |
| RTL-028 | `components/ui/sidebar.tsx` |
| RTL-028 | `components/ui/skeleton.tsx` |
| RTL-028 | `components/ui/sonner.tsx` |
| RTL-028 | `components/ui/stagger.tsx` |
| RTL-028 | `components/ui/switch.tsx` |
| RTL-028 | `components/ui/table.tsx` |
| RTL-028 | `components/ui/tabs.tsx` |
| RTL-028 | `components/ui/target.tsx` |
| RTL-028 | `components/ui/textarea.tsx` |
| RTL-028 | `components/ui/tooltip.tsx` |
| RTL-028 | `components/ui/users-animated.tsx` |
| RTL-029 | `lib/documents/pdf-renderer.tsx` |
| RTL-029 | `lib/email/templates/document-sent.tsx` |
| RTL-029 | `lib/email/templates/layout.tsx` |
| RTL-029 | `lib/email/templates/login-alert.tsx` |
| RTL-029 | `lib/email/templates/member-invite.tsx` |
| RTL-029 | `lib/email/templates/notification-digest.tsx` |
| RTL-029 | `lib/email/templates/org-created.tsx` |
| RTL-029 | `lib/email/templates/welcome.tsx` |
| RTL-028 | `lib/hooks/use-confirm.tsx` |
