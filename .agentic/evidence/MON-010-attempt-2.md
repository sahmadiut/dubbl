# MON-010 attempt 2 - strict localized input and qualification rerun

## Identity and scope

2026-10-16/17, Asia/Tehran. Operator Codex, implementing agent; self-review only.
Entry master HEAD `e422f441`, clean working tree and origin/master parity.
Live controller validate/status/next selected the existing in-progress MON-010.
Read root/nested instructions, controller, project/map, task, prior attempt and
review, qualification registry, matrix, source requirements, dependency evidence
and actual exact parser, rollout guard and migration/transport fixtures.
Used the memory Dubbl controller-task skill. No other task/agent was started.
The user authorized task implementation, commit and push, not human approval.

## Changes and acceptance mapping

1. Implemented the strict localized boundary required by the remaining MONEY
   cases within MON-010 qualification, rather than deleting or moving failing
   acceptance requirements. `lib/money/localized.ts` normalizes one numeral
   script per amount (Latin, Persian or Arabic-Indic), with explicit ASCII or
   Arabic separator policy, validated optional three-digit groups and ASCII
   leading signs. Unknown characters, currency labels, whitespace, bidi controls,
   exponent syntax, mixed scripts and malformed grouping reject. The normalized
   decimal delegates to the unchanged exact parser with explicit currency,
   rounding and int64 bounds. Canonical REST/MCP/storage parsers stay ASCII-only.
   No new endpoint, MCP operation, schema or migration is introduced.

   `tests/localized-money.test.ts` covers identical literal IRR 123456789 units,
   single-script/group/sign grammar, malformed cases, signed int64 and safe-number
   edges, zero, 0/2/3 currency scales and positive/negative rounding ties. The
   migration fixture now seeds its IRR opening from Persian-digit input and
   independently requires literal SQL balances before/after actual widening/replay.
   LOC-003 remains todo and retains product-wide UI adoption, formatting and
   numeral-preference integration. This closes the required boundary gap without
   claiming the complete Persian UI is qualified. The deprecated unused legacy
   parser remains compatibility code; source search found no product call sites.
   The separate import/export parser has its own existing strict contracts.

2. Existing actual migration and nine independent corruption negatives are
   retained: successful schema widening, balanced doubling, AR/AP/bank/retained
   drift, currency swap, history edits, missing locks and tenant references.
   Assertions use literal expectations and SQL text, not parser/report output.

3. `IRR_FINANCIAL_GATE_PASSED` remains false. Financial readiness is never derived
   from task status or environment. Runtime/shared REST/MCP guards remain tested.
   There is no production enablement or historical rescaling.

## Actual verification

All commands run from D:/Projects/dubbl. Node 23.11.0 and PostgreSQL18 binaries.
A new dedicated synthetic cluster uses 127.0.0.1:55111, trust-auth dubbl_ci and
max_locks_per_transaction=256. Explicit TEST_DATABASE_URL targets that cluster;
fixtures create/drop randomized disposable databases. PG_BIN selects matching
PostgreSQL18 backup/restore binaries. No application database is read or mutated.

Joint qualification command (TEST_DATABASE_URL and PG_BIN supplied explicitly):

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

| Command / procedure | Actual result | Limits |
|---|---|---|
| Joint command above | Exit 1, 24/25 pass, zero skipped, 327.426 seconds | Existing core-accounting worker returned null status at its 120-second spawn deadline; see isolated retry |
| node --import tsx --test tests/integration/core-accounting-integration.test.ts | Exit 0, 1/1, 81.575 seconds | Same unchanged test and disposable cluster, isolated after other heavy checks finished |
| pnpm test | Exit 0, 558/558, zero skipped, 68.374 seconds | Unit/behavior/static; no browser |
| node --import tsx --test tests/localized-money.test.ts | Exit 0, 4/4 after final assertion typing correction | Strict localized input/rounding/range behavior |
| pnpm typecheck | Exit 0 after correction | fumadocs-mdx and tsc; no build |
| pnpm exec eslint lib/money/localized.ts tests/localized-money.test.ts tests/integration/money-migration-qualification.test.ts | Exit 0, no findings | Final owned TypeScript files |
| pnpm lint | Exit 0, zero errors, 81 existing warnings | Final owned files have no findings |
| python .agentic/scripts/money_inventory.py --write; then without arguments | Exit 0, 417 columns, 2114 files, 1588 consumers, 31086 occurrences | Regenerated after final source/test changes |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0 | Drizzle columns, every consumer hash and occurrence line |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0, nine checks | No new legacy consumers or relaxed baseline |
| MONEY boundary/display probe through node --import tsx --input-type=module stdin | Exit 0 | Persian input gives literal IRR 123456789; 12oops rejects; existing fa-IR formatter equals Intl parts with zero fractional parts |
| Local Markdown link check | Exit 0, seven links across three qualification/evidence files | Target existence, not content authenticity |
| Disposable database count; dedicated pg_ctl fast shutdown | Zero databases; exit 0, server stopped | Only the new synthetic cluster |
| python .agentic/agent.py validate; git diff --check | Exit 0 | Structural and whitespace checks |

The joint run's core worker stopped after five completed currency/value variants,
with null exit status, at the existing spawn timeout. It reported no financial
assertion mismatch; its Contact-not-found stderr comes from deliberate tenant
negative cases. Slow concurrent checks are the inferred timeout cause, not a
proven product defect. The unchanged isolated retry completed all variants and
passed. All 25 selected integration cases therefore have passing current results,
but the joint command itself did not pass and is not represented as a clean run.
No test deadline or production code was changed to make the retry pass.

Initial typecheck found two assert.throws calls whose undefined predicate did not
match the installed Node type overload. Replaced those predicates with TypeError;
final focused tests, owned-file lint and typecheck pass. The initial 558-test unit
run already passed at runtime; final focused tests verify the stricter predicate.

## Review and handoff

See [self-review](MON-010-review-2.md) and the
[qualification registry](../registries/MONEY_MIGRATION_QUALIFICATION.md).
Actual attributable human accounting/database review is required before done.
The controller's human_review requirement is retained; no AI review is recorded
as human approval. Push the authorized task-owned result and verify remote SHA
and clean tree. Hold MON-010 for human review; do not start the next task.

No full build, dev server, Docker, browser, live provider, deployment, hosted CI,
official currency cutover or production-data/volume/PostgreSQL16 qualification.
The earlier failed-gate attempt and review remain unchanged historical evidence.
