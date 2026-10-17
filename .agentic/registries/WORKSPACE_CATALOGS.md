# Teams, administration and notification catalogs

LOC-013 is a bounded child of LOC-006. It adds matching `Teams`, `Admin`,
`Notifications` and `WorkspaceErrors` namespaces to both production catalogs.
All Persian wording is provisional, pending native linguistic/financial review.
LOC-006 and LOC-002 retain independent integration acceptance; RTL qualification
and complete date/numeral adapter adoption remain separate tasks.

## Extracted scope

| Source | Presentation and preserved contracts |
|---|---|
| `app/(dashboard)/teams/{layout,page,members/page,[id]/page}.tsx`, `components/dashboard/team-fields.tsx` | Navigation, document titles, stats, empty/search states, create/edit controls, color labels, member counts, confirmations, actions and toasts. Shared fields retain hex colors and caller text. Routes, sort keys, membership IDs and request bodies remain canonical. |
| `app/(admin)/admin/layout.tsx`, `components/admin/navigation.tsx` | All desktop/mobile groups, links, back actions and access-denied copy. The existing admin-check wrapper still hides navigation/children while loading or denied. Detail-page branching and all destinations are preserved. |
| `app/(admin)/admin/{page,users/page,organizations/page,organizations/[id]/page}.tsx` | Dashboard metrics, filters/sort labels, counts, role/plan/status display, limit labels, notes, subscription confirmations and toast states. Machine role, plan, billing, status and override values are unchanged. Custom names remain data. |
| `app/(admin)/admin/settings/page.tsx`, `components/admin/site-settings-form.tsx` | Registration, domains, organization creation, billing modes, Stripe status and saving states. Existing enum/string booleans, switches and on-blur saves are preserved. |
| `app/(admin)/admin/email-preview/page.tsx`, `i18n/admin-labels.ts` | Preview controls/errors, iframe title and all five known template names. Template IDs and HTML delivery remain untouched. |
| `app/(dashboard)/notifications/page.tsx`, `components/dashboard/notification-dropdown.tsx`, `components/dashboard/approval-notification-text.tsx` | Headings, tabs, empty/end states, unread ICU counts, type labels, approval summaries, fallback requester and relative times. Read/read-all operations, paging and approval routing remain unchanged. Stored titles/bodies are not rewritten. |
| `i18n/notification-presentation.ts` | Shared relative-time thresholds, localized old dates and date groups. Date labels use the independent timezone/calendar/numeral preferences. Canonical local Gregorian day keys prevent equal translated labels from merging different years; yesterday works across DST. Invalid dates have a localized fallback. |
| `i18n/workspace-errors.ts` | Exact allowlist for existing auth, permission, missing resource and duplicate-member responses. Unknown/network prose uses the localized operation fallback; 400/422 use input-check copy. Server and MCP response contracts are untouched. |

## Explicit exceptions

| Literal/data | Reason and boundary |
|---|---|
| `dubbl`, `Stripe`, `acme.com, example.com` | Brand/provider identity and technical domain sample retain spelling. Surrounding prose is catalog-backed. |
| Organization/team/user names, descriptions, email addresses, slugs, notes, custom role/plan names and future unknown template/enum names | Caller/reference data stays verbatim and React-escaped. Known built-in labels are translated only at display time. |
| Persisted notification `title`/`body`; preview email HTML and sample data | Existing content is displayed without rewriting history or translating unknown server prose. Generated notification/email content belongs to LOC-009; this task localizes its surrounding UI. Catalog text is never used as HTML. |
| `customPlanName: "Enterprise"` on the existing switch operation | Existing write contract is retained. The confirmation explains this exact stored name; it is not replaced with a translated value. |
| Currency codes, hex colors, API paths/query names, role/status/type/plan IDs, sort keys, limits and string booleans | Machine identities never derive from translated labels. |
| Dashboard/list counts, step numerals `1/2/3`, `+`, separators, dash/blank placeholders, existing admin `toLocaleDateString()`/`toLocaleString()` calls | Existing numeric/data display remains. LOC-003 retains full date/number preference adoption; this task does not claim that all admin dates or standalone counts follow Persian preferences. ICU count phrases are translated now. |
| Native input constraint messages | Browser-owned validation remains unchanged; no custom validation language is introduced. |
| Unknown API/network error text | Never treated as a catalog key or echoed as approved product copy. Safe operation fallback is shown instead. |

No REST/MCP operation, database schema, authorization or accounting calculation
changed. Existing teams, members, notifications, approval and admin tools remain
the counterparts of the unchanged operations; no additional tool is needed for
presentation-only extraction.

## Verification and remaining boundaries

`tests/workspace-catalogs.test.ts` exercises real React/next-intl rendering of
navigation (including denial/detail branching), initial admin lists/preview,
loaded site settings, create/edit team fields, confirmation warnings and approval
summaries. It checks escaped identities, color selection, enum label mapping,
review routes, count plurals, unknown-error fallback, relative-time thresholds,
timezone midnight, DST and cross-year grouping. Its bounded source audit lists
the remaining literal exceptions explicitly. Catalog validation and the complete
unit suite cover key/ICU contracts and the surrounding locale implementation.

These are rendering and behavioral assertions, not browser click/layout or
external Stripe/email acceptance. The existing switch-to-enterprise explanation
says Business while its unchanged payload selects `pro`; this pre-existing copy
and behavior need assessment during parent integration. No provider action was
executed here. Native translation, generated-content localization and RTL review
remain open. See [attempt 1](../evidence/LOC-013-attempt-1.md) and
[self-review](../evidence/LOC-013-review-1.md).
