# MON-083 attempt 1 - contractor and tax payment contracts

## Identity and scope

2026-10-06, Asia/Tehran; actual operator coding-assistant. Repository D:/Projects/dubbl, master, entry HEAD 4ec89c1, initially clean and synchronized with origin/master after fetch. Owner requested "complete and push next task" and then "continue" during verification. Controller validate/status/context/next selected and started MON-083 only. This evidence describes uncommitted implementation; no invented implementation commit, peer, human approval or deployment.

Read root/nested instructions, START_HERE/controller/project/repository map, backend role, MON-011 dependency evidence, ADR-006, money manifest, source migration/API compatibility sections, MON-079/082 handoffs and actual payroll/ledger/FX/transport/schema/test code. Original contractor REST writes lacked parent/tenant checks; process could mark paid outside the journal transaction and without a journal. REST tax and MCP remittance duplicated posting and lacked consistent exact/period/retry controls.

## Implementation

- lib/api/payroll-payment-wire.ts defines strict described money/date/bucket/bank/retry schemas and saved DTOs. Positive safe numeric cents gain matching canonical amountMinor strings; allocated/grouped totals and converted amounts use bigint intermediates. Unsupported int64 business values return 422 before commit; malformed/conflicting input rejects. Snapshots are validated, not inferred or repaired.
- lib/api/payroll-payments.ts supplies organization-scoped direct-Drizzle services for pending contractor list/get/create/update/delete/process and tax list/create plus the preserved legacy MCP remittance adapter. Paid/void records are immutable. Saved FX conversion and safe balanced ledger/account/period/source checks precede new posting; payment, journal, accounts, sequence and audit commit together. Paid process retries return saved history; explicit conflicting dates reject.
- All four existing REST route files now call services; missing contractor detail GET and pending DELETE are added. lib/mcp/tools/payroll-payments.ts registers nine individual wrapTool tools, all input fields described. tools/index.ts registers the file; old remittance registration/writer is removed from payroll.ts without changing its remaining output operations.
- Optional tax idempotencyKey reuses the existing org-locked audit-fingerprint pattern. Canonical sorted/grouped allocations and safe cents normalize legacy/exact clients; repeated input returns the existing paid payment/journal, while changed input returns 409. Legacy record_payroll_tax_remittance retains its bank UUID, taxKind mapping and periodEnd date default.
- Contractor writers coordinate with MON-079: master create/update/delete now lock organization before contractor, preventing row-lock/audit-FK deadlocks with payment creation. Contractor detail uses the same payment DTO. Payment processing saves historical date/base currency/base amount/exact rate. Journal lines persist matching exact and scaled coexistence FX.
- Generated migration 0010_slippery_skreet.sql, snapshot and journal add four nullable contractor fields and the positive 20/18 decimal CHECK. No historical rows are rewritten or rescaled. The all-money checksum fixture explicitly excludes only those new columns and checks null expansion fields while retaining original row comparisons.
- Both payment editors parse decimal cents with existing exact input, show validation failures, and render individual payment amounts through the existing exact currency formatter. Contractor rows use their saved payment currency. Remittance UI retains a key for unchanged input after network failure and resets it for changed input/success.
- PAYROLL_PAYMENT_WIRE_CONTRACTS.md maps all boundaries, units, aliases, state/account/FX/date policies and limits. MONEY_MANIFEST, TEST_MATRIX, CI_RUNBOOK and generated inventory are updated. Report summary/bucket arithmetic and compensation/output are still MON-084/085 and parent MON-025.

## Acceptance mapping

1. PAYROLL_PAYMENT_WIRE_CONTRACTS documents all eight REST operations, nine MCP tools, nested master output, positive cents aliases, base snapshots, exact/scaled FX coexistence, date/text/count units, envelopes, errors and safe ranges. Actual code and described SDK schemas are the boundary source.
2. tests/integration/payroll-payments.test.ts and worker exercise actual REST API authentication and SDK MCP transport (including registerAllTools), legacy/exact clients, permission/expired/invalid keys, foreign/sibling contractor/payment/bank IDs, owned output and full registration uniqueness. Concurrent process, remittance retry and master-currency/create cases are real PostgreSQL work, not mocked services.
3. Pure contracts plus PostgreSQL fixtures assert malformed/conflicting/overflow/unsafe history, invalid dates/buckets/account types, missing/unsupported FX and corrupted snapshot/journal rejection without mutation. Saved response guards and synthetic audit-trigger failures roll back accounts, sequence, journal, payment and state together. Amounts 29/1250/above-int32/max-safe and 1.2 FX preserve exact cents and safe numeric aliases. Legacy expansion fixtures compare every original payment field and repeat migrations idempotently.

