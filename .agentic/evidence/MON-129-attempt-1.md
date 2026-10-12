# MON-129 attempt 1 - combined core editor and presentation acceptance

## Identity and scope

2026-10-12, Asia/Tehran. Operator coding-assistant (Codex). Entry master HEAD
ebd2db96cf226138ed20ec9bd9b2dc6f19d37937, clean working tree. User authorized
completing and pushing the next task. Live controller validate/status/next selected
MON-129; start claimed this parent after MON-130..133 completion. Child status
alone was not used as acceptance. Read root instructions, controller context,
frontend role, project/repository map, original money/migration requirements,
child evidence, actual adapters and shared UI sections, manifest and boundaries.
The memory Dubbl controller task skill guided the one-task delivery workflow.

## Implementation and acceptance mapping

1. CORE_UI_MONEY_CUTOVER and MONEY_MANIFEST enumerate the journal, invoice/quote/
   credit/receipt/prepayment/recurring receivable, bill/debit/procurement/recurring
   payable, opening/payment/expense/bank/tax/account consumers. Ownership is by
   section for create-drawer, shared line/amount controls and dashboard. Their
   detailed child rows join the lexical MONEY_BOUNDARIES inventory. Updated
   pending wording and added this independent parent acceptance to registries,
   TEST_MATRIX and lib/money/README.md. No runtime repair or duplicated MCP tool
   was necessary; the existing adopted adapters and direct-DB tools compose.
2. New tests/integration/core-editor-integration.test.ts and worker run eight
   REST-origin/MCP-origin workflows in USD/JPY/KWD/synthetic IRR, with all involved
   document, bank, payment, manual journal and account tools in one linked MCP
   session per organization. Exact quote preview/create/read -> accept/convert ->
   invoice recognition and bill preview/create -> recognition share one bank CSV
   preview/import -> full-statement settlement. Both REST/MCP payment/allocation
   and saved document views agree. Exact manual journal preview/post feeds the
   same GL/account/journal UI.

   Independent literal SQL-text expectations preserve the 3000000001 raw price,
   a half-minor price times three, rounded stored price 1 and physical quantity
   300. Quote-derived invoice tie amount is 3; extended-price bill tie is 2.
   Totals 3000000004/3000000003 settle to paid=total/due=0. Cash net 1 plus the
   manual 7-unit adjustment is 8. Five journals balance individually, sum to
   12000000021 debits and display in their explicit currency. REST fixed-two
   journal reads and numeric MCP reads are independently validated against their
   aliases and each other. Alias tampering rejects before UI display.

   Scoped ordered snapshots cover document headers/lines, quote lines, GL,
   accounts, bank accounts/movements, payments and allocations. Foreign document
   reads/settlement, unmatched-statement overpayment and malformed/overflow/
   conflicting writes reject unchanged. Presentation reads also preserve state.
   Jointly rerun all four child compositions and leaf UI transport fixtures:
   recurring generation, procurement conversions, supplier/customer credits and
   unwind, opening USD cents, expense/mileage, actual tax filing/settlement,
   source/base FX, statement proof and account pages retain their contracts.
   Full pure/static React coverage and source review preserve English labels,
   alerts, decimal keyboard inputs, preview gating/context guards and scrolling
   under DEC-005. No live browser effects/accessibility audit is claimed.
3. Reviewed exceptions retain historical units: safe numeric values must agree
   with canonical Minor strings; REST journal decimal aliases are fixed-two;
   MCP uses numeric raw minor units; openings are numeric USD cents; recurring
   payable prices round fixed-two before quantity extension; quantities and
   basis points are nonmoney; rule/approval thresholds use raw document/bank
   units; GL totals retain current-base raw conventions. Currency groups stay
   separate and different-scale legacy REST invoice base displays reject.
   Source review of the named journal page/shared drawer/editor found no hidden
   money float shortcut in owned core sections. Drawer float matches remaining
   are depositPercent basis points, budget amounts and accrual validation; the
   latter monetary sections belong to MON-008, as do auxiliary/public/background/
   provider/export/PDF/report consumers. No history, storage, flag or unit change.

## Database and verification

