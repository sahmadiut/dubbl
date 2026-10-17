# Shared shell and UI catalog extraction

LOC-011 implements the shared-shell slice of LOC-006. LOC-006 and LOC-002 remain
independent integration parents. All new Persian wording, including financial
navigation terms, is **provisional** pending native L10N review. No key is claimed
linguistically approved. Full RTL and presentation-adapter acceptance remain separate.

## Source and key inventory

The bounded source audit covers 85 TSX files: 23 generic/dashboard-shell components,
all `components/ui/*.tsx`, all `components/shared/*.tsx` and `app/not-found.tsx`.
Pure visual primitives and caller-text-only components need no source changes.
The existing dashboard loading routes compose BrandLoader and inherit its label.
There are 535 matching production keys per locale: 238 before LOC-011 and 297
added by this task. Catalog parity does not imply whole-product extraction.

| Source group | Catalog and behavior |
|---|---|
| dashboard sidebar/topbar | Shell: navigation groups/routes, breadcrumb labels, create-action labels and search/sidebar actions. Label configuration resolves inside the component locale. The Operations insertion uses a stable group ID, never translated text. Route keys, drawer values and custom/entity titles remain unchanged. |
| dashboard org-switcher/user-menu | Shell: built-in role labels, organization information captions, account/upgrade/sign-out actions. Organization selection, cookie/storage/reload and sign-out behavior remain unchanged. |
| dashboard create-org-dialog | CreateOrganization: labels, hints, create/cancel/loading, success/errors. Original name/slug body, slug validation, selected organization and onboarding destination remain unchanged. |
| dashboard edit-profile-dialog | Account: profile, connections and security tabs, labels/actions/states/confirmation, provider/unknown-device labels and relative-time ICU messages. Existing linked-method disable rule and all request methods/bodies/endpoints remain unchanged. AuthErrors adds the actual last-authentication-method error. |
| dashboard command-palette | GlobalSearch: title/description/placeholder, type-group labels and loading/empty/prompt states. The rendered result list is a separate view used by the live palette. Keyboard shortcuts, debounce, abort, server grouping, result values and selected destination stay unchanged. |
| dashboard data-table/data-table-advanced | SharedUI: empty/search/columns defaults, whole-message ICU result counts/search interpolation, pagination and selection labels. Caller-provided text, sort/filter/selection behavior, row data and page-size arithmetic stay unchanged. |
| dashboard error-state/page-skeleton/brand-loader/inline-edit/export-button/file-uploader | SharedUI/Upload: fallback errors, retry, loading labels, edit prompt, export action/error and upload states/errors/clear action. File bytes, presign/upload bodies, entity links, CSV values and filenames remain unchanged. |
| dashboard date-range-filter; ui date-picker | DateRange/SharedUI: preset labels, start/end placeholders, connector and default picker prompt. Date calculations and canonical selected values are unchanged; comprehensive calendar/date adapters belong to LOC-003. |
| shared theme-toggle | SharedUI: ICU theme accessibility labels in a reusable ThemeOptions view. `light`/`dark`/`system` setting values and mounted-state handling remain unchanged. |
| ui breadcrumb/command/currency-select/dialog/sheet/sidebar/sonner/rate-note/search-input | SharedUI: authored labels, default prompts, empty states, close/navigation/clear actions, toast accessibility labels, rate-source/missing/staleness wording. Caller overrides are preserved. Rates retain original formatting and units. |
| app/not-found | SharedUI: missing-page description, home action and status wording. Brand, HTTP code/identifier and links retain their identity. |

## Explicit exceptions and remaining ownership

- Brands/provider names (`dubbl`, Google, Apple), shortcut key/glyphs, HTTP and
  numeric status 404, ISO currency codes/symbols, API-supplied currency names,
  external provider/type identifiers, user/organization/entity titles, search result
  titles/subtitles and custom messages remain verbatim and React-escaped. API currency
  names/date presentation belong to LOC-003 and domain localization.
- `my-company`, `0.00`, date/time format tokens, CSS/SVG values, punctuation and
  fallback initials are technical examples/visual data. Changing numeric input
  parsing, stored dates or currency scales is outside this extraction.
- Library-generated DayPicker dates/weekdays/months and calendar accessibility
  text, absolute session dates and native browser validation are not authored
  product catalogs in this slice. LOC-003 retains calendar/number/timezone adapter
  work; RTL tasks retain keyboard/direction/layout qualification. Browser-owned
  confirm buttons retain browser locale; the revoke confirmation body is cataloged.
- BAS and Schedule C remain named foreign forms, with catalog keys in both locales.
  This is not an Iranian statutory compliance implementation or terminology approval.
- Caller-supplied table columns/actions/messages, EmptyState/Section/PageHeader/
  TabLayout/SectionHeader text and domain error explanations belong to the calling
  module. This task extracts their shared defaults only. Generic ErrorState still
  displays an explicitly supplied message as text; domain callers must localize it.
- The create-drawer provider/context and all drawer forms, money editors/pickers,
  document send/history/attachment domain components remain LOC-007/008; document/
  email/PDF/public landing content remains LOC-009. NotificationDropdown and
  notification content remain LOC-013. Settings-specific components remain LOC-012.
- Developer-only invariant exceptions (`useSidebar`/`useCreateDrawer` provider
  misuse), DOM events, endpoint/header names, methods, state/tab/role/drawer codes
  and callback identities remain machine/developer contracts.
- Organization/account mutations reuse the exact AuthErrors display allowlist;
  known server errors keep translated reasons, unknown server/validation/network
  prose uses a catalog operation/input fallback. Upload failures use local catalog
  reasons. No backend response or MCP output is translated or changed.

## Verification boundaries

[Shell tests](../../tests/shell-catalogs.test.ts) render actual sidebar/topbar,
search-result views, tables, account tabs, theme choices, shared states, date/upload/
export/edit/rate components and not-found in both locales with real React/next-intl
and Next navigation/session contexts. They cover route/CTA label selection, existing
linked-method disable rules, exact data text, escaping, ICU count cases, relative
time/provider behavior and an 85-file JSX/display-attribute audit. The opening-balance
test now supplies the same root locale provider as the application; all existing
financial assertions remain intact.

No new operation, schema, API handler or MCP tool is introduced. These tests do
not claim browser interaction, real authentication, successful upload/CSV delivery,
native wording approval or final date/RTL qualification. Final results are in
[attempt 1](../evidence/LOC-011-attempt-1.md) and
[self-review](../evidence/LOC-011-review-1.md).

The user's additional runtime report was separately diagnosed as missing locale
columns in the configured test database. The existing additive migration 0013 was
applied transactionally with existing-row preservation checks and successful
post-commit locale reads. See [local repair evidence](../evidence/LOC-011-local-locale-repair-1.md).
No financial migration or historical migration adoption is implied.
