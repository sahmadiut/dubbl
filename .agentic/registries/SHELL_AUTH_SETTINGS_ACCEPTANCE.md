# Shell, authentication and settings catalog acceptance

LOC-006 independently accepts the combined message extraction of LOC-005,
LOC-010, LOC-011, LOC-012 and LOC-013. It does not complete LOC-002, the wider
product extraction, native Persian review, date/number adapters or RTL qualification.
All Persian resources, including financial navigation and the new sign-in error,
remain provisional. The combined catalogs contain 2,161 compatible keys per locale.

## Source ownership and explicit exceptions

| Family | Complete source and exception inventory |
|---|---|
| Preferences and validation | [Catalog foundation](MESSAGE_CATALOGS.md), [preference resolution](LOCALE_PREFERENCES.md): user/organization language, independent time zone/calendar/numerals, technical IANA placeholders, language autonyms and numeral samples. |
| Authentication/onboarding/invitation | [Auth inventory](AUTH_CATALOGS.md): all eight files, OAuth consent, six onboarding steps and option labels. Canonical country/currency/legal/referral codes, tokens, provider identities, callbacks, legal names and native browser validation remain exceptions. |
| Shared shell and primitives | [Shell inventory](SHELL_CATALOGS.md): 85 source files, navigation, account controls, search, shared table/loading/error/defaults and primitives. Caller-owned domain copy, user data, technical samples, library-owned calendar labels and later date/number adapters remain explicit exceptions. |
| Settings | [Combined settings acceptance](SETTINGS_CATALOG_ACCEPTANCE.md) links the complete core, automation, access, document and data inventories. Twenty in-scope pages plus shared layout/loading; Stripe is owner-excluded under DEC-008. Saved templates/tokens, machine identifiers, permission codes, CSV contracts and browser-owned messages remain verbatim. |
| Teams/admin/notifications | [Workspace inventory](WORKSPACE_CATALOGS.md): team/member screens, admin navigation/lists/details/settings/email preview, notification page/dropdown and approval summaries. Saved titles/bodies, user/custom names, email-preview HTML, technical colors/codes and existing standalone date/count formatting remain explicit exceptions. |

The inventories classify actual source ownership, rather than treating every
string literal as display copy. Child AST checks cover authored JSX and display
attributes; typecheck and catalog validation cover typed dynamic keys. These
checks complement source review; they do not prove arbitrary data strings or
unrelated product domains have been translated.

## Independent integration findings

| Finding | Disposition |
|---|---|
| Sign-in request rejection escapes the submit handler and leaves loading active | Reproduced with the actual production callback. Catch unexpected rejection, show `Auth.signInFailed`, and reset loading. No raw exception text is displayed; credentials, TOTP codes, provider identity and safe redirect logic are preserved. Paired English/Persian key added. |
| Auth and shell components use shared providers and primitives | Real combined rendering nests sign-in/sign-up in AuthLayout, and settings/teams/notifications inside sidebar, topbar, drawer, navigation and session contexts in both locales. OrgLoader intentionally withholds children during initial SSR; tests compose the ready shell contents explicitly, not a simulated successful bootstrap. |
| Locale changes could change write identities or saved content | Actual registration, sign-in, invitation and onboarding callbacks verify canonical requests and failure/success branches in both languages. A migrated PostgreSQL fixture runs the actual team-create callback through authenticated REST after locale REST/MCP writes, checks SQL persistence and renders loaded fields with DB-resolved presentation. Stored notification text and exact mileage units stay unchanged. |
| LOC-012 period-lock and automation handoffs | Retain its accepted fixes; rerun the independent combined settings REST/MCP/SQL fixture and all child regressions. No further settings workflow modification. |
| Existing admin Business/pro confirmation mismatch involves subscription behavior | Assessed and retained unchanged under DEC-008. Stripe-specific wording, files, provider qualification and dedicated tests are excluded; this does not block catalog integration. |
| Access-read/advisor rejection handling, category indeterminate state, inert organization Delete and PEPPOL alias | Existing limitations remain explicitly recorded in settings acceptance. Message integration does not certify every access/business workflow or introduce those operations. |

## Machine and MCP contracts

No REST handler, MCP registration, domain service, permission, schema, migration,
dependency, stored money/FX unit or IRR rollout flag changes. Translations are
display-only; no catalog key or translated label becomes a request identity.
The sign-in catch adds failure presentation to the existing operation.

Registered locale, organization and notification tools are exercised over linked
MCP transports alongside real authenticated REST and separate SQL assertions.
Existing pre-task MCP gaps are not closed or certified: source inspection finds
no dedicated team CRUD/member-management tools, in addition to the direct lock,
invitation/link, advisor and API-key gaps already recorded by LOC-012. The
LOC-013 inventory's broad reference to existing team/member counterparts must
not be read as operation parity. This task adds no new user operation.

## Verification boundary and handoff

The new parent suites supplement all child catalog/source/loaded-state/plural/
escaping checks. Controlled production callbacks cover credential failures,
TOTP-required/invalid-code states, network rejection, safe same-origin redirects,
registration failures, both token types, invitation rejection, canonical country/
currency/legal/referral writes, and successful navigation. PostgreSQL checks
cover locale REST/MCP persistence and precedence, team callback success/denial,
organization isolation, notification text/read isolation, unchanged `1250`
mileage minor units and zero journal writes.

Full unit tests, focused PostgreSQL groups, typecheck, lint, catalog validation,
money guards, controller validation and diff checks are recorded in
[attempt evidence](../evidence/LOC-006-attempt-1.md) and
[honest self-review](../evidence/LOC-006-review-1.md).
No live sign-in/OAuth, browser click/layout, screenshot, native linguistic review,
provider, email delivery, PDF/physical printer, hosted CI, Docker, build,
development server or deployment qualification is claimed. LOC-002 and later
L10N/RTL acceptance remain independent; IRR stays gated.