All commands ran in D:/Projects/dubbl. Dedicated synthetic trust-authenticated
PostgreSQL 18 cluster at
C:/Users/Sajjad/AppData/Local/Temp/dubbl-mon129-pg-12362977e2e64758ba7b5aac4a83c24d,
loopback 127.0.0.1:55454, role dubbl_ci, UTC, max_locks_per_transaction=256,
jit=off. Explicit TEST_DATABASE_URL and PG_BIN selected this cluster. Each wrapper
created/migrated/dropped its random fixture DB; workers received only that DB URL.
Final fixture database count was 0 and pg_ctl fast stop passed. No application
.env/database, full build, dev server, Docker or deployment was used.

The exact combined command used node --import tsx --test --test-concurrency=2 with
these files under tests/integration, in the following order:

```text
core-editor-integration.test.ts journal-ui-money.test.ts recurring-journal-wire.test.ts
receivable-document-ui.test.ts receivable-ui-integration.test.ts payable-ui-integration.test.ts
core-ui-integration.test.ts document-editor-money.test.ts invoice-ui-money.test.ts
quote-ui-money.test.ts credit-note-ui-money.test.ts sales-receipt-ui-money.test.ts
customer-prepayment-ui-money.test.ts recurring-invoice-ui-money.test.ts bill-editor-money.test.ts
bill-ui-money.test.ts debit-note-ui-money.test.ts procurement-ui-money.test.ts
recurring-bill-ui-money.test.ts opening-balance-ui-money.test.ts payment-ui-money.test.ts
expense-ui-money.test.ts bank-ui-money.test.ts tax-ui-money.test.ts
core-presentation-money.test.ts core-money-cutover.test.ts
```

| Command / procedure | Actual result | Limit |
|---|---|---|
| Combined command above | Exit 0, 26/26, 130.262 seconds | Every core child composition/leaf UI transport plus recurring journal and posting regression |
| node --import tsx --test tests/integration/core-editor-integration.test.ts | Final exit 0, 1/1, eight workflows | Rerun after adding complete quote/account/bank snapshots and SQL paid/due assertions |
| pnpm test | Exit 0, 474/474 | Full pure/static React checks |
| pnpm typecheck | Exit 0 initially and final | MDX and tsc only |
| pnpm exec eslint tests/integration/core-editor-integration.test.ts tests/integration/core-editor-integration-worker.ts | Exit 0 initially and final, no output | Both new TS files |
| pnpm lint | Exit 0, 0 errors/98 existing warnings | Same preceding-task warning count, outside new files |
| python .agentic/scripts/money_inventory.py --write; then without arguments | Exit 0 | 415 columns, 2052 scanned files, 1540 consumer files, 29652 occurrences |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0 | Drizzle classification and actual source hashes/lines |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0, 9 checks | Legacy-money guard |
| python .agentic/agent.py validate | Exit 0, 202 tasks | Workflow structure only; repeated after completion |
| git diff --check | Exit 0 | Whitespace; LF/CRLF advisories only |
| Synthetic psql fixture count and pg_ctl stop | 0 databases, exit 0 shutdown | Temporary cluster files retained |
| git fetch origin master; git rev-list --left-right --count HEAD...origin/master | Exit 0, 0 0 before commit | Actual remote synchronization before scoped delivery |

Initial fixture runs corrected omitted required quote expiryDate and an assumption
that quote creation included lines; the actual get_quote response is now adopted.
These were fixture errors, not product regressions or relaxed acceptance. Final
joint and enhanced parent runs pass. Initial wrong registry/README paths were
located using the source inventory; no failing probe is recorded as verification.

## Review and handoff

Honest self-review in MON-129-review-1.md; no peer or human approval is claimed.
Local PostgreSQL 18 does not qualify hosted PostgreSQL 16, production IRR,
full-int64 money workflows, historical current-base/mixed-unit remediation,
browser effects or accounting/native-language/migration/release gates. MON-007
retains independent posting/replay/reversal/lock acceptance; MON-008 retains
auxiliary/background/public closure. No scoped blocker remains.
Complete controller acceptance/submit/self-review/done, commit the ten task-owned
files, push origin/master, confirm remote SHA and clean tree, report next and stop.
The actual delivery SHA will be reported after the push; none is invented here.
