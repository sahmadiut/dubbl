# MON-150 attempt 1 - banking and reconciliation UI money

## Identity and scope

2026-10-12, Asia/Tehran. Operator: coding-assistant. Entry master HEAD
32c3b7ecc15023c88596e65bbdf457a3d9baabdd, clean tree. User authorized completing
and pushing the next task. Controller validate/status/next selected MON-150;
started with owner coding-assistant. One bounded frontend task, self-reviewed.
No schema, migration, public REST/MCP contract or production flag changes.

## Implementation

- Added lib/money/bank-ui.ts, reusing existing exact primitives and checked
  invoice minor bridges. Saved numeric raw units must be safe and canonical,
  agree with any Minor alias, and have the expected bank currency. Nullable
  amounts retain null; negative zero and noncanonical currency fail.
- Account list totals and positive/negative balances group currencies. Detail
  context/sample credit/debit sums and magnitude sorting use bigint. Presentation
  bars compare only like currencies; percentage conversion is bounded and occurs
  after exact division. No sum of unlike currency or USD fallback for saved money.
- Imports preserve existing parser/format/profile/content preview/commit APIs.
  Preview opening/closing/row/duplicate money is validated. Import history pages
  consume only date/count/warning metadata. No client parser duplication.
- Document matching adopts validated same-currency candidates, exact decimal
  prefill/preview and amountMinor writes. Full statement magnitude is required,
  with document due bounds; partial reconciliation stays unsupported. Existing
  payment/journal matching remains ID-only. Expense creation requires the full
  outgoing magnitude and exact item amountMinor. Category splits reject malformed
  and incompletely selected rows and sum exact positive parts. Tax/recoverability
  previews use bigint ratios; count/rate/percent/file-size fields remain nonmoney.
- Bank transfer drawer preview and submission share the same account/currency/
  amount validator, and use amountMinor. Counterpart statement suggestions use
  exact opposite money. Metadata-only account creation keeps the API's zero
  statement balance default without inventing opening GL. Settings validate saved
  bank responses; restrictions on history/currency remain API-owned.
- Reconciliation balances use signed bank-scale Minor input with safe bounds.
  Proof/session reads validate aliases and group totals. Bank statement and GL
  base currency remain distinct; mixed units withhold differences/completion.
- Bank rules retain intentional raw bank minor-unit condition/fixed inputs,
  validate saved aliases/conditions and preserve canonical editor text. Existing
  Minor writes and nonmoney percentage rules remain intact.
- Updated CORE_UI_MONEY_CUTOVER ownership/limits, MONEY_MANIFEST, TEST_MATRIX,
  money README and regenerated MONEY_BOUNDARIES lexical hashes/source lines.

## Acceptance mapping

1. Ownership: CORE_UI_MONEY_CUTOVER MON-150 joins every listed bank consumer,
   including unchanged nonmonetary import-history/metadata and ID-only controls,
   to exact input/arithmetic/presentation and the corresponding existing API/MCP.
2. Behavior: five focused pure groups cover compatibility, four currency scales,
   large low digits, invalid aliases/range/precision, split/tax totals, rules and
   bank/base policies. Real REST/linked SDK MCP plus independent SQL text verify
   imported previews/reads, split postings, invoice/bill cash matching, transfer
   preview/save through the safe maximum and session/proof/account reads in
   USD/JPY/synthetic IRR/KWD. Eight existing bank suites preserve negative
   transport, tenant/role/locks/replay/concurrency and bank metadata behavior.
   English money formatting and keyboard-compatible existing controls retained;
   new amount fields include currency labels, scale limits and status messages.
3. Compatibility: safe numeric coexistence remains +/-9007199254740991; raw
   bank-minor rules, zero account default, partial match/foreign reconciliation
   limits and nonmoney scales are explicit. MON-133/MON-129/MON-007 acceptance
   remains independent and open. No full-int64 or production IRR qualification.

## Database and verification

