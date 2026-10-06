# MON-088 attempt 1 - exact asset valuation and disposal contracts

## Identity and selection

2026-10-06, Asia/Tehran; actual operator coding-assistant. Repository
D:/Projects/dubbl, master, entry HEAD 3527005. Tree initially clean and matched
origin/master after fetch. Owner requested "complete and push next task".
Controller validate/status/context/next selected MON-088 and it alone was started.
Read root/nested instructions, project/map, backend role, source migration/API
sections, MON-011/MON-087 evidence, ADR-006 and relevant source/contracts.
This evidence is prepared before commit; no invented implementation commit,
independent reviewer or deployment. Parent MON-026 retains integrated acceptance.

## Implementation

`lib/api/asset-valuation-wire.ts` defines strict, fully described inputs,
canonical nonnegative safe numeric cents/Minor aliases, real Gregorian dates,
scoped UUID overrides, bounded notes and retry keys. Pure split arithmetic uses
bigint for signed equity and P&L changes. `asset-valuation.ts` implements three
shared direct-DB operations used by all three actual REST/MCP pairs. Tool
registration moves only the adopted handlers from the old fixed-assets file;
legacy CWIP capitalization is retained. No schema changes or migrations.

REST/MCP preserves legacy amount names/envelopes: impairment REST uses
revaluedAmount and revaluation output; MCP retains recoverableAmount and
impairment output. Numeric money coexists with explicit Minor strings. Disposal
REST adds MCP gain/journal parity and exact catch-up/carrying fields. Master
detail reads now allow signed impairmentAmount, including negative new losses.
All three dashboard dialogs use exact major-text-to-cents-string parsing instead
of parseFloat/Math.round. Existing display and fixed-cents units remain unchanged.

Valuation uses current carrying amount. Upward changes reverse available net P&L
impairment before increasing surplus; downward changes consume surplus before
recognizing negative impairment in P&L. Saved history must chain its carrying
amounts, exact signs and splits. Root NBV/surplus/latest valuation must agree.
Former MCP positive impairment loss histories fail 422 rather than being repaired
or read as recoveries. A separate reviewed remediation remains necessary.

Disposal removes adjusted gross cost (carrying plus accumulated depreciation),
uses actual current carrying for exact gain/loss and transfers equity surplus to
retained earnings. Ordinary time-based assets catch up only one unbooked month;
already-booked months never double-charge. Revalued/usage-driven assets have no
implicit catch-up. Non-GL tracking saves catch-up history and totals consistently;
partial disposal GL account configurations fail instead of silently dropping
charges/proceeds. The maximum-safe gross can reject even when each input fits.

All new/saved overrides are scoped and validated, including unused overrides;
new posting accounts must be active/live and in the current base. Default account
creation is transactional. Historical GL accounts may be inactive/deleted if
still owned and in the recorded base. Saved journals must be posted, balanced,
in-scope and losslessly 1:1 in the current base. Linked history requires matching
source/date/amount and an unreversed original. New lines stamp base currency and
exact quote-per-base 1:1; the existing trigger supplies scaled-bridge provenance.
Original journals never change. Asset rows still have no currency snapshot, so
implicit unposted currency histories remain parent qualification.

Organization-first and asset locks serialize these operations with adopted
master/depreciation writers. Legacy CWIP snapshot locks reject stale values.
New same-day valuation timestamps are strictly ordered under the asset lock,
avoiding concurrent transaction-start timestamp ordering. Period/fiscal-year
SHARE table locks protect the transactional staff/advisor/closed-year checks.
Cross-organization period-edit delay remains a performance qualification limit.

Audit retry keys are org/asset/action scoped; fingerprints use resolved amounts,
date, notes and overrides. Numeric/Minor clients replay across transports.
Identical unkeyed disposal also replays via a stable default key. Conflicting
inputs reject; a different key cannot reopen a disposed asset. Committed replay
does not repost even if a period later locks. All history/default accounts/GL/
totals/output checks/awaited audit commit or roll back together.

Depreciation and rollback after valuation remain explicitly unsupported by the
MON-087 guards. This slice establishes valuation/disposal carrying math without
inventing a remaining-life/usage schedule; that integration stays MON-026.
No production migration, currency flag, IRR/full-int64 rollout or deployment.

