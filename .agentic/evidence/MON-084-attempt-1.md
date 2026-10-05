# MON-084 attempt 1 - compensation and forecasting contracts

## Identity and inspected scope

2026-10-06, Asia/Tehran; operator coding-assistant. Repository D:/Projects/dubbl,
master, entry HEAD dd4aeb8dd38822e69894aa84a18fa038b4388b47, initially clean and
synchronized with origin/master after fetch. Owner requested "complete and push
next task". Controller validate/status/context/next selected and started MON-084
only. This evidence describes uncommitted implementation; no invented commit,
peer/human review, deployment or downstream completion.

Read root/nested instructions, entry/controller/project/repository map, backend
role, task and MON-011 dependency evidence, ADR-006, money manifest, source
migration/API compatibility sections and actual routes, schema, UI, MCP and
fixture infrastructure. Existing entry GET/POST lacked parent tenant checks;
equity and forecasts used floating-point money and unsafe aggregate coercion.

## Implementation

- lib/api/payroll-compensation-wire.ts supplies strict described schemas,
  nonnegative safe annual salary/budget aliases, nullable budget agreement,
  exact plain-percent rationals and saved DTO checks. Unsupported int64 business
  amounts reject before mutation; no implicit string/locale/magnitude coercion.
- lib/api/payroll-compensation.ts supplies shared organization-scoped direct
  Drizzle services for all 15 actual operations. Band merged bounds, live/owned
  references, review terminal states, duplicate entries, current salary and
  currency checks precede commit. Org locks serialize writers; audit and saved
  DTO/total preflight share the write transaction. No planning operation posts
  journals or applies review salary changes.
- All nine existing REST route files call those services; 15 wrapTool MCP tools
  register in lib/mcp/tools/payroll-compensation.ts and tools/index.ts. Numeric
  responses and existing REST envelopes remain, with matching Minor strings.
  Review list also supplies base currency/count/totals. Every tool field is
  described and registration uniqueness is checked with registerAllTools.
- Forecast monthly salary division, hourly cost, per-employee flat tax estimates,
  annual hourly budgets, termination proportions, hires, horizons, variance and
  penetration/utilization use bigint intermediates and explicit half-away-from-
  zero rounding. Counts/plain percentages stay numeric. Months anchor UTC day 1.
  Mixed currencies and unsupported compensation models reject rather than sum
  unlike units. These are documented planning estimates, not statutory payroll.
- lib/db/schema/payroll.ts and generated 0011_hesitant_roxanne_simpson migration/
  snapshot add one nullable review currency snapshot. New reviews save base
  currency; historical null rows explicitly use the current-base bridge, with
  no migration-time inference or rescaling. Original row checksum coverage is
  preserved by excluding only this new snapshot in money-bigint.test.ts.
- Three dashboards parse exact major decimals in the shown currency into Minor
  strings and use existing exact signed display. Review/projection sums come
  from checked server totals; average band width uses bigint and marks mixed
  currencies. API and input failures are visible.
- PAYROLL_COMPENSATION_WIRE_CONTRACTS maps every operation, units/aliases/ranges,
  percentages/counts, snapshots, auth, status and forecast model. Manifest, test
  matrix, CI runbook and generated source inventory are updated.

## Acceptance mapping

1. Contract registry covers all 15 REST/MCP pairs, safe numeric coexistence,
   matching aliases, annual/monthly/budget units, dates, actual currency policies,
   nullable history, percentages, supported models and failures. Actual source
   matches that registry; no full-int64 or arbitrary-FX forecasting is claimed.
2. tests/integration/payroll-compensation.test.ts plus worker invoke actual API
   key authentication, REST handlers and MCP SDK transport, including full tool
   registration. Legacy/exact create/read/update/list/delete/review/equity and
   all three forecasts are exercised. Every route gets denied/expired/invalid
   key cases; all 15 MCP tools get real permission denials. Foreign review/band/
   employee and stored corrupt tenant joins cannot leak data.
