# MON-097 attempt 1 - exact accrual schedule and posting contracts

## Identity

2026-10-06, Asia/Tehran. Implementing operator: codex. Entry HEAD
8987252834dcce1c235c2bdd0e199c386940df48 on master; clean working tree at entry.
Task changes are uncommitted at evidence creation. Review is the implementing
assistant's self-review, not independent peer/human/accounting/deployment approval.

## Implementation and scope

Controller validate/status/context/next selected MON-097 and start claimed it.
Read root/nested instructions, START_HERE, controller/project/repository map,
backend role, task/MON-011 dependency evidence, ADR-006, money manifest, source
migration/API compatibility sections and actual accrual schema/REST/MCP/drawers.

Added shared accrual-wire/schedules services and replaced three independent
REST routes and five MCP tool handlers with scoped direct-DB service delegation.
Exact aliases preserve REST decimal-major and MCP integer-cents inputs. Decimal
ratio rounding, monthly floor division and last-period remainder use bigint;
all outputs retain safe numeric cents with explicit Minor strings. Dates retain
the existing month-overflow policy in UTC, with bounded count/date/range guards.

All five operations require manage:accruals, including the formerly unguarded
REST cancellation. Org-owned live source/accounts, contiguous and conserved
saved allocations, journal balance/currency/identity FX, orphan/duplicate/foreign
history and saved state are validated. Post checks period tiers and closed fiscal
years inside one transaction. Organization/schedule locks serialize writes;
bounded complete-transaction retries cover SQL serialization/deadlock and journal
number unique conflicts from still-legacy writers. TABLE SHARE locks guard
concurrent legacy period/fiscal-year writers including absent rows.

Create keys normalize both transports; post keys or period targets safely replay
without advancing. Existing unkeyed/untargeted post intentionally advances the
next period, and empty REST bodies still work. Cancel retries are idempotent and
leave posted history intact. Rows/entries/journals/legs/status/output preflight
and audit commit or roll back together. Existing audit JSON stores replay results;
no new table/schema/migration is required. Registered MCP names/envelopes remain.

Dashboard create sends exact text and a stable retry key; post sends the visible
next period UUID. Fixed-cent display uses the existing bigint helper and list
summary sums stay exact above JS precision. English/USD presentation is retained.
Removed two unused ESLint directives in the touched list page. Registry,
manifest, CI runbook and generated source inventory are refreshed.

## Acceptance mapping

1. ACCRUAL_WIRE_CONTRACTS documents all five operation pairs, envelopes, fields,
   fixed cents versus REST major units, aliases/ranges/rounding, dates, counts,
   roles/scopes/locks, retry behavior, errors and accounting limits. Pure fixtures
   verify decimal ties and alias disagreement before rounding, safe maximum,
   malformed/unsupported values, conserved exact splits, zero early periods,
   end bounds and legacy month overflow.
2. Isolated migrated PostgreSQL fixture invokes actual API-key REST handlers
   and full registerAllTools SDK transports. All five pairs, numeric/exact/dual
   clients, USD/JPY/KWD/IRR fixed units, custom-role denial/allowance, foreign orgs,
   spoofed header, invalid/expired keys, foreign/inactive/deleted/FX accounts,
   foreign/draft source journals, period/advisor/fiscal-year gates are exercised.
3. Unsupported inputs/history/output fail without task-owned mutation. Snapshot
   comparisons cover schedules/entries/journals/lines/audit. Audit-trigger failures
   roll back all three writers on both transports; unsafe returned entries and
   journal leg disagreement also roll back prior inserts. Keyed create/post races
   retain one root/period; unkeyed races advance distinct periods; cancel/post
   serializes. A one-shot PostgreSQL numbering unique fault verifies a whole
   transaction retry. Terminal/key/target/cancel replays preserve history.

## Verification

Commands ran in D:/Projects/dubbl. Disposable PostgreSQL 18 UTC cluster at
127.0.0.1:55497, synthetic dubbl_fixture role without application credentials.
Explicit TEST_DATABASE_URL points there; harness creates/migrates/drops random
dubbl_ci_ databases. Configured local application database was not touched.
Fault injection affects only random fixture databases. One temporary user-trigger
disable makes synthetic pre-expansion null-exact-FX history available for reads;
the normal migration synchronization rejects clearing an already exact FX field.

| Actual command/check | Result | Limit |
|---|---|---|
| node --import tsx --test tests/accrual-wire.test.ts tests/integration/accrual-schedules.test.ts, final behavioral run | Exit 0; 3/3, no skips; 14627.0057 ms | All five actual REST/MCP pairs plus two pure groups |
| pnpm test | Exit 0; 302/302, no skips | Pure/unit suite; final UI display edits verified by typecheck/lint |
| pnpm typecheck, final after service/fixture/UI changes | Exit 0 | MDX generation and tsc; no Next build |
| pnpm lint, final | Exit 0; 0 errors, 125 existing warnings | Warning count reduced from previous task's 127 |
| pnpm exec eslint on all changed TypeScript/routes/UI/fixtures | Exit 0; clean | After removing two unused list directives |
| python .agentic/scripts/money_inventory.py --write; node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0; 415 columns, 1310 consumers, 25864 occurrences | Source/hash/line and Drizzle inventory, not production qualification |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0; nine gate checks | No new legacy math consumers |
| git diff --check | Exit 0 | Git LF/CRLF notices only |
| python .agentic/agent.py validate/status/context | Exit 0; initial 149 tasks valid | Structural validity, not authenticity of implementation |

Initial typecheck identified union-field narrowing and a heterogeneous tuple
spread in pure fixtures; fixed both. Initial integration stopped when a fixture
tried clearing rateExact through a migration synchronization trigger. Confined
synthetic legacy history setup to fixture user-trigger disable/enable; final run
passes. Replaced concurrent queries on a single read transaction with sequential
detail loading after a pg deprecation warning. Self-review added orphan-journal,
saved-state and journal-number retry guards with meaningful fixtures.

No full build, Next dev server, browser screenshot, Docker, live provider,
deployment, application DB mutation, schema/migration generation, IRR enablement
or independent accounting/human review was performed.

## Review and handoff

See MON-097-review-1.md. No task blocker remains. Accrual tables have no currency
snapshot: non-two-decimal posting and malformed legacy history reject explicitly;
no historical currency policy or repair is invented. Full-int64, history/FX,
performance and MON-028 combined integration acceptance remain wider gates.
Stop after MON-097; next controller-selected task is expected MON-098.
