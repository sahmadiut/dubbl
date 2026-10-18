# LOC-029 attempt 1 - bank-account catalogs

## Identity and scope

2026-10-18 (Asia/Tehran), operator Codex, D:/Projects/dubbl, master.
Entry HEAD: 7d354c622d2bcbb132685efd1565070ad96d1eaa; working tree clean at entry.
The controller selected LOC-023. Source inspection found 11 banking route/shared
TSX files (7,019 lines) plus banking drawers. Created LOC-029 through LOC-033,
validated, and split LOC-023 with the controller. Selected and started LOC-029
as the first bounded bank-account implementation within that selected scope.
LOC-023/007/002 retain independent integration acceptance. This evidence describes
the task-owned delivery diff and does not invent a commit or human approval.

## Acceptance mapping

1. Added 100 paired messages: BankAccounts 89 and BankAccountErrors 11, bringing
   each catalog to 2,703 compatible keys. Extracted the bank list/onboarding,
   account creation drawer and settings form, including type/group labels, ICU
   active/currency counts, error messages, confirmations, saving/cancel actions
   and accessible color labels. Existing catalog namespaces and all 37 other
   drawer/provider/helper functions remain unchanged after LF normalization.
   [Inventory](../registries/BANK_ACCOUNT_CATALOGS.md) records all owned paths,
   technical/data exceptions, remaining children and independent parent handoff.
2. Production templates render through React/next-intl/PresentationProvider in
   both locales, with controlled state/network/navigation boundaries and inline
   sheet portals. Tests execute actual list/create/update/delete callback syntax.
   Checks preserve request paths/methods/org headers, nullable fields, optional
   ledger link omission, canonical type/currency/country codes, events, routes,
   exact safe large low digits and per-currency groups. Failure cases cover known
   financial/history/authorization errors, unknown/prototype/server prose,
   network/HTML/JSON failures, malformed aliases, state recovery, confirmation
   rejection and saving flags. Full unit and focused banking checks pass.
3. Evidence, inventory, task handoff and honest self-review record provisional
   Persian financial wording and independent native/RTL and LOC-023/007/002
   acceptance. Existing banking REST/MCP/schema/service/money files are unchanged.
   Bank-account tools already supply these same operations; no new MCP operation
   is required. No application or fixture database was read or mutated.

## Behavior and preserved boundaries

Only approved existing fixed bank-service messages and HTTP/compatibility classes
translate. Unknown backend, network and parser prose uses a translated operation
fallback. Successful response bodies remain available for caller parsing. Account
list failures remain alerts rather than successful empty states, and successful
reload clears stale errors. Invalid saved aliases continue to fail closed.

Failed deletion now rejects after its localized notification, so the existing
confirmation hook stays open. Failed saves/creates do not close, navigate,
refresh or announce success. Settings validate saved amounts before scheduling
the React updater, which may execute after the request catch block; creation
validates the returned identifier before success/close/navigation. Tests defer
the settings updater and reject missing create identifiers. The drawer checks organization scope before
entering saving state. Cancel is explicitly supplied to the delete confirmation,
and all drawer footer labels come from the owned catalog.

Bigint parsing/sums, saved Minor aliases, raw stored units, per-currency grouping,
numeric compatibility limits, money/date/numeral formatters, DB/schema,
authorization and REST/MCP contracts remain unchanged. No IRR flag was enabled.
Source inventory hashes and occurrence lines were regenerated for the final diff.
No Stripe-specific path or existing Stripe namespace changed under DEC-008.

## Actual verification

All commands ran in D:/Projects/dubbl. No build, dev server, database fixture,
Docker, deployment, provider call or browser session ran.

| Command/check | Actual result |
|---|---|
| Controller validate/status/next, split LOC-023, start LOC-029 | Exit 0; valid 260-task graph after five child additions |
| Focused command below | Final exit 0; 15/15 passed, no failures/skips; 4.015 seconds |
| Full unit command below | Final exit 0; 693/693 passed, no failures/skips; 42.116 seconds |
| `pnpm typecheck` | Exit 0; fumadocs-mdx and tsc --noEmit; repeated after final response-validation changes |
| `pnpm i18n:check` | Exit 0; 2,703 compatible keys per locale |
| Changed-file ESLint | Exit 0; zero errors/warnings after final code/test changes |
| `pnpm lint` | Exit 0; zero errors, 75 existing warnings |
| `python .agentic/scripts/money_inventory.py --write` | Exit 0; 417 columns, 2,208 scanned files, 1,652 consumer files |
| `node --import tsx .agentic/scripts/verify_money_inventory.mjs` | Exit 0; schema, consumer hashes and occurrence/source lines verified |
| `node .agentic/scripts/verify_legacy_money.mjs` | Exit 0; nine regression checks |
| Source/catalog ownership audit against entry HEAD | Exit 0; existing namespaces unchanged; 37 unowned drawer/helper functions identical; no authored JSX or display attributes outside explicit exceptions; no Stripe/API/MCP/schema/money paths changed |
| `git fetch origin`; `git rev-list --left-right --count HEAD...origin/master` | Exit 0; 0 ahead/0 behind before commit |
| Controller validation, local document links and `git diff --check` | Exit 0; 39 local links across 10 task/registry/evidence documents; repeated during completion |

Focused command:

```text
node --import tsx --test --test-concurrency=2 tests/bank-account-catalogs.test.ts tests/bank-ui-money.test.ts tests/bank-accounts.test.ts
```

Full unit command (output saved to the system temporary directory):

```text
node --import tsx --test --test-concurrency=4 tests/*.test.ts
```

Changed-file lint:

```text
node node_modules/eslint/bin/eslint.js "app/(dashboard)/accounting/banking/page.tsx" "app/(dashboard)/accounting/banking/[id]/(detail)/settings/page.tsx" components/dashboard/create-drawer.tsx i18n/bank-account-presentation.ts tests/bank-account-catalogs.test.ts
```

An intermediate focused run failed two test-harness assumptions: Radix SSR does
not expose the selected native option value in this rendering, and a callback
extractor needed to recognize the memoized account loader after its translation
dependencies were added. The final assertions inspect actual canonical select
bindings, real rendered country fields and callback behavior; they preserve the
original financial assertions. The final focused rerun passes all 15 checks.
Self-review also identified deferred React updater parsing and a missing-create-ID
success path. Validation now precedes success/state scheduling, with negative
tests covering both. The full suite, focused checks, typecheck and changed-file
lint were rerun on that final source. Temporary extraction/audit scripts were removed before delivery.
No intermediate failure is represented as final passing verification. Existing
Stripe checks ran only within the general unit suite; no dedicated Stripe work.

## Review and handoff

See [self-review](LOC-029-review-1.md). Native Persian, complete RTL/font/layout,
browser interaction, live REST/MCP/SQL workflow acceptance, hosted CI, providers,
PDF/physical printing and production IRR remain unverified by this slice.

Complete controller check/submit/self-review/done, commit only task-owned files,
push origin/master under the user's instruction, verify remote SHA and clean
working tree, report the live next task and stop. LOC-023/007/002 remain open.
