# MON-151 attempt 1 - tax and core settings UI money

## Identity and scope

2026-10-12, Asia/Tehran. Operator: codex. Entry master HEAD
47b1e30c468d6ab2160023663b1f1dec90337832, clean tree. User authorized completing
and pushing the next controller task. validate/status/next selected MON-151 and
start claimed it for codex. This is one bounded frontend delivery, self-reviewed.
No schema/migration, REST/MCP operation, production flag, application DB, provider,
build, dev server, Docker or deployment change.

Read START_HERE, project/repository/controller/frontend instructions, selected task,
core ownership/manifest/boundaries, dependency records and MON-128 posting evidence.
Verified actual tax/report/organization/approval/rate services and registered MCP
contracts. Existing exact backend implementations are reused rather than duplicated.

## Implementation and acceptance mapping

1. Every listed consumer has explicit ownership in CORE_UI_MONEY_CUTOVER MON-151.
   Tax reports (VAT/drill, BAS, Schedule C, sales tax) validate report currency and
   safe numeric/Minor aliases before bigint totals and exact English presentation.
   Visual ratios convert only after bounded integer division; CSV keeps exact raw
   units as text and adds currencyCode. Frozen period lines adopt their aliases;
   organization base currency owns these existing implicit-base stored amounts.
   Settlement prefill/preview/payload share exact currency-scale parsing, send
   amountMinor, retain zero no-op and independent refund direction, and validate
   returned amount/currency against preview. Optional AccountPicker filters limit
   tax choices to base-currency bank assets. Workspaces reset by org/id; report
   reads reject obsolete filter replies, period reads abort, drill generations
   reject late replies, and settlement checks the active organization.

   Approval workflows reuse shared canonical signed int64 conditions for read,
   editor validation and save, with agreeing valueMinor on monetary fields. Raw
   thresholds remain document-currency minor units because workflows span currencies.
   Text fields, entry ordinals and deposit basis points retain their existing units.
   Currency settings validate source/base unrealized aliases and missing-rate nulls;
   manual rate input sends rateExact/quote_per_base without Number parsing/rounding,
   retaining the int32-millionths coexistence limit. General settings and period
   lists contain metadata/date/currency/status controls; tax rate/recoverability/
   component and procurement tolerance controls are nonmoney numeric basis points.
   Organization mileage/approval settings have no separate editor here; their
   services and existing domain consumers retain their recorded ownership.

2. Five focused behavior/static React groups verify USD/JPY/IRR/KWD scales, raw
   1250 compatibility, safe maximum, large low-digit totals, malformed/unsafe/
   conflicting aliases, fractional-minor rejection, English preview/errors, int64
   approval threshold and text/nonmoney policy, and exact FX coexistence rejection.
   New migrated PostgreSQL fixture exercises real authenticated REST plus linked
   registered MCP with actual UI adapters, independently checking SQL text. Four
   currencies cover frozen lines, report totals/drill and preview preservation;
   USD/JPY/KWD cover payment/refund settlement with saved preview agreement and
   exact GL totals. IRR reports/frozen fixture rows are synthetic; both settlement
   transports reject under the existing rollout policy. Canonical int64 approval
   writes and manual exact quote writes persist identically. Seven existing related
   suites retain transport negatives, tenant/permission/lock/lifecycle/rollback,
   configuration, mixed-currency and safe-range policies. No browser effects claim.

3. Compatibility exceptions are explicit in core ownership, manifest and money
   README. Safe numeric business coexistence remains +/-9007199254740991; optional
   checked old numeric reads remain compatible. Int64 approval thresholds are
   comparison configuration rather than an expanded settlement range. Current base
   metadata owns implicit-base frozen returns; no FX is inferred or history rescaled.
   Quotes remain positive int32 millionths, at most six significant fractional
   decimals and max 2147.483647, with no rounding. Basis points/counts/date/status/
   metadata controls remain nonmoney. No statutory, accounting, production IRR,
   full-int64 business, provider or live browser qualification. MON-133/MON-129/
   MON-007 retain independent integration acceptance.

## Database and actual verification

Dedicated PostgreSQL 18.6 fixture cluster:
C:/Users/Sajjad/AppData/Local/Temp/dubbl-mon151-pg-e3a73b776eb4444c86772c9a5e068470.
Loopback 127.0.0.1:55451, synthetic trust-authenticated dubbl_ci role, UTC,
max_locks_per_transaction=256 and jit=off. Explicit TEST_DATABASE_URL and PG_BIN
select this cluster. Fixtures create/migrate/drop randomized databases. No .env or
application DB access. Final fixture database count was 0; pg_ctl fast stop passed.
Stopped temporary cluster files remain. Local PostgreSQL 18, not PostgreSQL 16 CI.

All commands ran from D:/Projects/dubbl. Results are local, not hosted CI results.

| Command / procedure | Actual result | Scope/limit |
|---|---|---|
| node --import tsx --test tests/tax-ui-money.test.ts | Exit 0, 5/5 | Pure aliases/units, exact input/aggregate/approval/FX, real static React settlement rendering |
| node --import tsx --test --test-concurrency=2 tests/integration/tax-ui-money.test.ts tests/integration/tax-period-contracts.test.ts tests/integration/tax-report.test.ts tests/integration/approval-contracts.test.ts tests/integration/organization-settings.test.ts tests/integration/procurement-settings.test.ts tests/integration/tax-rate-contracts.test.ts tests/integration/forecast-fx.test.ts | Exit 0, 8/8 | New UI fixture plus seven related regressions, migrated disposable PostgreSQL |
| pnpm test | Exit 0, 471/471 | Complete pure suite; later changes were test type annotations and atomic report setter ordering |
| pnpm typecheck | Final exit 0 | MDX plus tsc only; final code/test/doc state |
| pnpm exec eslint on all changed TS/TSX plus tax directory | Final exit 0, no warnings/errors | Final changed sources/fixtures |
| pnpm lint | Exit 0, 0 errors/100 warnings outside changed files | Existing repository warnings; final report setter ordering separately linted |
| python .agentic/scripts/money_inventory.py --write | Exit 0 | 415 classified columns, 1534 consumers, 29417 source occurrences |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0 | Drizzle columns, source hashes and occurrence lines match |
| node .agentic/scripts/verify_legacy_money.mjs | Exit 0, 9 regression checks | Legacy money gate |
| python .agentic/agent.py validate | Exit 0, valid 202 tasks | Structural only |
| git diff --check | Exit 0 | LF/CRLF advisory warnings only |
| Source/layout/ownership review under DEC-005 | Complete | Existing keyboard controls/sheets, explicit settlement currency label, alert/status, wrapping and horizontal detail table; no screenshots/browser session |

Initial typecheck found generic spread/assignment and test inference errors; these
were corrected and final typecheck passes. Initial integration attempts corrected
fixture registration/tool names and a PostgreSQL numeric text-padding expectation;
final joint run passed. Bare-node inventory verification could not resolve TS
extensionless imports on Node 23; the proper --import tsx invocation passes.
No failed check is claimed as a pass. Inventory differences affect task-owned
sources only; MONEY_COLUMNS has no substantive change.

## Review and handoff

Self-review by codex: see MON-151-review-1.md. No human/peer review is claimed.
No blocker. Complete only MON-151 through controller acceptance/submit/review/done,
commit task-owned files and push origin/master as requested, then verify remote
SHA and tree. MON-152 is the next remaining ready child; do not begin it here.
MON-133/MON-129/MON-007 remain separate integration tasks. Push status/commit will
be reported after execution; this evidence does not fabricate a future commit.
