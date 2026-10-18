# LOC-033 attempt 1 - bank payment catalogs

## Identity and scope

2026-10-18 (Asia/Tehran), Codex, D:/Projects/dubbl, master.
Entry HEAD: 6a4d739f904415a146137cca75f5f8ee8dbdda21. Entry tree was clean.
The user requested completing and pushing the next task. Live controller
validate/status/next/context selected LOC-033; started only this bounded child
of LOC-023. No subagents used. Parent integration remains independently open.

Read root/.agentic instructions, START_HERE, PROJECT/REPOSITORY_MAP, controller,
frontend role, selected/parent tasks, message catalog contract, LOC-006 dependency
evidence/review and prior banking scope/tests. Read source requirements under
Farsi i18n/l10n strategy and required configuration/files/testing details.
Applied the memory controller skill. Inspected actual payment pages, shared
preview/drawer, exact-money adapters, REST/shared services and registered MCP
coverage. DEC-008 preserves Stripe unchanged.

## Implementation and acceptance mapping

1. Added 134 paired BankPayments messages, covering scheduled payments, batch
   list/detail, BankTransferDrawer and PaymentAmountPreview. Extracted titles,
   guidance, controls, placeholders, statuses, date-group labels, confirmations,
   summaries, accessible amount/remove labels, local guards, previews and
   notifications. Complete ICU sentences handle payment/supplier/selection counts
   and sent/skipped results. Added translated footer props without changing the
   shared DrawerFooter defaults or other drawers. Scope, explicit exceptions and
   MCP operation inventory are recorded in [registry](../registries/BANK_PAYMENT_CATALOGS.md).
2. Added a finite typed UI-only status/request/local-error mapping. Existing
   BankAccountErrors provide common auth/input/range/bank messages; unknown
   server/HTML/network/parser errors use translated operation fallbacks. Inspect
   failed responses before successful JSON consumption; clone before shared
   fallback parsing. No raw API error/exception strings reach these mutation
   notifications. Source service errors and REST/MCP contracts are unchanged.
3. Date grouping keeps the original day-difference algorithm and thresholds,
   with stable internal tokens and translated display labels. Effect Event
   notification logic reads current locale without adding locale/filter
   dependencies to the initial processing effect; it still depends only on
   orgId. Existing read callback cancellation/generation protections remain.
4. Nine new test groups render actual production templates with real React,
   next-intl and PresentationProvider in both locales, controlling hook state,
   navigation and inline portals. Tests exercise actual mutation callback syntax
   with explicit network/state boundaries, not copied business implementations.
   Coverage includes exact 4000000000000001 minor units in USD/JPY/IRR/KWD,
   canonical dates/org headers/request fields, single-currency batch preview,
   confirmation/session guards, schedule cancellation/item removal payloads,
   close/reset/refresh/navigation behavior, invalid inputs/currencies and failed
   write preservation. Remittance tests verify aliases/totals rejection and
   sent/skipped/no-email results. Group boundaries, stable processing effect
   dependencies, unknown/HTML/network/range/permission errors and escaped caller
   content are covered. AST auditing rejects authored English JSX/visible literal
   attributes; every new Persian leaf contains Persian characters. Existing
   preview financial tests now render through PresentationProvider.
5. Existing catalog namespaces and every unowned drawer function compare equal
   to entry HEAD. No schema/migration, financial service, REST, MCP, Stripe,
   export path, money scale or IRR flag changed. Updated the ownership registry,
   task handoff and mechanical money inventory (new scanned source/test paths,
   conservative consumer entries, hashes and occurrence lines). Manual/CSV
   banking and existing org-scoped MCP operation coverage remain intact.
6. Persian wording remains provisional. LOC-023/007/002 integration, native
   linguistic/financial review and full RTL qualification remain independent.
   Catalog completion is not production IRR or complete-workflow acceptance.

## Verification

All commands ran from D:/Projects/dubbl. Final passing checks exited 0.

| Command/check | Actual result |
|---|---|
| Controller validate/status/next/context; start LOC-033 | 292 structurally valid tasks; selected only this child |
| `node --import tsx --test tests/bank-payment-catalogs.test.ts tests/payment-ui-money.test.ts tests/bank-ui-money.test.ts tests/scheduled-payment-wire.test.ts tests/payment-batch-wire.test.ts tests/bank-transfer-wire.test.ts` | 24/24 passed, no failures/skips; 8.069 seconds |
| `pnpm test` | 768/768 passed, no failures/skips; 46.308 seconds |
| `pnpm typecheck` | Passed, fumadocs-mdx and tsc --noEmit |
| Changed-page/drawer/preview/helper/test `pnpm exec eslint` | Passed with zero errors/warnings |
| `pnpm lint` | Passed with zero errors and 75 preexisting warnings |
| `pnpm i18n:check` | 3,600 compatible keys per locale |
| `python .agentic/scripts/money_inventory.py --write` | 417 columns, 2,224 scanned files, 1,666 consumers, 32,161 occurrences |
| `node --import tsx .agentic/scripts/verify_money_inventory.mjs` | Verified 417 columns, 1,666 hashes and all occurrence/source lines |
| `node .agentic/scripts/verify_legacy_money.mjs` | Nine regression checks passed |
| AST/JSON identity audit against entry HEAD | Existing namespaces and all unowned drawer functions unchanged |
| `git diff --check`; controller validate | Passed |
| `git fetch origin`; `git rev-list --left-right --count HEAD...origin/master` | 0 ahead/0 behind before commit |

Initial development checks found a translated-string/internal-group-key type
mismatch, CommonJS/ESM next-intl context duplication in the controlled rendering
harness, and two Persian leaves damaged by a PowerShell pipe encoding conversion.
Kept stable typed group keys, reused the actual ESM preview/date-picker modules
in the harness, and rewrote both leaves explicitly as UTF-8; the final typecheck,
rendering and Persian-character assertions pass. Removed trailing whitespace
reported by the first diff check and refreshed the inventory afterward; the
final inventory and diff checks pass. These intermediate failures are not counted
as successful verification.

Full-suite coverage includes existing regressions; no dedicated Stripe work
occurred. No DB integration ran for this presentation-only slice. No application
database, full build, dev server, Docker, screenshot or provider tooling was used.
Existing document/email generation content remains service-owned and unchanged.

## Review and handoff

See [honest self-review](LOC-033-review-1.md). Native linguistic approval, full
RTL/font/layout, browser event automation, DB transactions, hosted CI, providers,
deployment and production IRR qualification are not claimed. Tests verify actual
templates and callback syntax at controlled boundaries.

Complete controller criteria/submission/self-review/done, validate local links,
controller state and scoped diff. Commit/push only reviewed task-owned files to
origin/master under the user's authorization; confirm remote SHA and clean tree,
report the live next controller task and stop. No parent task is completed here.
