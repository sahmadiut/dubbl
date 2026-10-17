# LOC-011 attempt 1: shared shell and UI primitive catalogs

## Identity

2026-10-17 (Asia/Tehran), Codex, `D:/Projects/dubbl`, `master`, entry HEAD
`070cb4a2b312d1bc058da1170708e0f85fa4120b`, clean entry tree. Live controller
selected LOC-011 and it was started with owner codex. Reused the established
controller/catalog contract and LOC-010 architecture; no additional task was
started or parent accepted.

## Implementation and acceptance

1. Extracted all authored copy in the bounded shell/shared inventory into Shell,
   SharedUI, Account, CreateOrganization, GlobalSearch, Upload and DateRange,
   plus the actual last-authentication-method AuthErrors key. Both production
   catalogs have 535 matching validated keys, 297 added here. The 85-file source
   audit covers the generic dashboard components, all shared/UI TSX files and
   global not-found. Explicit technical/data/library/domain exceptions and
   component ownership are in [SHELL_CATALOGS](../registries/SHELL_CATALOGS.md).
2. Real React/next-intl/Next-context rendering covers navigation/CTA selection,
   tables/defaults/counts, all search-result states, account tabs/security,
   linked-method disable rules, theme choices, shared loading/errors, date prompts,
   export/upload/inline/rate and not-found copy in both locales. Counts/search
   interpolation use whole ICU messages; relative-time wording and theme labels
   use ICU. Hostile user/server/search data remains escaped. Route/drawer/state/
   role/provider identities, request bodies, canonical dates, CSV/upload values,
   money parsing, units and accounting behavior remain unchanged. The Operations
   group uses a stable ID instead of branching on translated text. No new API,
   schema definition, dependency or MCP operation was introduced.
3. Every new Persian namespace is explicitly provisional pending native L10N
   review. LOC-006 and LOC-002 retain independent combined acceptance, and
   date/number/calendar adapters plus RTL/layout/native qualification remain
   separate. No parent acceptance criterion was checked.

Shared defaults now require the same locale context supplied by the application
root. The existing opening-balance component fixture was wrapped with that context;
all its original financial assertions remain intact. ThemeOptions/search-result
views and account tabs permit real rendering without artificial dialog state.
Temporary extraction scripts were removed before final verification.

## Additional user-reported local runtime repair

During work the user reported a failing preference SELECT. Direct PostgreSQL
inspection reproduced SQLSTATE 42703 (`column "language" does not exist`) and
confirmed all five locale columns were missing in the authorized configured test
database. Applied the existing committed migration 0013 in a transaction with
short timeouts and before/after existing-row hash/count checks. Five users/five
organizations and their existing data were preserved; new preferences initialized
null. The exact user query and scoped organization-language read passed afterward
on a separate connection. No historical migration tracking was fabricated and no
financial migration was applied. See [repair evidence](LOC-011-local-locale-repair-1.md).
No browser/session-refresh claim is made. This repair is separate from rendering
tests; no normal LOC-011 test used or mutated the configured application database.

## Verification

All commands ran from the repository root using installed dependencies.

| Command/check | Actual final result |
|---|---|
| `node --import tsx --test tests/shell-catalogs.test.ts tests/auth-catalogs.test.ts tests/message-catalogs.test.ts tests/locale.test.ts tests/opening-balance-ui-money.test.ts` | Exit 0; 37 passed, zero skipped |
| `pnpm test` | Exit 0; 590 passed, zero skipped |
| `pnpm typecheck` | Exit 0; fumadocs-mdx and tsc --noEmit |
| `pnpm i18n:check` | Exit 0; 535 keys per locale |
| `pnpm lint` | Exit 0; zero errors, 81 existing warnings |
| Focused ESLint over changed shell/shared/UI files and auth-errors | Exit 0; only existing unused router warning in topbar; final full lint also includes new tests/helpers |
| `python .agentic/scripts/money_inventory.py --write` | Exit 0; 417 columns, 2143 scanned files, 1608 conservative consumers |
| `node --import tsx .agentic/scripts/verify_money_inventory.mjs` | Exit 0; 417 columns, 1608 consumer hashes and all occurrence lines verified |
| `node --import tsx .agentic/scripts/verify_legacy_money.mjs` | Exit 0; nine regression checks |
| `python .agentic/agent.py validate` | Exit 0; 227 structurally valid tasks before disposition |
| `git diff --check` | Exit 0; Git line-ending notices only |
| `git fetch origin`; `git rev-list --left-right --count HEAD...origin/master` | Exit 0; 0 ahead/0 behind before commit |

Interim failures were corrected and rerun: provider-label scope after extraction;
missing locale context in the existing opening-balance fixture; SessionProvider
required-children typing versus lint (fixed with a proper TSX test wrapper); and
an SSR assertion requiring React's escaped apostrophe in the not-found message.
Final full tests/typecheck/lint/catalog gates all pass. Mixed line endings from
temporary extraction were normalized before source inventory/diff verification.

## Limits and handoff

No build, dev-server start/restart, Docker, browser interaction, hosted-CI, real
login, successful file upload/download, PDF/physical print or native-language
approval is claimed. Financial/authorization and wire code was inspected for
preservation; no new backend behavior required integration fixtures. Existing
date/calendar formatting and library-owned calendar text remain explicitly
assigned to later presentation work. Pre-existing missing migration history in
the local test database was not reconciled by the additive runtime repair.

Complete controller disposition and scoped commit/push, verify remote SHA and
clean tree, report the live next task and stop. Review is honestly self-identified
in [self-review](LOC-011-review-1.md).
