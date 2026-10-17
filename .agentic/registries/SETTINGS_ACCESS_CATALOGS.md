# Settings access and audit catalogs

LOC-016 is the access/audit child of LOC-012. LOC-012, LOC-006 and LOC-002 retain
independent integration acceptance. All fa-IR wording is **provisional**, pending
native linguistic/financial review; this task does not accept RTL or browser layout.

## Extracted scope

| Source | Catalog and behavior |
|---|---|
| `app/(dashboard)/settings/members/page.tsx` | SettingsMembers: title, billing/capacity banners, base-role explanations, preset guidance, invitation/link controls, status labels, complete counts and summaries, actions and toasts. Base-role badges reuse Invitation; custom role names remain data. |
| `app/(dashboard)/settings/roles/page.tsx`, `components/settings/role-permission-fields.tsx` | SettingsRoles: role controls, counts, 17 permission groups and 45 existing permission labels. Original permission IDs, selection/category callbacks, save guards and system-role edit/delete suppression remain. |
| `app/(dashboard)/settings/advisors/page.tsx` | SettingsAdvisors: four role labels, invitation/help/table/status/action/error text and revoke accessibility label. Stored role codes and advisor access behavior remain unchanged. |
| `app/(dashboard)/settings/api-keys/page.tsx`, `components/settings/api-key-fields.tsx` | SettingsApiKeys: plan notice, controls, metadata, authentication guidance, create/reveal states and copy/revoke labels. Plain key bytes, org scope, limits, close/reset and one-time reveal behavior remain. |
| `app/(dashboard)/settings/audit-log/page.tsx`, `components/settings/audit-activity-text.tsx`, `i18n/audit-presentation.ts` | SettingsAudit: filters, empty states, pagination/counts, complete activity sentence, 16 exact action-code labels and 11 original entity-filter labels. Relative/day labels use catalog text and existing presentation preferences; query/filter values remain canonical. |
| `i18n/access-presentation.ts` | Typed plan/capacity display using structured plan/status/max/seatCount fields, with operation fallback instead of arbitrary server prose. |
| `i18n/settings-errors.ts` | Sixteen additional exact access/role/invitation/advisor/API/billing error contracts. Unknown server/network/JSON errors use the localized operation fallback; 401/403 and validation statuses retain shared handling. |

## Explicit exceptions and retained boundaries

| Literal/data | Reason |
|---|---|
| Member names/emails, advisor identities, custom role names/descriptions, key names | Organization/user data is shown verbatim and React-escaped. It never becomes a translation key. |
| Stored preset role names/descriptions | The server identifies seeded system roles by name; customRoleName alone has no trusted preset discriminator. Saved names/descriptions remain verbatim, including English seeds. Authored preset explanation cards are translated. Changing seed identities or guessing a custom role's origin is outside this task. |
| Permission, role, plan, action and entity codes | All writes, queries, filters, status tests and access checks remain ASCII machine contracts. Unknown role/plan/action codes stay inspectable data; unknown entity codes retain the existing underscore-to-space display fallback. Only exact known audit codes are translated, never substring matches. |
| Extra audit entity/action codes beyond the explicit allowlists | Technical historical/event data, not new catalog keys. The original entity-filter set remains 11 items; this task does not add filter operations or promise translation for every extension/event emitted elsewhere. |
| `bypass:period-lock` | Exists in domain permissions but was not exposed by this role editor at entry. The original 45 selectable permissions are preserved; extraction does not grant or expose additional powers. |
| curl, URL/path/token samples, Authorization/Bearer/API, prefixes and key bytes | Technical identities retain spelling and bytes. Surrounding usage guidance is a complete rich message with a reviewed code tag. Email samples have matching catalog keys but retain ASCII. |
| Pro/dubbl, protocol abbreviations, numeric values, punctuation, dashes, masks | Product/technical identities and nonlinguistic data remain recognizable. Counts/plural wording are complete messages rather than English suffixes. |
| Member join/link expiry dates, advisor invitation dates, API-key raw timestamp strings, audit clock time | Existing formatting/interpolation remains unchanged. Relative audit wording/day labels are localized; broader exact number/calendar/timezone adoption remains LOC-003/004 and parent integration work. Canonical storage and query dates are unchanged. |
| Native input validation | Existing email/number constraints and browser-owned validation messages remain. |
| Dynamic server billing/limit prose | Capacity banners derive translated messages from structured fields. Exact known errors use the shared allowlist; other dynamic errors use contextual fallback. Server/MCP output is unchanged. |

No domain, REST, MCP, schema, dependency or migration change is included. Existing
role and audit MCP tools remain unchanged; this extraction adds no user operation.
It does not claim to close pre-existing MCP parity gaps for other access operations.

## Verification and remaining acceptance

`tests/settings-access-catalogs.test.ts` renders actual initial pages and loaded
permission/key/activity components with the production PresentationProvider in
both locales. It checks all 45 permission identities, selected/category states,
key escaping/create-vs-reveal branches, complete count messages, structured
capacity branches, exact audit allowlists and unknown fallbacks, local-day and
relative-time boundaries, error fallback and bounded JSX/display extraction.
A one-off AST comparison against entry HEAD additionally checks all five pages'
request URLs, JSON bodies, audit query parameters and permission-code occurrences.

These are rendering/data assertions, not persisted workflow, browser click,
clipboard, accessibility certification or layout qualification. Source review
observed existing missing fetch rejection handling in some access reads/advisor
actions and the category checkbox's existing DOM indeterminate assignment; this
task preserves those behaviors and does not certify the complete access workflows.
LOC-012 retains combined settings review; native L10N and RTL gates remain open.