3. Pure contracts and PostgreSQL fixtures assert malformed/conflicting/overflow
   aliases, invalid salary ranges/dates/percent/counts, safe maximum/above-int32
   values, aggregate overflow, base mismatch and unsupported history. Snapshot
   comparisons prove failed requests do not mutate. Audit-trigger fault injection
   rolls back row/audit together; concurrent entry creates commit only one entry.
   Projection/what-if/budget expected amounts are independently asserted (6017
   monthly gross, 1103 flat tax, 4914 net; 4018 scenario gross; 72204 annual budget).
   Migration compares every original review field and reruns idempotently; saved
   review currency survives a later base-setting change.

## Verification and corrections

Commands ran from the repository root. PostgreSQL18 was initialized in a unique
temporary local trust-auth cluster, port 55484, timezone UTC. Explicit loopback
TEST_DATABASE_URL supplied random fixture databases; no .env credentials were
printed or existing application database reset/migrated.

| Command | Actual result | Scope/limitation |
|---|---|---|
| Controller validate/status/context/next/start MON-084 | Exit 0; valid 135-task graph | Orchestration only |
| npx drizzle-kit generate | Exit 0; 0011 generated | Additive nullable currency only; no production migration |
| node --import tsx --test tests/payroll-compensation-wire.test.ts tests/integration/payroll-compensation.test.ts | Initially 4/5; all 3 pure groups and migration case pass; workflow auth fixture corrected below | Canonical aliases, percentage/count/query guards and exact USD/IRR/KWD input/display |
| node --import tsx --test tests/integration/payroll-compensation.test.ts | Exit 0; 2/2 after correcting invalid token fixture | Actual workflow transport and historical migration cases |
| pnpm typecheck (final) | Exit 0 | MDX generation/tsc, no full build |
| pnpm lint (final) | Exit 0; 0 errors, 134 existing warnings | No new changed-service/tool/test warning |
| node --import tsx --test --test-concurrency=2 tests/*.test.ts tests/integration/*.test.ts | Exit 1; 333/334 pass, none skipped; sole missing-client backup failure passes in focused rerun below | All 258 pure and 76 integration cases have passing evidence across broad run plus corrective rerun; no all-green broad rerun claim |
| python .agentic/scripts/money_inventory.py --write; node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0; 415 columns, 1638 scanned files, 1267 consumers, 25377 occurrences | Lexical inventory/source hashes, not full dataflow |
| node .agentic/scripts/verify_legacy_money.mjs | Exit 0; 9 checks | No new legacy money consumers |
| node --import tsx --test --test-name-pattern='pre-expansion backup' tests/integration/money-bigint.test.ts with PG_BIN configured | Exit 0; 1/1 | Real dump/restore and exact historical checksum upgrade |
| git diff --check | Exit 0 | LF/CRLF checkout notices are not whitespace errors |

Initial development typechecks caught a DTO generic cast, stale Band UI interface
and fixture-only unknown runNumber field; these were corrected. The first focused
workflow run passed contract/migration cases but its invalid-key fixture used a
token without the required dk_ prefix, entering NextAuth's session path without
an active request scope. Corrected the fixture to an unknown dk_ API key and
reran successfully; no product auth change or session-test claim.

The broad regression initially encountered the backup fixture's missing matching
PostgreSQL clients on PATH. Configured PG_BIN to the existing PostgreSQL18 bin
directory for the focused rerun above; no application code was changed for that
environment issue. The completed broad run passed 333/334, with only this
environment failure. Its corrected real dump/restore rerun passes. All 334 distinct
cases (258 pure, 76 PostgreSQL integration) therefore have passing evidence, with
no skipped test and no pending failure. This is not a claim of an all-green broad
rerun. Final-source MON-084 fixtures also pass within that broad run.

## Review, limits and handoff

See MON-084-review-1.md for the implementing assistant's actual self-review.
Browser/session/OAuth/network transport, independent accounting approval,
multi-currency forecast FX, full-int64 business consumers, current-vs-historical
employee currency/type remediation and parent financial integration remain
unqualified. Legacy null review/run currency uses the documented current-base
bridge; invalid incompatible history fails rather than being repaired implicitly.
No full build, Next dev server, Docker, live provider, production migration,
deployment or IRR rollout was run or enabled.

Bounded slice implementation has no remaining blocker. Migration 0011 must
precede runtime use. MON-085 and parent MON-025 retain output/integrated acceptance.
Close controller, commit/push this task to origin/master under owner authorization,
verify remote SHA and clean tree, then stop. Next task is MON-085.