## Actual verification

All commands ran at the repository root. PostgreSQL 18 was initialized in a uniquely named temporary local cluster with synthetic trust-auth credentials, port 55483; fixtures created/dropped random dubbl_ci_ databases through explicit TEST_DATABASE_URL. No local .env credentials were printed, existing application database reset or production migration performed.

| Command | Actual final observed result | Qualification |
|---|---|---|
| npx drizzle-kit generate | exit 0; generated 0010 SQL/snapshot/journal | Schema expansion generated, not production applied |
| pnpm typecheck | exit 0, including final lock/formatter changes | Fumadocs and tsc --noEmit only |
| npm run lint | exit 0; 0 errors, 136 existing warnings | Remaining repository baseline warnings; new service/tools/tests targeted lint clean |
| npx eslint on changed service/tools/tests; final master/payment pages check | exit 0 | UI retains existing unused-import/hook warnings; no new error |
| node --import tsx --test --test-concurrency=2 tests/*.test.ts | exit 0; 255/255 | Three new payment contract groups; final DTO changes also rechecked with the focused pure payment suite (3/3) |
| node --import tsx --test --test-concurrency=2 tests/integration/*.test.ts | exit 1; 72/74 initially passed | Actual broad regression, including historical all-money checksums, backup/restore, migrations, FX, payroll runs/time/config/master, inventory and document domains; failures and corrections below, not an all-green full rerun claim |
| node --import tsx --test tests/integration/bank-accounts.test.ts with disposable cluster timezone UTC | exit 0; 1/1 | Corrected test environment to CI's UTC; no banking product fix claimed |
| node --import tsx --test --test-concurrency=2 tests/integration/payroll-payments.test.ts tests/integration/payroll-master.test.ts after final lock fix | exit 0; 3/3 | Corrected affected payment and master regression fixtures. All 74 distinct integration cases have passing evidence across the broad run and corrective reruns |
| python .agentic/scripts/money_inventory.py --write; node --import tsx .agentic/scripts/verify_money_inventory.mjs | exit 0; 415 columns, 1632 scanned files, 1270 consumers, 25257 occurrences | Exact current source hashes/lines, lexical inventory not full dataflow |
| node .agentic/scripts/verify_legacy_money.mjs | exit 0; 9 checks | Existing legacy lint gate retained |
| git diff --check; python .agentic/agent.py validate | exit 0 | Whitespace and controller structure only |
| python -m unittest discover -s .agentic/tests -v | Optional run stopped during slow full-graph simulation after 12 completed passing cases | No full controller-suite pass claimed; controller code/dependencies unchanged; required structural validation passed |

Development verification corrected a strict-MCP fixture that supplied an extraneous paymentId to list, a historical checkpoint name, and expected error classifications. The initial optional full integration run exposed two distinct issues: the existing bank-alert UTC-application/local-DB timestamp-date dedup mismatch (14 versus 10 notifications) on a Tehran-initialized cluster, and an actual contractor master/payment lock-order deadlock. The bank case passed after setting timezone UTC only on this disposable cluster, as CI does. The concurrency test was preserved; master writers were fixed to lock org first, then contractor, and the payment/master suite passed. The runtime has no retry-loop masking or weakened test assertion. CI_RUNBOOK records the banking timezone limitation; no completed old task evidence was edited.

Final fixture-database query returned zero leftover dubbl_ci_ databases. Cluster shutdown and controller completion are performed after evidence preparation and checked before committing. No build, dev server, browser/screenshot, live provider call, hosted CI pass, production/IRR change or specialist accounting/security/linguistic sign-off is claimed.

## Review and handoff

See MON-083-review-1.md for actual self-review. Bounded acceptance is met, with no remaining slice blocker. Full-int64, foreign-bank settlement, legacy orphan journal remediation, report/bucket totals, liability balance caps, bank-balance synchronization and parent payroll financial/integration qualification are explicit remaining work, not silently passed here. Apply migration 0010 before using the runtime. Complete controller check/submit/self-review/done, commit/push this change to origin/master as requested, verify remote SHA/clean status, then stop. Next controller task is MON-084.
