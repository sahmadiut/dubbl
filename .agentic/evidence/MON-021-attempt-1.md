# MON-021 integration acceptance evidence - attempt 1

## Identity and scope

2026-10-09, Asia/Tehran. Operator: Codex / coding-assistant. Baseline master
commit: eeb01ae8638dad7135238a634b5126a660bada42. Working tree was clean at entry;
all changes in this attempt belong to MON-021. The controller independently
selected this integration parent after all fifteen split children completed.
This evidence is development contract acceptance, not production or independent
accounting/security qualification.

## Implementation and inspected boundaries

- Read the parent and child operation evidence/contracts, current shared payment,
  expense and banking services, REST routes, MCP registrations and fixtures.
  Added PAYMENT_EXPENSE_BANK_INTEGRATION_CONTRACTS.md, indexing every child
  boundary and its complete input/output/unit/range registry. MONEY_MANIFEST
  records combined acceptance; MONEY_BOUNDARIES refreshes three changed MCP
  consumers and two new fixture consumers. Schema-column records are unchanged.
- Changed full MCP input registration in payments.ts (five tools) and invoice/
  bill pay tools to strict Zod object schemas using server.registerTool. Raw
  SDK shapes could strip unknown fields before shared strict service validation.
  Names, descriptions, described fields, defaults, service logic, authorization,
  numeric/exact aliases, envelopes and idempotency semantics remain unchanged.
- Added payment-expense-bank-integration.test.ts and its worker. Four independent
  tenant pairs use USD, IRR, JPY and KWD as their base currencies, real API-key
  handlers and linked MCP SDK tools. No schema/migration or monetary-unit change.

## Acceptance mapping

1. All boundaries are indexed in the new integration registry and their fifteen
   detailed child registries. Positive/signed/nullable minor-unit amounts,
   canonical Minor strings, operation-specific major numeric/amountExact
   exceptions, currency scales, quantities/percentages/FX and safe coexistence
   limits remain explicit. Larger canonical int64 values are not silently
   accepted by safe-number business consumers; no existing IRR rescaling occurs.
2. The new actual-handler/SDK fixture composes recognized invoices/bills,
   credit/debit-note paired offsets, legacy REST cash settlement, MCP exact and
   major batch amounts, statement import/deduplication, existing cash matching,
   fresh bill matching, bank proof/completion/undo and expense reimbursement/
   reversal. The fifteen child operation suites plus credit/debit-note/bill
   lifecycle regressions passed against current source on PostgreSQL 16.15.
   Denied writes, foreign IDs, invalid keys and spoofed tenant headers are tested;
   each child independently exercises its own additional authorization surfaces.
3. Unknown payment-tool fields, conflicting amount aliases and unsupported exact
   ranges reject with unchanged financial and non-authentication audit snapshots.
   Existing cash detachment preserves its journal; payment deletion reverses
   saved cash and restores only its own allocation. Undo of bank-created bill
   settlement reverses cash and preserves the prior debit-note offset. Expense
   reimbursement changes the same bank GL without creating payment/allocation
   carriers; reversal restores it exactly. Concurrent REST invoice settlement
   and MCP bank settlement yield one successful cash allocation, with no
   overpayment; ownership-specific undo restores the document. Every posted
   journal is balanced by SQL numeric sums. Numeric money and exact aliases
   retain values across all four currency scales. Child fixtures additionally
   exercise safe maximums, saved historical FX, locks, fault rollback and races.

## Verification

All commands ran from D:/Projects/dubbl with installed dependencies. Explicit
TEST_DATABASE_URL selected a separate synthetic trust-role PostgreSQL 16.15
cluster on 127.0.0.1:55521, UTC server, max_locks_per_transaction=256. The harness
created/migrated/dropped randomly named dubbl_ci databases. Final fixture database
count was zero; pg_ctl fast/wait shutdown succeeded. Application DB/configuration
and privileges were untouched; provider keys were blank in workers.

| Command / procedure | Actual result |
|---|---|
| `node --import tsx --test tests/integration/payment-expense-bank-integration.test.ts` | 1/1 passed, four tenant/currency scenarios, actual REST/SDK |
| `node --import tsx --test --test-concurrency=1` with the 18 files listed below | 18/18 passed, no skips, migrated PostgreSQL 16.15 |
| `node --import tsx --test --test-concurrency=2 tests/*.test.ts` | 359/359 passed, no skips |
| `pnpm typecheck` | Exit 0, MDX plus tsc, including current fixtures/source |
| `pnpm exec eslint` on three changed MCP files and two new fixtures | Exit 0, no warnings/errors |
| `pnpm lint` | Exit 0, zero errors and 106 existing warnings; changed files are clean |
| `python .agentic/scripts/money_inventory.py --write` and `node --import tsx .agentic/scripts/verify_money_inventory.mjs` | Exit 0; 415 columns, 1405 consumers, 26710 occurrences verified |
| `node .agentic/scripts/verify_legacy_money.mjs` | Exit 0; nine checks passed |
| `python .agentic/agent.py validate` | Valid, 173 tasks; orchestration only |
| `git diff --check` | Passed |
| `git fetch origin master` and `git rev-list --left-right --count HEAD...origin/master` | Baseline 0/0, synchronized before task commit |

The 18 operation/regression paths are tests/integration/{payment-reads,
payment-settlements,payment-reversals,payment-batches,scheduled-payments,
expense-crud,expense-lifecycle,bank-accounts,bank-transaction-reads,bank-imports,
bank-categorization,bank-document-matches,bank-transfers,bank-reconciliations,
bank-rules,credits,debit-notes,bill-lifecycle}.test.ts.

Diagnostic attempts: the new fixture initially referenced the wrong import path,
lacked required AR/AP seed accounts and expected 400 instead of the established
409 bank-linked-payment deletion conflict. Corrected the fixture to actual
contracts; the final combined run passed. Initial affected lint found an unused
fixture import, removed before the final clean changed-file check. Default
`pnpm test` passed 358/359 but its DB-startup guard subprocess timed out under
concurrent load; the full bounded-concurrency rerun passed all 359. The ad hoc
cluster launch's optional pg_isready executable was unavailable; actual psql
queries/server logs and successful fixtures verified readiness and the server
was explicitly stopped. These diagnostic attempts are not claimed as passes.

## Review and handoff

See MON-021-review-1.md for Codex's self-review. No independent peer/human review
is implied. Exported handler/API-key and linked SDK behavior is verified; live
HTTP/browser/OAuth, providers, clean install, production deployment/migration,
statutory rules, full-int64 consumer cutover and IRR production enablement remain
separate gates. External/manual configuration writers do not all share adopted
locks. Existing owner-deferred bank-feed/provider scope remains deferred.

No full build, dev server, Docker, schema generation, application DB reset or
deployment was run. After controller closure and the user-authorized scoped
commit/push, stop and report MON-022 as next; do not start it in this request.
