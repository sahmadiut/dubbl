# Authentication, onboarding and invitation catalogs

LOC-010 is a bounded child of LOC-006. LOC-006 and LOC-002 retain independent
combined acceptance. Source boundary: eight files, 2083 lines at entry. The two
onboarding route/layout files have only a brand name or compose the wizard;
they are audited but need no catalog changes. Shell components they call,
including ThemeToggle, remain LOC-011; dashboard OrgLoader/layout remain LOC-011.

## Extraction inventory

| Source | Catalog ownership and behavior |
|---|---|
| `app/(auth)/layout.tsx` | AuthLayout: feature badges, decorative accounting network labels, tagline and footer. Configuration now resolves inside the component/request locale. |
| `app/(auth)/sign-in/page.tsx` | Auth: labels, placeholders, 2FA hint/errors, actions, dev login, loading and account link. Credential provider IDs, 2FA code checks and redirect behavior remain unchanged. |
| `app/(auth)/sign-up/page.tsx` | Auth: registration notices, including interpolated allowed domains, labels/actions/errors. Registration body and policy/provider logic remain unchanged. |
| `app/(auth)/mcp-authorize/page.tsx` | Consent: title, permissions, organization selector, actions/loading/errors and safely structured client/organization interpolation. OAuth request and denial values remain unchanged. |
| `components/onboarding/onboarding-wizard.tsx` | Onboarding: step labels, all six steps, review labels, legal notice, navigation, loading and errors. OnboardingOptions supplies all 40 country, 15 industry and 9 referral labels, keyed by existing machine codes. |
| `app/(onboarding)/layout.tsx`, `app/(onboarding)/onboarding/page.tsx` | Brand/composition only. Existing layout and route remain unchanged. |
| `app/(dashboard)/invite/[token]/page.tsx` | Invitation: loading/ready/accepting/success/error copy; complete ICU messages allow reordered organization, inviter and role text. Standard owner/admin/member roles translate only at display time. |
| `i18n/auth-errors.ts`, `i18n/invitation-role.ts`, `i18n/onboarding-options.ts` | Typed presentation adapters. Exact allowlist for existing server errors; invitation email and organization-limit counts interpolate safely. Malformed/unknown server errors use catalog fallbacks; 400/422 validation uses a catalog input-check message. Unexpected network exceptions use the operation fallback. |

Both catalogs contain 238 matching keys: 17 existing preference keys plus 221
keys for this task. All new Persian wording is **provisional**; none has native
linguistic or financial terminology approval. This inventory, rather than an
in-product approval badge or English placeholder, records the review status.
Native L10N and full RTL qualification remain later tasks. No IRR/currency enablement
or accounting/calendar changes are part of this slice.

## Explicit exceptions

| Remaining literal/data | Reason and boundary |
|---|---|
| dubbl, Google, Apple; GitHub, YouTube, Reddit, Hacker News | Product/provider names retain spelling. Referral labels still have catalog keys in both locales. |
| Country legal entity `localName`/`englishName` from `lib/data/business-types.ts` | Official/local legal names and abbreviations remain verbatim jurisdiction reference data in both locales. They are not approved Persian legal equivalents. The surrounding copy and country names are translated. |
| Organization names, inviter names, OAuth client names, custom roles, entered referral details | User/organization data remains verbatim and React-escaped. Only the three actual built-in role codes have catalog labels. |
| `you@example.com`, flags, currency ISO codes and `-` review placeholder | Technical samples, currency/data identifiers and nonlinguistic punctuation retain spelling. Country/currency/legal-code data files are unchanged. |
| URLs, provider IDs, headers, JSON keys, codes, role/state/step values, `other: ` referral prefix | Persisted/transport identities remain canonical. In particular PATCH country uses the original country name, never its Persian display label; numeric/currency defaults remain unchanged. Search accepts both localized and canonical country names and ISO codes. |
| OAuth `error=access_denied`, `error_description=User denied the request` | Machine callback protocol remains verbatim; displayed denial action is catalog-backed. |
| Browser native constraint-validation messages | Browser-owned locale behavior; required/email/minLength/inputMode/autocomplete constraints remain unchanged. No custom browser validation text is introduced. |
| Unknown future option codes | Presentation adapters preserve the supplied canonical name instead of guessing a translation. Tests cover every currently shipped option and prototype-like input. |
| Unknown API/server validation prose and network exception text | Not echoed into product copy. Known messages retain specific translated explanations, supported dynamic email/count messages retain their data, and unknown messages use an operation/input-check fallback. No API response or MCP tool output is translated or modified. |

## Contracts and verification

No operation, REST handler, service, schema or MCP tool changes. Existing
organization, invitation and OAuth endpoints keep their payloads, authorization,
role codes, token branching and navigation semantics. No new MCP tool is needed
for catalog-backed presentation of existing operations.

`tests/auth-catalogs.test.ts` renders the actual components with the real
next-intl provider and Next navigation contexts in both locales. It checks
credential fields/constraints/links, consent permission text and escaped client
names, layouts, invitation loading, all six onboarding steps/review, canonical
option data, known/error-fallback behavior and custom role preservation. A bounded
AST audit rejects remaining JSX prose/display attributes beyond the explicit
exceptions. Existing catalog tests cover ICU structure, Persian plurals and safe
rich rendering. These are server rendering and behavior checks, not a browser
interaction, successful authentication, authorization or native-language approval.

See [attempt 1](../evidence/LOC-010-attempt-1.md) and
[self-review](../evidence/LOC-010-review-1.md) for actual final commands/results.