Dedicated synthetic PostgreSQL 18.6 cluster at
C:/Users/Sajjad/AppData/Local/Temp/dubbl-mon150-pg-6a813cf515cd4897bdc2b5589d5e7918,
loopback 127.0.0.1:55450, synthetic trust-authenticated dubbl_ci role, UTC timezone,
max_locks_per_transaction=256, jit=off. Explicit TEST_DATABASE_URL and matching
PG_BIN select this cluster. Harnesses create/migrate/drop randomized databases;
the application .env/database was not used. Final fixture DB count zero;
pg_ctl fast stop succeeded. Temporary stopped cluster files remain.

All commands ran from D:/Projects/dubbl. No build, dev server, Docker, deployment,
hosted CI, screenshot or live browser session was run. DEC-005 permits source
layout/accessibility review and behavior/data assertions without screenshots.

| Command / procedure | Actual result | Scope/limit |
|---|---|---|
| node --import tsx --test tests/bank-ui-money.test.ts | Final exit 0, 5/5 | Final validation/precision/rule/currency behavior |
| node --import tsx --test tests/integration/bank-ui-money.test.ts | Final exit 0, 1/1 | Final helper against real REST/MCP/SQL; four currencies |
| node --import tsx --test --test-concurrency=2 tests/integration/bank-ui-money.test.ts tests/integration/bank-accounts.test.ts tests/integration/bank-imports.test.ts tests/integration/bank-transfers.test.ts tests/integration/bank-document-matches.test.ts tests/integration/bank-categorization.test.ts tests/integration/bank-reconciliations.test.ts tests/integration/bank-transaction-reads.test.ts tests/integration/bank-rules.test.ts | Seven passed initially; bank account and new UI fixture passed in focused rerun after fixture corrections | All eight existing suites passed; new UI fixture rerun again with final helper |
| pnpm test | Exit 0, 466/466 | Complete pure suite; subsequent helper validation/copy/drawer-preview refinements covered by final focused tests/typecheck/lint |
| pnpm typecheck | Final exit 0 | MDX and tsc only; after final drawer refinement |
| pnpm exec eslint on all twelve changed TS/TSX files | Exit 0, no warnings/errors | Final helper/preview tests and drawer refinements rechecked separately |
| pnpm lint | Exit 0, zero errors, 102 warnings | Matches preceding MON-149 evidence; unrelated warning files unchanged |
| python .agentic/scripts/money_inventory.py --write, then check; node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0 | Final 415 columns, 2038 scanned files, 1530 consumer hashes, 29329 occurrences |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0, 9/9 | Existing legacy guard |
| python .agentic/agent.py validate | Exit 0, 202 tasks | Structure, not financial/production qualification |
| Source/diff review and git diff --check | Exit 0 | Currency labels, scale/keyboard controls, exact-only payloads and task scope; no live browser claim |
| Fixture count / pg_ctl stop | Zero fixture databases, exit 0 | Synthetic cluster only |

Initial development checks found two outdated UI declarations, then one redundant
selection union comparison; corrected before final typecheck. A tax expected
literal, split HTTP status and SQL column names in the new test were corrected;
these were fixture mistakes. Added AR/AP control accounts for recognized test
documents. Initial bank-account notification regression failed because initdb
inherited Tehran timezone while UTC date deduplication expects UTC storage.
Changed this isolated cluster's timezone to UTC, confirmed SHOW timezone, and
the unchanged bank-account suite passed. No application timezone/schema code was
changed. New hook dependencies were added, leaving changed-file lint clean.

## Review and handoff

See MON-150-review-1.md for actual self-review. No scoped blocker remains.
Complete controller steps, commit task-owned files and perform the authorized
origin/master push, verify remote SHA/clean state, and stop. MON-151 is expected
next; use the live controller result. Parent acceptance and migration, full-int64,
foreign-currency reconciliation, production IRR, localization and release gates
remain separate. PostgreSQL 18 local verification does not claim hosted CI or
PostgreSQL 16 qualification.
