# Locale preference foundation

LOC-001 implements request-based next-intl on Next 16.1.6 with existing paths.
No locale path segment, routing middleware, rewrite or auth proxy change is added.
The installed next-intl 4.14.9 peer range includes Next 16 and React 19; pnpm and
its frozen lockfile remain the repository's authoritative install workflow.

## Resolution and persistence

- Supported persisted languages are exactly `en-US` and `fa-IR`. Invalid saved
  values are ignored independently at each step: user language, live selected
  member organization's `defaultLanguage`, `DUBBL_LOCALE` cookie,
  `Accept-Language`, then `en-US`.
- Header negotiation accepts English/Persian language tags and two-letter
  regional variants, quality weights and stable header order. Unsupported ranges,
  malformed quality values, zero weights and wildcards are ignored. An entirely
  unsupported header uses the application fallback.
- User columns `language`, `time_zone`, `numerals` and `calendar`, and organization
  `default_language`, are nullable additive columns. Null clears an override;
  old rows inherit preferences without an update or currency conversion.
- `timeZone` accepts supported IANA identifiers or UTC and falls back to UTC
  independently of locale, host timezone, country and organization currency.
  Numerals (`latn`/`arabext`) and calendar (`gregory`/`persian`) have independent
  overrides; their unset defaults follow language. Currency is never resolved
  by this layer. These preferences do not mutate amounts or canonical dates.
- `i18n/server.ts` uses request-scoped React cache; the root and next-intl request
  configuration share the same result. Locale, timezone, message catalog and
  request `now` are supplied explicitly to the client provider. Separate
  presentation context carries calendar/numerals for subsequent adapter tasks.

## Organization selection and navigation

`setActiveOrganization` preserves existing `activeOrgId` localStorage behavior
and mirrors it to a root-path, SameSite=Lax cookie (`Secure` on HTTPS). Server
resolution validates UUID and current membership/live organization before reading
the default; cookies never authorize access. Anonymous requests ignore org cookies.
An absent selection uses a sole live membership; multiple memberships wait for
selection. Invalid/unauthorized selections provide no organization default.

Existing clients are migrated by OrgLoader: an authenticated resolved org is
mirrored once and the same page is reloaded before dashboard children render.
Blocked cookies do not trigger a reload loop. Existing switches already reload;
successful credential sign-in, sign-up, invitation navigation and preference saves
also perform document navigation so the root cannot retain a guest/previous-org
locale. Same-origin callback paths, queries and hashes are preserved; unsafe
callback destinations use `/dashboard`. No locale prefix is added.

## REST/MCP and authorization

`GET/PATCH /api/v1/user/locale-preferences` and registered tools
`get_locale_preferences`/`update_locale_preferences` share a direct DB service.
They require live membership in the authenticated organization and only read/write
`ctx.userId`'s global preferences. An API key acts as its creator in its bound org;
advisor access without membership is insufficient for changing global preferences.
PATCH is a strict, nonempty partial object, allows null resets, rejects unknown
keys and invalid values, returns `{preferences}`, and audits atomically with the
update. It cannot select another user, organization or currency.

Existing organization PATCH and `update_organization` accept `defaultLanguage`
through their shared strict schema and retain `manage:billing`, org scope and audit.
The Settings screen exposes both personal overrides and the organization default.

## Verification and follow-up

- [Pure/provider tests](../../tests/locale.test.ts) exercise precedence, invalid
  values, negotiation, independent presentation fields, auth callbacks, cookie
  mirroring and equivalent server/client rendering after payload serialization.
- [Migrated DB fixture](../../tests/integration/locale-preferences.test.ts) and
  [worker](../../tests/integration/locale-preferences-worker.ts) exercise real REST,
  linked registered MCP calls, independent SQL, tenant isolation, membership
  revocation, session/header/cookie request resolution and old-row preservation.
  Only session and Next request accessors are stubbed. No real browser/JWT flow
  or physical UI/layout test is claimed.
- [Implementation evidence](../evidence/LOC-001-attempt-1.md) records checks.
  Existing English content remains in place. Broad catalog extraction, reviewed
  Persian terminology, applying numeral/calendar adapters throughout the product
  and RTL conversion remain subsequent LOC/L10N/RTL tasks.

Framework references: [next-intl App Router setup](https://next-intl.dev/docs/getting-started/app-router)
and [request configuration](https://next-intl.dev/docs/usage/configuration), checked
2026-10-17. No external implementation code was copied.
