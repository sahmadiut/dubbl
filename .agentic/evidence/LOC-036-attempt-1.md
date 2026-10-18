# LOC-036 attempt 1 - loan catalogs

Date: 2026-10-18 (Asia/Tehran). Implementer: Codex. Repository: D:/Projects/dubbl.
Controller validate/status/next selected LOC-036 on master; entry tree was clean.
This evidence describes the verified working tree before the scoped commit/push.

## Acceptance mapping

1. Added 94 paired `Loans` messages, totaling 3,870 keys per locale. Loan
   list/detail, LoanDrawer, repayment preview/confirmation, validation and error
   text use catalogs. Whole messages and ICU plurals cover loan counts, terms and
   exact formatted amount summaries. See [inventory](../registries/LOAN_CATALOGS.md)
   for explicit machine/data/money/punctuation exceptions. Persian is provisional.
2. Real production JSX renders under PresentationProvider in both locales.
   Production callbacks preserve routes/methods, organization headers, optional
   bank omission, exact Minor strings, basis-point rates, Gregorian dates,
   schedule-entry IDs, confirmations and redirects. Tests cover successful and
   failed creation/payment/reads, cancellation, missing org/next entry, input
   validation, network/HTTP/parser/shape failures, corrupt money aliases, saving
   flags and escaped caller content. Localized request helpers keep the unchanged
   assetLoanJson validator before adoption and hide unknown error prose. Bank
   read failures surface; cancelled list/bank effects do not adopt data/errors.
3. Inventory, handoff and [honest self-review](LOC-036-review-1.md) record native
   Persian, RTL and independent LOC-024/007/002 boundaries. Existing catalogs and
   unrelated drawer bodies were compared against HEAD and are identical.
   No REST/MCP/service/schema/migration/money-adapter changes were required;
   existing loan tools cover all unchanged operations. Stripe is unchanged.

## Verification

All commands ran at repository root. A new PostgreSQL 18 cluster was initialized
in a unique OS temporary directory, bound to 127.0.0.1:55436 with explicit
TEST_DATABASE_URL. Integration fixtures created/dropped randomized databases;
the cluster was stopped afterward. No application database was used.

| Check | Actual result |
|---|---|
| Focused loan catalog/money/wire suite | 18/18 passed, no skips; 6.726 seconds |
| Full unit/static suite, concurrency 4 | 790/790 passed, no skips; 70.437 seconds |
| Loan and combined asset-loan REST/MCP integrations | 2/2 passed, no skips; 25.240 seconds |
| pnpm typecheck | Exit 0; fumadocs-mdx and tsc --noEmit |
| pnpm i18n:check | Exit 0; 3,870 compatible keys in each locale |
| Changed-file ESLint | Exit 0, no errors or warnings |
| Full pnpm lint | Exit 0; zero errors, 72 existing warnings outside owned sources |
| Money inventory generation and verifier | Exit 0; 417 columns, 2,229 scanned files, 1,671 consumer hashes and source occurrences |
| Legacy money gate | Exit 0; nine regression checks |
| Source/catalog ownership audit | Existing namespaces and unrelated drawer bodies unchanged; explicit JSX exceptions only and Persian script in every new Persian value |
| Pre-commit fetch/divergence | master and origin/master 0 ahead / 0 behind |
| Controller validation and git diff --check | Exit 0 |

Commands:

```text
node --import tsx --test --test-concurrency=2 tests/loan-catalogs.test.ts tests/asset-loan-ui-money.test.ts tests/loan-wire.test.ts
node --import tsx --test --test-concurrency=4 tests/*.test.ts
node --import tsx --test --test-concurrency=1 tests/integration/loans.test.ts tests/integration/asset-loan-integration.test.ts
pnpm typecheck
pnpm i18n:check
node node_modules/eslint/bin/eslint.js <owned TS/TSX paths>
pnpm lint
python .agentic/scripts/money_inventory.py --write
node --import tsx .agentic/scripts/verify_money_inventory.mjs
node .agentic/scripts/verify_legacy_money.mjs
python .agentic/agent.py validate
git diff --check
```

Intermediate failures were corrected: PowerShell quoting broke the initial
temporary test-generator invocation; a test tuple missed a closing bracket;
typecheck identified an implicit callback parameter and duplicate test-scope
property. Final focused tests/typecheck/lint passed. Temporary generators were
removed. The shared exact-money static guard now follows loanJson through the
same assetLoanJson validator without weakening financial assertions.

## Limits and handoff

No full build, dev server, mounted browser test, hosted CI wait, deployment or
production qualification ran. Rendering controls hooks and inlines portals;
callback execution is not interactive browser acceptance. Native Persian,
RTL and independent LOC-024/007/002 acceptance remain open. Self-review is
recorded honestly; no peer or human approval is claimed. Complete the scoped
commit/push and verify remote parity and clean status separately.
