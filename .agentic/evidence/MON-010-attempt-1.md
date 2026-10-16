# MON-010 attempt 1 - migration qualification and unresolved gate findings

## Identity

2026-10-16, Asia/Tehran. Implementing operator Codex, self-review only.
Entry master HEAD `2f55c3ae`; clean tree. Live controller validate/status/next
selected MON-010, started with owner codex. Read root/nested instructions,
controller/project/map/QA role, task/dependency evidence, source migration
requirements, test matrix, release gates and actual parsers/rollout/fixtures.
Used the memory Dubbl controller-task skill; live state replaced recorded next
task values. No other task or agent was started. User authorized commit/push.

## Changes and acceptance mapping

1. **Not fully met.** The 25-test joint PostgreSQL run and 554-test unit suite
   pass. New independent SQL preservation assertions reconcile trial balance,
   AR/AP, bank and retained earnings for four currency tenants, with historical
   counts/nulls/SHA-256 checksums. Existing fixtures cover 195 widened columns,
   88 tables, int64 storage, lock failure/rollback, exact FX/history, restoration,
   regime coexistence and real REST/registered MCP accounting/report services.
   However MONEY-IRR-01 fails: canonical `parseMajor` rejects Persian digits.
   MONEY-MIX-01 remains unsatisfied: no shared strict localized boundary exists,
   and the deprecated `lib/money.ts` parser returns 1200 for `12oops`.
   That deprecated parser is not asserted to be called by current endpoints.
   LOC-003 owns the missing boundary but depends on MON-010. No scope waiver,
   new locale feature or acceptance rewrite was silently introduced.

2. **Met.** After actual successful migration and independent int8 inspection,
   nine rolled-back corruptions must each fail preservation: balanced journal
   doubling, AR/AP/bank/retained drift, currency swap, changed historical text,
   missing period locks and foreign-tenant account references. The restored
   snapshot passes again. Equal debit/credit totals cannot pass changed balances.

3. **Met as a fail-closed guard; IRR remains disabled.** Actual rollout/startup,
   shared selection schema, MCP permission tests and organization REST/MCP
   integration pass. `IRR_FINANCIAL_GATE_PASSED` remains false. Environment or
   task metadata cannot attest financial readiness. No production unlock occurs.

See [qualification registry](../registries/MONEY_MIGRATION_QUALIFICATION.md) for
the exact oracle, case results, limits and unresolved ordering decision.

## Actual verification

All commands ran from D:/Projects/dubbl. Node 23.11.0, local PostgreSQL18 binaries.
Created a new dedicated synthetic loopback cluster on port 55110, trust-auth user
dubbl_ci, max_locks_per_transaction=256. Explicit TEST_DATABASE_URL pointed to
that server; fixtures created/dropped randomly named databases. PG_BIN pointed
to the matching installed PostgreSQL18 client. No application database was read
or mutated, and no real customer data or production dump was used.

Final joint command (TEST_DATABASE_URL and PG_BIN supplied explicitly):

```text
node --import tsx --test --test-concurrency=2
  tests/integration/money-migration-qualification.test.ts
  tests/integration/money-bigint.test.ts tests/integration/migrations.test.ts
  tests/integration/fx-exact.test.ts tests/integration/fx-history.test.ts
  tests/integration/currency-regimes.test.ts
  tests/integration/core-accounting-integration.test.ts
  tests/integration/financial-report-integration.test.ts
  tests/integration/organization-settings.test.ts tests/integration/backups.test.ts
```

