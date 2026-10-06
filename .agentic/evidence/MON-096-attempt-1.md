# MON-096 attempt 1 - exact consolidation report contracts

## Identity

2026-10-06, Asia/Tehran. Implementing operator: codex. Entry HEAD
cf59745c4571274f397387836bbf725a8a3baf7b on master.
The working tree was clean at entry. Review is explicitly the implementing
assistant's self-review; no peer/human/accounting/deployment approval.

## Implementation and inspected scope

Controller validate/status/context selected MON-096 and start claimed it for
codex. Read root/nested instructions, START_HERE, controller/project/repository
map, backend role, task, MON-011/095 dependency evidence, ADR-006, money manifest
and SOURCE migration/API compatibility sections. Inspected actual consolidation
schemas, REST report/configuration routes, registered MCP tools, rate resolver,
shared configuration authorization, exact primitives and fixture harness.

Shared consolidation-report-service now loads public authorized members,
computes and preflights within one transaction for both REST and MCP. GET stays
read-only. Recalculation retains REST POST/query dates and adds the missing
recalculate_consolidation_report MCP operation. UUID/real Gregorian date schemas
are strict and described; dates/defaults are shared. No report monetary inputs
or existing consolidation-rate writer were found/introduced.

SQL GL sums and cap document amounts are read as text. Natural balances,
translation rational products, totals, per-entity CTA, elimination prefix
drawdown and halving use bigint. Exact integer rounding preserves v1 nearest
ties toward positive infinity; no fixed-cent currency rescale. Every report
monetary field gets a safe numeric and *Minor string alias. Account byEntity maps
retain only their original orgId keys and gain separate byEntityMinor maps.
Final unsafe values/int64 overflow fail classified 422. Rates used expose exact
quote_per_base strings, safe int32-millionths aliases, type/date/source/inverse
and base/quote currencies. Saved invalid FX never silently falls through.

Scoped GL/account and document/contact joins exclude foreign references. Both
transports require current access to live member organizations. GET uses a
repeatable-read read-only snapshot. Recalculation requires manage:reports and
parent period/fiscal-year checks, serializes with configuration writers, and
atomically computes/replaces every saved entry for group/endDate/preflights
returned storage/audits. Serializable/deadlock conflicts retry within a bounded
three attempts. Stale deleted/skipped/zero entries are cleared; other periods
and member ledgers are untouched. Each successful retry call is audited once.
Opposite entity CTAs retain their adjustments when the total cancels to zero.
investment_equity now honors its documented unimplemented/skipped status.

CONSOLIDATION_REPORT_CONTRACTS maps the two operation pairs, every alias, units,
ranges, rounding, resolution, errors and existing accounting limits. Manifest,
CI runbook and source inventory updated. No schema/migration, ledger posting,
historical rescale, IRR feature flag, provider request or deployment changed.

## Acceptance mapping

1. Registry documents GET/get_consolidation_report and
   POST/recalculate_consolidation_report, query/tool dates, explicit currencies,
   every numeric/*Minor alias/map, FX aliases and safe ranges. Pure wire fixtures
   verify signed edges, nested overflow, dates and unchanged map/metadata units.
2. Migrated PostgreSQL fixture invokes actual API-key handlers and full SDK
   registerAllTools over in-memory transport. Exercises both pairs, exact and
   legacy fields, real USD/JPY/KWD/IRR amounts, large exact products, sums that
   cancel above JS precision, CTA cancellation, intercompany caps, stub rules,
   invalid/expired keys, spoofed org header, custom permission denial/allowance,
   foreign/deleted roots, revoked/deleted members and parent lock/closed year.
   Existing configuration integration also passes.
3. Invalid dates/UUIDs/unknown fields, unsupported/conflicting/quarantined FX,
   missing/inexact fallback and unsafe final outputs fail without entry/audit/GL
   mutation. Triggered audit failure and storage disagreement roll back prior
   deletion/insertion. Actual concurrent recalculations retain one current row;
   presentation-currency change is rejected once entries exist; concurrent
   deletion either follows persistence or makes it return 404. GET stays pure.

## Verification

All commands ran in D:/Projects/dubbl. New disposable PostgreSQL 18 cluster on
127.0.0.1:55496, timezone UTC, synthetic dubbl_fixture role with no application
credentials. Explicit TEST_DATABASE_URL points to that server; the existing
harness creates/migrates/drops random dubbl_ci_ databases. Only synthetic fixture
consolidation-rate user triggers are temporarily disabled for malformed saved
history tests. No configured local application database was touched.

| Actual command/check | Result | Limitation |
|---|---|---|
| node --import tsx --test tests/consolidation-report-wire.test.ts tests/integration/consolidation-report.test.ts tests/integration/consolidation-config.test.ts (final behavioral run) | Exit 0; 5/5, no skips; 16813.8362 ms | Actual two report pairs and configuration regression in migrated fixtures |
| pnpm test | Exit 0; 300/300, no skips | Full existing pure/unit suite |
| pnpm typecheck (final after fixture annotation correction) | Exit 0 | MDX generation and tsc; no Next build |
| pnpm lint | Exit 0; 0 errors, 127 pre-existing warnings | Final changed-file lint separately clean |
| pnpm exec eslint on changed consolidation TS/routes and fixtures | Exit 0; no warnings | Direct changed-file check |
| python .agentic/scripts/money_inventory.py --write; node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0; 415 columns, 1715 scanned files, 1307 consumers, 25783 occurrences | Source-only inventory |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0; 9 checks | Existing regression gate |
| git diff --check | Exit 0 | Git LF/CRLF notices only |
| git fetch origin; git rev-list --left-right --count HEAD...origin/master | Exit 0; 0/0 before task commit | Verified current remote baseline |

Initial fixture iterations corrected a malformed API-key prefix (session auth
was outside Next request context), saved-rate corruption blocked by actual FX
sync triggers (now disabled only in the fixture during that check), and generic
MCP internal-error status expectations. A regression found extra orgIdMinor
keys inside the numeric entity map; the DTO now preserves that map shape and
the final pure/transport fixtures pass. CTA cancellation needed explicit document
currency rates in its fixture. Typecheck corrected widened role inference to
the owner literal. Comment encoding was repaired after diff review. The final
post-test annotation changes only TS inference, with no runtime behavior change.

No build, dev server, Docker, screenshot capture, provider, production migration
or deployment ran. The disposable server is stopped after verification; its
generated local data remains outside tracked files. No unrelated work existed
at entry or is included in the task commit.

## Review and handoff

See MON-096-review-1.md for actual self-review. No task blocker remains. Existing
symmetric cap, prefix fallback/custom/overlap behavior and informational variance
are documented accounting limitations; arbitrary rule accounting and full-int64
consumer cutover remain wider qualification work. MON-028 retains integration
acceptance. Stop after MON-096; controller's next task is MON-097 accruals.
