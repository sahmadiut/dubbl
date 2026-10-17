# LOC-010 attempt 1: authentication, onboarding and invitation catalogs

## Identity and scope

2026-10-17 (Asia/Tehran), Codex, `D:/Projects/dubbl`, `master`, entry HEAD
`7dbdaacaec405daeb925d51f01fd5e447c343d38`, clean entry tree. Live controller
selected LOC-006. Read root/.agentic instructions, START_HERE, CONTROLLER,
PROJECT/REPOSITORY_MAP, frontend role, LOC-005 task/evidence and catalog registry.
Source inspection found eight authentication/onboarding/invitation files (2083
lines), shared shell/primitives, over twenty settings screens, teams/admin and
notifications. Used controller split to create LOC-010 through LOC-013, preserve
all parent criteria, and start the controller-selected first child LOC-010.
Only LOC-010 is implemented/completed in this delivery.

## Implementation

- Extracted all authored presentation copy in the bounded source inventory into
  Auth, AuthLayout, Consent, Invitation, Onboarding, AuthErrors and OnboardingOptions
  namespaces. Both catalogs have 238 matching keys, including 17 existing preference
  keys and 221 keys added here. Added initial Persian wording without claiming
  native approval; exact exceptions and per-file ownership are in
  [AUTH_CATALOGS](../registries/AUTH_CATALOGS.md).
- Complete ICU messages support reordered allowed-domain, OAuth client,
  organization, inviter, role and invitation-success interpolation. Approved rich
  tags produce React nodes; no catalog HTML/URLs or raw rendering is introduced.
- All current country/industry/referral labels have matching catalog keys keyed
  by existing codes. Country search accepts localized names, canonical names and
  ISO codes. Original reference-data files, submitted country/currency values,
  industry/referral/legal codes and free text remain unchanged. Local legal entity
  names retain their jurisdiction spelling as an explicit exception.
- Known server errors use an exact typed display allowlist. Invitation email and
  safe organization-count errors interpolate data; unknown server prose uses a
  translated operation fallback, 400/422 validation uses translated input-check
  copy. A presentation-error class distinguishes intentionally translated failures
  from unexpected network exceptions. No API/MCP response or machine code changes.
- Built-in owner/admin/member role labels translate only at presentation; custom
  names remain verbatim. Authentication/provider/2FA logic, OAuth consent body and
  denial callback, invitation token branching, organization writes and navigation
  are preserved. No accounting, authorization, schema or new operation change.
- Audited onboarding route/layout need no source edits (brand/composition only).
  Shared ThemeToggle, OrgLoader and dashboard shell remain LOC-011.

## Acceptance mapping

1. Full bounded extraction is supported by actual source inspection, the
   eight-file AST JSX/display-attribute audit, catalog validation, typed keys and
   the explicit exception inventory. This does not claim LOC-006/LOC-002 or
   whole-product extraction complete.
2. Real React/next-intl rendering of sign-in/sign-up, consent, layouts, invitation
   loading and all six onboarding steps passes in both locales. Tests verify
   credential input types/constraints/links, disabled consent, translated
   permission copy, escaped hostile client/organization/email values, legal name
   preservation, option coverage/data immutability, error mapping/fallbacks,
   bounded dynamic counts and custom role preservation. Existing locale tests
   cover callback URL and organization-cookie behavior; catalog tests cover
   ICU/CLDR/plural/rich-text safety. No backend contracts changed.
3. All new Persian namespaces are explicitly provisional pending native review.
   LOC-006 remains a queued integration parent with unchecked criteria; LOC-002
   and subsequent L10N/RTL/native acceptance remain independent. Planning index,
   coverage and catalog registries record the split and remaining ownership.

## Verification

Commands ran from the repository root using installed dependencies. No database
was accessed; no DB fixture is needed for this presentation/catalog slice.

| Command / check | Actual result |
|---|---|
| `node --import tsx --test tests/auth-catalogs.test.ts tests/message-catalogs.test.ts tests/locale.test.ts` | Exit 0; 25/25 passed, zero skipped |
| `pnpm test` | Exit 0; 583/583 passed, zero skipped |
| `pnpm typecheck` | Exit 0; fumadocs-mdx and tsc --noEmit |
| `pnpm i18n:check` | Exit 0; 238 matching validated keys per locale |
| `pnpm lint` | Exit 0; zero errors, 81 existing warnings |
| `pnpm exec eslint 'app/(auth)' 'app/(dashboard)/invite' components/onboarding i18n/auth-errors.ts i18n/invitation-role.ts i18n/onboarding-options.ts tests/auth-catalogs.test.ts` | Exit 0; four existing unused-type warnings in onboarding, none in new files |
| `python .agentic/scripts/money_inventory.py --write` | Exit 0; 417 columns, 1607 conservative consumers; generated source hashes/occurrences updated |
| `node --import tsx .agentic/scripts/verify_money_inventory.mjs` | Exit 0; all 417 columns, 1607 consumer hashes and source occurrence lines verified |
| `node --import tsx .agentic/scripts/verify_legacy_money.mjs` | Exit 0; nine regression checks |
| `python .agentic/agent.py validate` | Exit 0; 227 structurally valid tasks after split |
| `git diff --check` | Exit 0; only Git line-ending conversion notices |
| `git fetch origin`; `git rev-list --left-right --count HEAD...origin/master` | Exit 0; 0 ahead/0 behind before commit |

Initial real-render test assumed input attribute order; corrected its assertion
to match React's actual output, then all 25 focused/583 total tests passed.
Transient mixed line endings from automated extraction were normalized before
final diff/inventory verification. Temporary extraction/planning scripts were
removed; no tool-generation code is delivered.

## Limits and handoff

No build, dev server, Docker, browser interaction, successful login, live OAuth,
database migration, PDF/physical printing, hosted-CI or native-language approval
is claimed. Server rendering is not browser layout/RTL qualification. Native
financial wording, remaining shell/settings/admin extraction, and parent combined
acceptance remain unfinished. Review is an honest self-review, not a peer/human
approval. Complete controller disposition, commit task-owned changes, push
origin/master, verify remote parity and clean tree, report the live next task and
stop. See [self-review](LOC-010-review-1.md).