| Command / procedure | Actual result | Limitation |
|---|---|---|
| Joint integration command above | Exit 0, 25/25, zero skipped, 96.167 seconds | Synthetic PostgreSQL18; real handlers/registered MCP where existing workers apply |
| Focused new migration qualification fixture | Exit 0, 2/2 | Four tenants, nine mutation negatives, historical/replay SQL oracle |
| pnpm test | Exit 0, 554/554, zero skipped, 27.817 seconds | Unit/behavior/static, no browser |
| pnpm typecheck | Exit 0 | fumadocs-mdx and tsc; no full build |
| pnpm exec eslint tests/integration/money-migration-qualification.test.ts | Exit 0, no findings | Owned TypeScript fixture |
| pnpm lint | Exit 0, zero errors, 81 existing warnings | Existing warnings remain |
| python .agentic/scripts/money_inventory.py --write; then without arguments | Exit 0, 417 columns, 2112 files, 1586 consumers, 31070 occurrences | Inventory updated for the new fixture only; lexical coverage |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0 | Actual Drizzle columns, hashes and source lines |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0, nine checks | Existing explicit compatibility allowances retained |
| Localized MONEY probe below | Exit 1 as an actual unmet gate | Persian-digit normalization is not implemented; this is not a passing check |
| python .agentic/agent.py validate; git diff --check | Exit 0 | Structural controller and whitespace checks |
| Local Markdown link check | Exit 0, seven links, zero missing | New registry and attempt/review evidence; existence only |
| Fixture cleanup count; dedicated pg_ctl fast shutdown | Zero disposable databases; exit 0, stopped | Synthetic cluster only |
| git fetch origin master; git rev-list --left-right --count HEAD...origin/master | Exit 0, 0 ahead/0 behind before delivery | Remote synchronization before scoped checkpoint commit |

Localized probe, supplied to `node --import tsx --input-type=module` through stdin
to preserve PowerShell/native quoting:

```js
import { parseMajor } from './lib/money/exact.ts';
import { formatMoney, parseMoney } from './lib/money.ts';
import assert from 'node:assert/strict';
const input='\u06f1\u06f2\u06f3\u06f4\u06f5\u06f6\u06f7\u06f8\u06f9';
let actual;
try { actual=parseMajor(input,'IRR','reject').amountMinor.toString(); }
catch (error) { actual=error.message; }
console.log(JSON.stringify({case:'MONEY-IRR-01',expected:'123456789',actual}));
const parts=new Intl.NumberFormat('fa-IR', {
  style:'currency',currency:'IRR',minimumFractionDigits:0,maximumFractionDigits:0
}).formatToParts(123456789);
assert.ok(!parts.some(part=>part.type==='fraction'));
console.log(JSON.stringify({case:'MONEY-IRR-02',
  formatted:formatMoney(123456789,'IRR','fa-IR'),fractionParts:0}));
console.log(JSON.stringify({case:'MONEY-MIX-01',input:'12oops',
  legacyParserActual:parseMoney('12oops'),expected:'reject'}));
process.exitCode=actual==='123456789' ? 0 : 1;
```

Observed IRR-01 error: `Expected a canonical decimal string (maximum 256 characters)`.
IRR-02 returned Persian rial text/numerals with zero fraction parts. MIX-01
returned 1200 instead of rejecting. No financial production support is inferred.

Initial fixture run failed because the identifier allowlist excluded digits in
the real `is_1099_vendor` column; corrected to allow digits after the first
character. The final focused and joint runs pass. A first native inline probe
lost quotes in PowerShell and failed syntax parsing; stdin execution above
produced the recorded actual results. Initial inventory verification reported
expected drift after the new fixture; regeneration and all final gates pass.

## Review and handoff

[Self-review findings](MON-010-review-1.md) reject overall gate closure. This is
not a peer or human review. Criteria 2/3 can be checked; criterion 1 must stay
unchecked. Do not submit/done or mark readiness while the localized cases fail.
Resolve the explicit LOC-003 ordering conflict, re-run the affected cases and
obtain actual human accounting/database approval before closure. Commit/push
the authorized task-owned qualification checkpoint and verify remote parity.
The next selected task remains MON-010 while it is in progress.

No build, dev server, Docker, browser/screenshot, live provider, official
redenomination policy activation, deployment, hosted CI or independent human
financial/security review was performed. PostgreSQL18 fixtures do not qualify
hosted PostgreSQL16 or production data volumes. AUD-002 accounting defects and
later QA/release gates are not silently closed.
