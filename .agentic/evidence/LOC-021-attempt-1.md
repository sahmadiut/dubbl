# LOC-021 attempt 1 - chart of accounts catalogs

## Identity and scope

2026-10-18 (Asia/Tehran), operator Codex, D:/Projects/dubbl, master.
Entry HEAD: dabb1235; working tree clean at entry. This evidence describes the
task-owned working diff before its delivery commit, not an invented commit SHA.

The controller selected LOC-007. Inspection found 87 route TSX files plus shared
forms/drawers, so its documented split workflow created LOC-021 through LOC-028.
The controller then selected and started LOC-021. LOC-007 and LOC-002 remain open
for independent combined acceptance; no sibling implementation was attempted.

## Implementation and acceptance mapping

1. Added 173 paired Accounts/AccountErrors keys (2,334 per locale). Extracted
   chart list/examples/counts, ledger/detail/settings, account picker and creation
   drawer, and accounting navigation. See [inventory and exceptions](../registries/ACCOUNT_CATALOGS.md).
   Known type labels translate; saved names/codes/subtypes/descriptions, currency
   provenance, dates, IDs, sort/filter values and money adapters retain their
   existing contracts. Rich built-in guidance keeps its two emphasized spans.
2. Added real React/next-intl rendering and production-source callback checks.
   The source audit finds no remaining authored JSX words/visible attributes in
   the bounded slice. Callback assertions exercise POST/PATCH/DELETE payloads,
   organization headers, built-in locked fields, status toggles, failure handling,
   confirmation rejection and saved exact-money alias rejection. Approved server
   errors map to display catalogs; unknown/network/HTML/JSON errors use translated
   operation fallbacks. Failed list reads show an alert; failed confirmations stay
   open and do not announce success or mutate local state.
3. Persian wording remains provisional pending native terminology/financial and
   RTL qualification. LOC-007/002 acceptance stays independent. Requirements/source
   coverage and task-index entries record all eight new slices. No Stripe-specific
   source file, existing catalog namespace, API/MCP handler, schema/migration,
   authorization, stored unit or feature flag changed. Existing account MCP
   list/get/create/update/delete operations remain unchanged.

Nine existing financial rendering test files now import the established
PresentationProvider-backed rendering helper, because AccountPicker consumes
catalogs. Their money assertions are unchanged. The source-only money inventory
refresh changes hashes/lines/scanned consumers; all schema classifications,
patterns and existing consumer policy metadata are unchanged.

## Actual verification

All commands ran from D:/Projects/dubbl. Tests used controlled local network/state
boundaries and real renderers/money adapters. No database, application server,
full build, Docker, deployment or external provider call was run.

| Command/check | Actual result |
|---|---|
| `python .agentic/agent.py validate`, `status`, `next`; split LOC-007; start LOC-021 | Exit 0; 255 structurally valid tasks after split; one selected child |
| Focused command below | Exit 0; 51/51 tests, zero failures/skips; 35.652 seconds |
| `node --import tsx --test --test-concurrency=2 tests/*.test.ts` | Final exit 0; 672/672 passed, zero failures/skips; 92.732 seconds |
| `pnpm typecheck` | Exit 0; fumadocs-mdx and tsc --noEmit |
| `pnpm lint` | Final exit 0; zero errors, 75 existing warnings |
| Changed-file ESLint command below | Exit 0; zero errors/warnings |
| `pnpm i18n:check` | Exit 0; 2,334 compatible keys per locale |
| `python .agentic/scripts/money_inventory.py --write` | Exit 0; 417 columns, 2,204 scanned files, 1,648 conservative consumers |
| `node --import tsx .agentic/scripts/verify_money_inventory.mjs` | Exit 0; schema, consumer hashes and occurrence lines verified |
| `node .agentic/scripts/verify_legacy_money.mjs` | Exit 0; nine regression checks |
| Catalog/source/metadata scope audit against entry HEAD | Exit 0; existing en/fa namespaces unchanged; no Stripe-specific path changed; 36 other drawer/provider/helper functions identical after LF normalization; money schema/policies unchanged |
| `git fetch origin`; `git rev-list --left-right --count HEAD...origin/master` | Exit 0; 0 ahead/0 behind before commit |
| `git diff --check` and controller validation | Exit 0 before disposition; final checks recorded at completion |
| Local-link audit across changed task/registry/evidence documents | Exit 0; 55 relative local links resolve |

Focused command (exact):

```text
node --import tsx --test --test-concurrency=2 tests/account-catalogs.test.ts tests/bill-editor-components.test.ts tests/credit-note-ui-money.test.ts tests/debit-note-ui-money.test.ts tests/document-editor-components.test.ts tests/procurement-ui-money.test.ts tests/quote-ui-money.test.ts tests/recurring-bill-ui-money.test.ts tests/recurring-invoice-ui-money.test.ts tests/sales-receipt-ui-money.test.ts
```

Changed-file lint command (PowerShell; exact):

```powershell
$taskLintPaths=@(git diff --name-only -- '*.ts' '*.tsx')
$taskLintPaths += 'i18n/account-presentation.ts','tests/account-catalogs.test.ts'
node node_modules/eslint/bin/eslint.js @taskLintPaths
```

Earlier broad runs exposed the missing provider in older fixtures; none of those
failures were waived. The new rendering harness was corrected to share the actual
ESM next-intl context and inspect Select's canonical defaults through source and
request behavior (its closed portal is not fully server rendered). A lint finding
in the new harness was fixed by renaming its compiled-module variable. Intermediate
failed runs are not claimed as final passing verification.

## Review and handoff

See [honest self-review](LOC-021-review-1.md). No browser click/layout/font, native
Persian approval, complete RTL, live REST/MCP/database integration, physical
printing/PDF, hosted CI, provider qualification, deployment or production IRR
enablement is claimed. Dedicated Stripe work remains excluded by DEC-008.

After final verification, complete controller check/submit/self-review/done,
commit only task-owned files and push origin/master under the user's instruction.
Verify remote SHA and clean working tree, report the live next task and stop.
