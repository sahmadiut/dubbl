# MON-007 attempt 1 - final core accounting consumer cutover

## Identity

2026-10-12, Asia/Tehran. Operator coding-assistant (Codex), self-review only.
Entry master HEAD 91dd99c8c04738c8a6037b3a1e42ef9b304918f1; clean working tree.
The user authorized completing and pushing the next task and later said continue.
Live validate/status/next selected MON-007; start claimed this integration parent
after both MON-128 and MON-129 completed. Original criteria were preserved and
child status alone was not used as acceptance. Read root/nested instructions,
controller/project/repository map, task/context/dependency evidence, backend role,
source/actual shared posting/adapters/handlers/MCP and complete consumer inventories.
The memory Dubbl controller-task skill guided the bounded delivery workflow.

## Implementation and acceptance mapping

1. New CORE_ACCOUNTING_CUTOVER_ACCEPTANCE joins MONEY_MANIFEST/MONEY_BOUNDARIES
   to all six backend operation inventories, retained posting helper ownership,
   core editor/presentation families and shared component sections. Updated
   manifest, posting/UI inventories, TEST_MATRIX and money README with independent
   final acceptance. Detailed existing operation policies remain. Auxiliary
   budget/accrual drawers, reports/dashboard widgets, domains/background/public/
   provider/export/PDF consumers remain explicitly MON-008. Runtime source already
   composes, so no duplicated service/tool, schema/migration or flag change.
2. New tests/integration/core-cutover-acceptance.test.ts and worker independently
   compose exact editor outputs with real authenticated REST and linked SDK MCP
   posting, payment, bank and reversal services. Eight workflows cover both
   REST-origin and MCP-origin organizations in USD/JPY/KWD/synthetic IRR.

   Taxed quote preview/create/accept/convert -> invoice recognition and bill
   preview/create -> recognition use low-digit raw price 3000000001 plus a
   half-minor price times three, at 3333 basis points. Independent literal SQL/
   expected integers preserve tax 999900001, totals 3999900005/3999900004,
   saved tie price 1, quantity 300 and distinct line amounts 3/2. Payments settle
   both documents and replay their identical saved results through both clients
   with unchanged snapshots. CSV preview/import then matches existing payments;
   a seven-unit manual adjustment yields cash net eight. Both account/journal
   views preserve aliases and explicit currencies, with five balanced journal
   debits totaling 15999600025.

   Ordered snapshots cover headers/lines, quote headers/lines, accounts/banks,
   movements, payments/allocations, journals/legs, numbering, locks, rates and
   financial audit rows, excluding API-key usage bookkeeping. Foreign reads/
   settlement, unmatched overpayments, malformed/overflow/conflicting writes,
   locked settlement, bank-linked deletion, locked cash/manual reversal and
   repeated delete/void reject unchanged. Display reads also preserve state.
   After bank unmatch and payment deletion, literal original document dues are
   restored. Invoice/bill/manual reversals mirror every leg's amount, account,
   currency, saved exact/legacy FX, version/direction/migration/provenance and
   dimensions. Original full SQL JSON-text rows remain unchanged. Every journal
   balances and every posted account net returns to zero.

   Joint existing parent/domain/FX/serialization fixtures independently reverify
   expenses/credits/unwinds, actual tax filing/settlement, opening balances,
   procurement/recurrence, role/tenant isolation, concurrency, source/base scales,
   edited reference rates and preserved saved FX. This is combined acceptance,
   rather than an inference from children or duplicate public operations.
3. Source inspection of actual shared posting/tax/FX, adopted document/journal/
   settlement arithmetic, core dashboard accounting/sales/purchases/tax paths,
   create-drawer and LineItemsEditor found only reviewed exceptions in owned
   sections. Core tax/discount/deposit/recoverability and bank labels are basis
   points/percentages; physical quantities/distance are hundredths; bank progress
   is counts. Shared posting uses bigint rational math and checked projections.
   REST journal fixed-two aliases are exact formatting/parsing of preserved raw
   units; MCP uses numeric minor values. Openings remain numeric USD cents.
   Recurring payable prices deliberately retain fixed-two-before-extension
   semantics. Account aggregates retain current-base raw GL/history conventions,
   and unsupported cross-scale REST invoice base envelopes reject. Auxiliary
   budget money floats and accrual validation remain MON-008. No monetary float/
   hidden fixed-two calculation remains in the owned core slice; no history is
   rescaled, no amount/unit inferred, no production range/flag change.

## Database and verification

