# LOC-061 attempt 1

## Identity and scope

2026-10-18 (Asia/Tehran), Codex, repository `D:/Projects/dubbl`, branch `master`.
Entry HEAD `1ce80034`; entry tree was clean. User authorized completing and
pushing the next controller task. Controller selected LOC-028. Source inspection
found nine tax route TSX files (3,919 lines) plus settlement preview, so LOC-028
was structurally split into LOC-061..065 and queued for independent integration.
Only LOC-061 was implemented. LOC-028/007/002 remain open.

## Implementation and acceptance mapping

1. Added `TaxRates` (64) and `TaxNavigation` (7), 71 paired messages and 3,033
   total keys per locale. Complete tax rate and navigation sources now use typed
   next-intl keys, including treatment help, compound parts, quick setup result
   plurals, create/edit/busy states, summary labels, document title and errors.
   See [scope/exceptions](../registries/TAX_RATE_CATALOGS.md).
2. Actual production templates and callback bodies pass both-locale rendering
   and controlled-IO behavioral checks. Basis points, recovery shares, canonical
   enums/countries, compound account IDs/nulls, routes, organization scope and
   success/reset behavior are preserved. List reads now report localized errors
   for HTTP/JSON/envelope/network failures without replacing loaded rows.
   Icon-only edit/remove actions have localized accessible names. Existing
   REST/MCP services and schemas were inspected; no API, MCP, DB or money logic
   changed. All previous locale namespaces are deep-equal to HEAD, including
   Stripe. Inventory changed only the two owned TSX sources, catalogs and test.
3. This evidence, the scope inventory, task handoff and honest self-review record
   provisional Persian wording and independent parent/native/RTL/statutory
   qualification. No compliance or production IRR readiness claim is made.

## Verification

All commands ran from the repository root, using installed local dependencies.

| Command/check | Actual result | Boundary |
|---|---|---|
| `node --import tsx --test tests/tax-rate-catalogs.test.ts` | Final 9/9 passed, exit 0 | Real templates/provider; controlled hooks/IO and inline sheet/select portals, not mounted browser |
| `pnpm test` | 730/730 passed, exit 0 | Full unit suite; final test-only createElement lint cleanup rechecked with focused suite |
| `pnpm typecheck` | Passed, exit 0 | fumadocs generation plus tsc; no full build |
| `pnpm exec eslint` on two owned TSX sources and new test | Final clean, exit 0 | No warnings/errors in owned files |
| `pnpm lint` | Exit 0, zero errors, 75 existing warnings | Existing repository warnings remain |
| `pnpm i18n:check` | Passed, 3,033 paired keys, exit 0 | ICU shape/arguments/plurals, not native linguistic approval |
| `python .agentic/scripts/money_inventory.py --write` | Refreshed owned source/catalog/test inventory, exit 0 | 417 columns, 1,659 consumers |
| `node --import tsx .agentic/scripts/verify_money_inventory.mjs` | Passed all consumer hashes/source occurrences, exit 0 | Inventory is lexical, not financial integration proof |
| `node .agentic/scripts/verify_legacy_money.mjs` | 9 regression checks passed, exit 0 | No money algorithm changes |
| Existing-namespace deep equality against HEAD | All prior en-US/fa-IR namespaces unchanged | Includes all Stripe messages |
| `python .agentic/agent.py validate` | Valid, 292 tasks, exit 0 | Structural controller validation only |
| `git diff --check` | Passed, exit 0 | Git prints normal LF/CRLF notices on Windows |

Initial rendering tests exposed duplicate next-intl module identity in the test
harness and an uncontrolled tab pathname; fixed by loading the real shared ESM
components and controlling navigation for the real tab template. An initial
changed-file lint error about createElement children props was corrected. Final
focused checks are green; product behavior was not weakened to satisfy tests.

## Test coverage and limits

The nine focused groups cover populated/empty/loading lists; all three known
applicability labels plus escaped unknown data; all seven treatment options and
help/recovery visibility; compound inputs/account fallback; create/edit/setup
busy states; country interpolation; every current EU/GB/AU/US filing-navigation
branch and IR/no-country fallbacks; integer basis points, recovery clamping and
hidden defaults; trimming/blank filtering/account nulls; create/PATCH/reset/retry
and no-organization guards; country-profile default/explicit POST; ICU count
branches; list and mutation failures; extraction and Persian-script audits.

No full build, dev server, browser/screenshot, live REST/MCP/SQL, application DB,
provider, native linguistic review, full RTL or hosted CI run was performed.
These are UI-only changes; no new user operation, API/MCP contract or schema was
introduced. Existing country-profile content/compliance is not requalified.

## Review and handoff

See [Codex self-review](LOC-061-review-1.md). LOC-062..065 own remaining tax
surfaces; LOC-028/007/002 retain combined acceptance. Preserve Stripe under
DEC-008. Complete controller disposition, scoped commit/push to origin/master,
verify remote SHA and clean tree, report live next task and stop.
