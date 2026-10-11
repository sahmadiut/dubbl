# MON-147 attempt 1 - Opening-balance UI exact money

## Identity

2026-10-11, coding-assistant, D:/Projects/dubbl on master. Entry HEAD
3799de377c3d89e4e7a1e11cee2004bfe7f8f94e; tree was clean at entry. This evidence
records task-owned uncommitted implementation, not a fabricated delivered SHA.
MON-133 was controller-selected, source reviewed and split into MON-147..152;
next selected MON-147 was started. MON-133 retains independent acceptance.

## Acceptance mapping

1. All opening-balance consumers have ownership in MONEY_MANIFEST and
   CORE_UI_MONEY_CUTOVER. opening-balance-ui.ts validates strict nonnegative
   fixed-two major strings, blanks as zero and safe numeric per-line/side limits.
   Bigint sums/equality replace parseFloat/tolerance/decimalToCents. Orphan amounts
   are rejected instead of silently dropped. Exact validated rows drive both
   preview and numeric payload. Empty zero rows are omitted; existing one-row
   two-sided acceptance is preserved. The rendered OpeningBalanceForm provides
   English errors, per-line input labels, decimal keyboard mode, scrolling and
   disabled invalid submission. Closing unmounts the form/reset draft.
   OpeningBalanceMoneyDetails validates numeric/optional agreeing Minor aliases,
   preserves low digits and uses bigint sums. The saved page handles load errors
   and reloads after replacement. Legacy allowances fall by five formatMoney
   references on the page and two decimalToCents drawer references.
2. Five focused pure/React tests cover 0.10+0.20=0.30, low digits, safe edge,
   aggregate overflow, malformed/exponent/partial/negative/fractional/orphan
   inputs, zero/imbalance, unsafe/contradictory/noncanonical saved aliases and
   totals beyond safe Number. Registered MCP SDK plus authenticated REST and SQL
   tests cover both write/read directions, replacement and voided previous
   entries, numeric payload shape, split sums and maximal safe amount. USD/JPY/KWD
   org/account metadata does not silently rescale the legacy fixed-cents contract.
   During real transport verification, existing nested Drizzle JSON converted
   numeric rate_exact into Number and caused opening-balance POST/read to fail.
   Shared opening-balance-read.ts flat driver selects repair this actual failure,
   preserve exact rates, retain numeric-cent outputs and add agreeing Minor
   strings using journalLineDto. Both REST and MCP use the shared reader, including
   MCP's transaction. Account joins are organization-scoped. MCP descriptions
   document retained numeric inputs, default USD tags and new exact read aliases.
3. Explicit compatibility exception: opening REST/MCP still accepts numeric cents
   only and stores default USD tags even for foreign org/account currency. The UI
   labels USD and uses fixed-two parsing/display intentionally. No unsupported
   currency/Minor input is sent, no historical amount is rescaled, and no second FX
   conversion occurs. Org-currency adoption requires separate backend work.
   Existing direct-caller aggregate, write scope/period/atomicity policies were
   not modernized or qualified. Only UI payloads have checked safe side totals.
   MON-148..152 own the remaining independent core consumers; MON-133, MON-129,
   MON-007 and MON-008 retain their own acceptance. No schema/migration changes.

## Verification

All commands ran in D:/Projects/dubbl. Integration used an explicit local
TEST_DATABASE_URL pointing at a newly initialized synthetic PostgreSQL 18 cluster
on port 55477; each test migrated/created/dropped its own random database.
No .env access, application database mutation, build/dev server, Docker,
deployment, or production IRR flag change.

| Command | Actual final result | Limits |
|---|---|---|
| node --import tsx --test tests/opening-balance-ui-money.test.ts | Exit 0, 5/5 | Pure adapters and React static render; browser effects not exercised |
| node --import tsx --test tests/integration/opening-balance-ui-money.test.ts | Exit 0, 1/1 | Actual REST/MCP/SQL, disposable PostgreSQL 18 |
| node --import tsx --test --test-concurrency=2 tests/*.test.ts | Exit 0, 432/432 | Full unit suite; contains final five focused tests |
| pnpm typecheck | Exit 0 | MDX and tsc; no full build |
| pnpm exec eslint scoped 11 TS/TSX files | Exit 0, no warnings | Final page, drawer, form/details, REST/MCP reader, helpers and tests |
| pnpm lint | Exit 0, 0 errors/103 existing warnings | Final scoped lint also covers read repair/new files |
| python .agentic/scripts/money_inventory.py --write | Exit 0 | 415 columns, 1997 files, 1492 consumers, 28493 occurrences |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0 | Actual Drizzle/source hashes/lines |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0, 9 regression checks | Legacy import/reference guard |
| python .agentic/agent.py validate | Exit 0, 202 tasks | Workflow structure only |
| git diff --check | Exit 0 | Whitespace |
| Synthetic psql database count, pg_ctl fast stop | 0 fixture databases; stop exit 0 | Dedicated cluster only |

Initial default-concurrency pnpm test passed 431/432: existing currency-rollout
startup subprocess hit its 15-second timeout during concurrent verification.
Unmodified full suite passed 432/432 at concurrency 2. Initial integration also
hit a subprocess timeout; its isolated retry exposed the actual nested-rate read
failure above, repaired and verified. Initial SSR assertion accidentally matched
CSS disabled classes; corrected to the real disabled attribute. Fixture org
metadata spelling was corrected to defaultCurrency after typecheck. No timeouts
or unrelated tests were weakened to obtain final passes.

## Review and handoff

Honest self-review is recorded separately in MON-147-review-1.md. DEC-005 permits
behavioral/layout review without screenshots. No browser interaction or
independent accounting/production qualification is claimed. Complete the
controller then commit/push these task-owned files with remote SHA/tree evidence.
Stop after MON-147; next task is determined by the controller, not this prose.