## Acceptance mapping

1. ASSET_VALUATION_WIRE_CONTRACTS documents all three pairs, exact aliases,
   signed outputs, supported cents/ranges, dates/UUIDs/notes, defaults, carrying
   policy, history/rate guards, retries/errors and remaining limits. Manifest,
   inventory, test matrix, CI runbook and money README reference this adoption.
2. Migrated PostgreSQL actual REST/API-key handlers and full registered MCP SDK
   transports cover legacy/exact clients, exact-created max-safe assets, tool
   descriptions/strict schemas, two tenant boundaries and a third isolated fault
   tenant, custom denied permissions, staff tiers and expired/invalid credentials.
   Known signed depreciation/revaluation/impairment/recovery/disposal chains
   assert exact amounts, adjusted gross removal and surplus transfer.
3. Whole-table snapshots include assets, depreciation, revaluation, journals,
   lines, chart accounts and audit. Syntax/range/scoped/account/date/period/
   terminal/unsupported-history failures preserve state. Each operation through
   both transports rolls back injected audit/root-output faults. A new tenant
   proves default account creation rolls back too. Injected unsafe GL output,
   derived gross overflow, saved foreign journals/currency and positive legacy
   impairment fail. Concurrent keyed valuation and unkeyed disposal replay once;
   concurrent depreciation/disposal charges the month once. Same-day chains and
   stale snapshot/master economic writes are checked. Final scoped checks pass.

## Verification

All commands ran from D:/Projects/dubbl. A disposable PostgreSQL 18 cluster bound
to 127.0.0.1:55488 with UTC timezone used synthetic identities. Integration tests
created/migrated/dropped random databases; no .env application database was read,
migrated, seeded or reset. No credentials were printed or committed.

| Actual command/procedure | Observed result | Limits |
|---|---|---|
| Controller validate/status/context/next/start and pre-closure validate | Exit 0; 140 tasks valid, MON-088 selected | Structural tracking only |
| node --import tsx --test tests/asset-valuation-wire.test.ts tests/integration/asset-valuation.test.ts tests/integration/asset-master.test.ts tests/integration/asset-depreciation.test.ts (final) | Exit 0; 5/5, no skips; 11401.4 ms | Two pure groups, three actual PostgreSQL/transport workers; bounded asset regression |
| pnpm typecheck (final) | Exit 0 | MDX/tsc only |
| pnpm lint | Exit 0; 0 errors, 129 existing warnings | Full repository; later review refinements covered by changed-file ESLint |
| Changed-file ESLint (final) | Exit 0, no warnings | Service/wire/master/tool/index, fixtures and dashboard |
| python .agentic/scripts/money_inventory.py --write; node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0; 415 columns, 1666 scanned files, 1272 consumers, 25445 occurrences | Lexical hashes/source coverage only |
| node .agentic/scripts/verify_legacy_money.mjs | Exit 0; 9 checks | Legacy import regression gate |
| git diff --check | Exit 0 | LF/CRLF checkout notice only |
| Disposable PostgreSQL cleanup | Zero random fixture databases; pg_ctl stop succeeded | Cluster files remain only in system temp; no app DB reset |

Initial typechecks caught a nullable account helper result and a test tuple spread;
corrected both and reran. Initial integration exposed disposed-state validation
running after active carrying-history checks; moved the terminal guard before
history (after committed replay) and reran. Additional review tightened historical
split/link/source/amount checks, added monotonic same-day timestamps, default-account
fault and derived-gross fixtures. Final typecheck/fixtures/changed-file lint include
those refinements. No full build, unrequested dev server, Docker, provider call,
full repository test regression, controller implementation tests, browser/session/
OAuth or production financial qualification ran; the controller was unchanged.

## Review and handoff

See MON-088-review-1.md for actual implementing-assistant self-review. No slice
blocker remains. Finish controller check/submit/self-review/done, validate/status,
authorized commit/push to origin/master and verify remote SHA/clean tree; stop.
Next task MON-089 covers CWIP cost/capitalization. MON-026 retains integrated
depreciation-after-valuation/currency/lifecycle qualification and independent
financial review; production/IRR/full-int64 and performance gates stay open.
