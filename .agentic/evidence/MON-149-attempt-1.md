# MON-149 attempt 1 - expense and mileage UI money

## Identity

2026-10-11 (Asia/Tehran). Operator: coding-assistant. Branch master; entry HEAD
197ccd43481b576b1a262232a1a1c2b03fc96f06, clean tree. This evidence describes
the task changes before commit. One controller-selected task; integration parents
MON-133/MON-129/MON-007 and sibling tasks remain open.

## Implementation and acceptance mapping

1. Scoped consumers: purchases/expenses list, detail, edit, reimbursement amount;
   ExpenseDrawer including mileage; recurring expense create controls. Ownership,
   wire contracts and exceptions are mapped in CORE_UI_MONEY_CUTOVER MON-149 and
   MONEY_MANIFEST. Helpers expense-ui.ts and recurring-expense-ui.ts plus
   ExpenseAmountInput replace remaining monetary float/fixed-two display paths.
   Existing expense CRUD/lifecycle, organization mileage and recurring payable
   MCP tools support the exact fields; no route/tool/schema changes needed.
2. Ordinary inputs use exact decimal major text in claim currency, matching
   amountMinor aliases and bigint per-item/aggregate validation. Creation loads
   organization currency and rate, explicitly sends currency, and blocks unknown
   settings. Mileage multiplies entered exact decimal distance/rate before final
   item rounding, preserving calculation order; metadata independently rounds
   to int32 miles hundredths and claim-currency minor units per mile. Preview and
   submitted values agree across currency scales and safe-edge low digits.
   Saved aliases/numeric compatibility values, detail totals, rates and distances
   are validated before bigint display/prefill. Invalid reads are visible; edits
   carry IDs and preserve omitted mileage/tax/cost-center metadata. Tests exercise
   malformed/negative/overflow/alias/currency cases and English input rendering.
   The migrated fixture compares UI payload/preview with actual authenticated
   REST, linked registered MCP and SQL-text reads in USD/JPY/synthetic IRR/KWD.
3. Exceptions: safe numeric compatibility object fields persist, but all scoped
   money consumers adopt validated bigint before calculations/presentation.
   Recurring expense stays type=expense under MON-099, with explicit USD default,
   fixed-two major x 100 prices in every selected currency, gross-only generation,
   supplier/dates/frequency/occurrence controls and no silently omitted lines.
   Miles hundredths, tax-rate basis points and occurrence counts remain nonmoney.
   Per-status summary currencies are checked; different statuses with different
   currencies display Multiple currencies. No inferred FX or history rescaling.
   Parent combined acceptance and production gates are separate.

## Verification

All commands run from D:\Projects\dubbl; final results below are actual exits.

| Command | Result | Scope / limitations |
|---|---|---|
| node --import tsx --test tests/expense-ui-money.test.ts | Exit 0; 6/6, final assertions | Exact preview, transport schemas, mileage, malformed/range/alias, summaries, recurrence and React input markup |
| pnpm test | Exit 0; 461/461 | Entire pure suite; later added focused assertions and negative recurring input guard separately rerun 6/6 |
| TEST_DATABASE_URL loopback; node --import tsx --test --test-concurrency=2 tests/integration/expense-ui-money.test.ts tests/integration/expense-crud.test.ts tests/integration/expense-lifecycle.test.ts tests/integration/recurring-bill-ui-money.test.ts | Exit 0; 4/4 | PostgreSQL 18 synthetic server, port 55479, randomized disposable migrated databases; real REST/MCP/SQL, existing CRUD/lifecycle and shared recurrence regressions |
| pnpm typecheck | Exit 0 | No full build; fixture AuthContext literal type corrected before passing run |
| pnpm exec eslint on all ten changed TS/TSX implementation/test files | Exit 0; no warnings/errors | Final source review |
| pnpm lint | Exit 0; 0 errors / 102 existing warnings | Unrelated warning files preserved |
| python .agentic/scripts/money_inventory.py --write, then node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0 | Regenerated after final code/test edits; 415 columns, 1527 consumer hashes, all occurrence/source lines verified |
| node .agentic/scripts/verify_legacy_money.mjs | Exit 0; 9 regression checks | No legacy helper allowance added |
| python .agentic/agent.py validate; git diff --check | Exit 0 | Controller structure / diff integrity; completion transitions are separately validated |

The fixture checks exact regular/mileage creation, list/detail/count reads and
REST/MCP edits retaining saved rate/distance/tax/cost center. Recurring expense
REST/MCP templates generate two capped gross occurrences with preserved currency,
schedule advancement and no duplicate generation. Existing lifecycle coverage
retains authorization, tenant, lock, posting/reversal and rollback checks.

## Review and limitations

Honest self-review: coding-assistant, separately recorded in MON-149-review-1.md.
DEC-005 source/render behavioral layout review: decimal keyboard input, named
amount/rate controls, existing scrollable detail table and responsive sheets.
Live browser effects/screenshots are not claimed. Synthetic IRR assertions do
not enable production IRR. No application database, external provider/email,
dev server, full build, deployment, schema migration or full-int64 business
expansion was performed. Receipt provider, localization and organization settings
editor remain separately owned. The disposable server is checked for zero
fixture databases and stopped before commit.

## Handoff

Complete acceptance checks, submit, honest self-review and done; stage only
MON-149-owned files, commit/push origin/master, compare remote HEAD and clean
status. Stop after this task. Next is MON-150; parent integrations remain open.
