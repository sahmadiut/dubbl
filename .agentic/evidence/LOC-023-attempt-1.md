# LOC-023 - Independent banking catalog integration acceptance

## Identity

- Date: 2026-10-18 (Asia/Tehran); operator: Codex.
- Entry commit: `b440201a1dfedfc6b85f2a7ae4260832c043d2cb`, branch `master`.
- Controller selected LOC-023 after LOC-029/030/031/032/033 were done. Only
  this parent is accepted; LOC-007/002 remain open.
- A preexisting edit in `components/settings/locale-preferences.tsx` was present
  at entry. It is not task-owned and is neither changed nor committed here.
  Its SHA256 remained
  `23a3443960ba3dfc6d253dcd1921cb44c723a045cec25fadf6a1a69c8fcbab82`.
- Verification worktree: `%TEMP%/dubbl-loc023-verification`, detached at the
  entry commit with the new integration test copied in and a node_modules
  junction to installed dependencies. No application database access occurred.

## Independent result

Inspected the current 11 banking route/shared TSX files, all five child
inventories/handoffs, bank-account/transfer drawer ownership, shared payment
preview and current catalog/provider/wire boundaries. The children already
provide the required presentation; no duplicate extraction or production repair
was needed. The six banking namespaces contain 667 paired keys. Catalog files
are unchanged, with 3,600 keys per locale.

Added [combined integration tests](../../tests/banking-catalog-integration.test.ts)
that render the actual detail layout and four child pages with the actual shared
BankAccountContext, shared banking components and React/next-intl/
PresentationProvider. A per-test module cache retains real context identity;
initial layout state, navigation/effects, portals and unowned widgets are
controlled. The tests prove combined namespace resolution, empty/populated
states, an open import sheet, escaped caller strings, canonical settings fields
and exact positive/negative KWD amounts including low digits. A whole-route
AST audit checks all 11 files with explicit US country-code and arrow exceptions.

Added [combined scope and acceptance](../registries/BANKING_CATALOG_ACCEPTANCE.md),
linked it from MESSAGE_CATALOGS and refreshed the money consumer inventory for
the new test. Existing consumer records remain identical to HEAD: the unrelated
locale-preferences edit is not included in inventory metadata. No production,
catalog, REST/MCP/service, schema, migration or Stripe source changed.

## Acceptance mapping

1. Complete authored copy coverage: combined route AST audit plus the five child
   inventories and current source establish account/workspace/import/
   reconciliation/payment/shared-drawer coverage. Caller content, machine values,
   technical formats/samples and saved journal defaults have explicit exceptions.
2. Catalog/rendering/behavior: 78 focused checks pass, including all child
   rendering/callback suites, new composed tests and banking/payment wire/money
   tests. The isolated full suite passes 771/771. Existing exact-money and
   organization/request contracts remain asserted; static/catalog/lint checks
   pass as below. These results are not live REST/MCP/SQL qualification.
3. Evidence and handoff: combined registry, this attempt and honest self-review
   record provisional Persian, unchanged Stripe scope, preserved user work and
   independent LOC-007/002/native/RTL acceptance.

## Verification

All final checks exited 0 unless explicitly identified otherwise. Main commands
ran from D:/Projects/dubbl; isolated commands ran from the worktree above.

| Command/check | Observed result |
|---|---|
| Controller validate/status/next/context; start LOC-023 | 292 structurally valid tasks; selected only this parent |
| Focused Node test command below | 78/78 passed, no failures/skips; 39.833 seconds |
| `pnpm test` in the shared workspace | 770/771 passed; one failure at message-catalogs.test.ts:111 expects native option values absent from the preexisting Select edit |
| `pnpm test` in isolated task state | 771/771 passed, no failures/skips; 34.516 seconds |
| `pnpm typecheck` | Passed, fumadocs-mdx and tsc --noEmit |
| `pnpm exec eslint tests/banking-catalog-integration.test.ts` | Passed with zero errors/warnings |
| `pnpm lint` | Passed, zero errors and 75 existing warnings |
| `pnpm i18n:check` | Passed, 3,600 compatible keys per locale |
| `python .agentic/scripts/money_inventory.py --write` in isolated task state | 417 columns, 2,225 source files, 1,667 consumers, 32,171 occurrences |
| `node --import tsx .agentic/scripts/verify_money_inventory.mjs` in isolated task state | Verified all 417 columns, 1,667 hashes and occurrence lines; generated inventory copied back without unrelated file hashes |
| `node .agentic/scripts/verify_legacy_money.mjs` | Nine regression checks passed |
| Inventory JSON comparison with HEAD | Only the new integration-test consumer is added; existing consumer entries are unchanged |
| Local Markdown links; `git diff --check`; controller validation | 45 local links validated; diff check and all 292 tasks structurally valid |
| `git fetch origin`; `git rev-list --left-right --count HEAD...origin/master` | Entry HEAD was 0 ahead/0 behind |

Focused command:

```text
node --import tsx --test tests/bank-account-catalogs.test.ts tests/bank-workspace-catalogs.test.ts tests/bank-import-catalogs.test.ts tests/bank-reconciliation-catalogs.test.ts tests/bank-payment-catalogs.test.ts tests/banking-catalog-integration.test.ts tests/bank-ui-money.test.ts tests/bank-import-wire.test.ts tests/bank-reconciliation-wire.test.ts tests/bank-document-match-wire.test.ts tests/bank-transaction-read-wire.test.ts tests/bank-categorization-wire.test.ts tests/bank-transfer-wire.test.ts tests/payment-ui-money.test.ts tests/payment-batch-wire.test.ts tests/scheduled-payment-wire.test.ts
```

Initial new-test runs exposed test-harness assumptions: tab navigation uses
buttons rather than rendered hrefs, the audit needed the documented US/arrow
exceptions, and CurrencySelect needed the shared ESM import to retain next-intl
provider identity. Corrected the harness and expectations; the final focused and
isolated full suites above pass. No production defect was hidden by those fixes.

The first inventory generation used shared workspace state. It was replaced with
the isolated generation to avoid committing an unrelated locale-preferences hash.
Full workspace acceptance is not claimed while that user edit remains present.

## Limits and handoff

No TEST_DATABASE_URL was configured; DB integration was not run. The earlier
LOC-030 record also notes a local role without CREATEDB. No application database,
full build, dev server, Docker, browser/screenshot or provider tooling was used.
No new financial/service operation requires an API/MCP change. Manual/CSV banking
and existing registered MCP coverage remain intact. No dedicated Stripe work
was performed (DEC-008).

Persian wording remains provisional pending native terminology review. Full
RTL/font/layout, browser events, live REST/MCP/database transactions, hosted CI,
provider/email delivery, deployment and production IRR are independent gates.
Review is [Codex self-review](LOC-023-review-1.md), not peer/human approval.

Finish controller checks/submission/review/done and final link/diff validation,
commit/push only task-owned files to origin/master, confirm remote parity and
the unchanged unrelated edit, report the next controller task and stop.