All commands ran in D:/Projects/dubbl. Dedicated synthetic trust-authenticated
PostgreSQL 18 cluster at
C:/Users/Sajjad/AppData/Local/Temp/dubbl-mon007-final-pg-aa75e08d9fd441f7b073aa8e6c35a7ff,
loopback 127.0.0.1:55457, synthetic dubbl_ci role, UTC,
max_locks_per_transaction=256, jit=off. Explicit TEST_DATABASE_URL and matching
PG_BIN selected only this cluster. Wrappers create/migrate/drop random fixture
databases. Final fixture database count is zero and pg_ctl fast stop passed.
Temporary cluster files remain. No application .env/database was read, reset
or migrated; no full build, dev server, Docker, provider request or deployment.

Joint command: node --import tsx --test --test-concurrency=2 with the following
files in tests/integration, in this order:

```text
core-cutover-acceptance.test.ts core-editor-integration.test.ts core-ui-integration.test.ts
receivable-ui-integration.test.ts payable-ui-integration.test.ts receivable-document-ui.test.ts
core-money-cutover.test.ts core-accounting-integration.test.ts journal-integration.test.ts
journal-ui-money.test.ts receivable-document-integration.test.ts payable-procurement-integration.test.ts
payment-expense-bank-integration.test.ts configuration-integration.test.ts fx-history.test.ts
fx-wire.test.ts serialization-compatibility.test.ts exact-boundary-integration.test.ts inventory-master.test.ts
```

| Command / procedure | Actual result | Limit |
|---|---|---|
| Joint command above | Exit 0, 23/23, 146.829 seconds | Selected complete core compositions and relevant shared regressions; not every historical suite |
| node --import tsx --test tests/integration/core-cutover-acceptance.test.ts | Final exit 0, 1/1, eight workflows | Final enhanced complete original-row preservation check |
| pnpm test | Final exit 0, 474/474 | Full pure/static React suite, including registry link closure |
| pnpm typecheck | Exit 0, initial and final | MDX and tsc only |
| pnpm exec eslint tests/integration/core-cutover-acceptance.test.ts tests/integration/core-cutover-acceptance-worker.ts | Exit 0, initial and final, no output | Both new TS files |
| pnpm lint | Exit 0, 0 errors/98 existing warnings | Preceding-task warning count; no warnings in new files |
| python .agentic/scripts/money_inventory.py --write; then without arguments | Exit 0, final | 415 columns, 2054 scanned files, 1541 consumer files, 29720 occurrences |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0, final | Actual Drizzle columns, source hashes and lines verified |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0, 9 checks | Existing legacy-money guard |
| New registry local-link check | Exit 0, all 11 links resolve | Actual linked files; pure suite also validates linked registry graph |
| python .agentic/agent.py validate | Exit 0, 202 tasks | Structure only; repeated after completion |
| git diff --check | Exit 0 | Whitespace, LF/CRLF notices only |
| psql fixture count and pg_ctl fast stop | 0 databases, exit 0 shutdown | Dedicated synthetic cluster only |
| git fetch origin master; git rev-list --left-right --count HEAD...origin/master | Exit 0, 0 0 before commit | Actual pre-delivery remote synchronization |

Initial new-fixture reversal lookup selected a wrong repeated-account line;
corrected it to compare amount-swapped legs with one-to-one matching. Final
focused and joint fixtures passed. Self-review then strengthened preservation
to compare each complete original SQL JSON-text row; the final focused fixture,
typecheck, ESLint and source inventory passed after that enhancement. The first
full unit run caught an added MONEY_BOUNDARIES.md link (actual file is JSON).
Corrected the link; final full pure suite passed 474/474. These were fixture/
documentation defects, not runtime failures or weakened acceptance. Initial
wrong source/registry paths and one malformed PowerShell Get-Content probe were
corrected and are not recorded as successful verification.

## Review and handoff

Honest self-review: MON-007-review-1.md by implementing coding-assistant. No
scoped blocker remains. Complete controller check/submit/self-review/done, commit
task-owned files, push origin/master, verify remote SHA and clean state, report
MON-008 and stop. No delivery SHA is invented before the actual commit/push.

MON-008 retains auxiliary/background/public closure. Existing accounting defects,
raw/current-base/historical mixed-unit remediation, full-int64 business workflows,
production IRR, migration, security, localization/native-language and release
qualification remain independent. Local PostgreSQL 18/Node results do not qualify
hosted PostgreSQL 16 or CI. No live browser effects, independent peer/accounting/
human approval or deployment is claimed; DEC-005 permits behavioral/static review.
