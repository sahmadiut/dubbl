# MON-098 attempt 1 - exact revenue schedule and recognition contracts

## Identity

2026-10-06, Asia/Tehran. Operator: codex. Entry HEAD
e4881050581205898c5f17458d146cdad9416e9f on master; clean working tree at entry.
Task changes are uncommitted at evidence creation. Review is the implementing
assistant's self-review, not independent peer/human/accounting/deployment approval.

## Implementation and scope

Controller validate/status/context/next selected MON-098 and start claimed it.
Read root/nested instructions, START_HERE, controller/project/repository map,
backend role, selected task/MON-028/MON-011 evidence, ADR-006, money manifest,
source migration/API compatibility sections and actual schema/REST/MCP/UI.

Added revenue-wire.ts/revenue-schedules.ts and delegated three REST files and
five existing registered MCP tools to shared scoped direct-DB operations. REST
decimal-major versus MCP integer-cents remain distinct; positive exact aliases
resolve with bigint ratios, floor allocations and final-period remainder.
Numeric compatibility stays bounded with explicit totalAmountMinor,
recognizedAmountMinor and entry amountMinor strings. Inclusive calendar month
counts, all method labels and UTC month overflow preserve the legacy allocation
policy, including overflow beyond endDate. Counts/years/dates are bounded.

All operations require manage:revenue, closing REST cancellation's missing guard.
Scoped invoice/line and live active posting-account checks precede inserts;
foreign line accounts never fall back. Existing account UUID fields snapshot
resolved accounts for new schedules. Draft invoices allow schedule preparation;
recognition requires an issued invoice, invoice/base currency agreement and
two-decimal base currency. Unsupported FX/scales reject explicitly because no
transaction currency/FX snapshot exists; fixed cents never rescale.

Complete allocations, exact recognized totals, contiguous history, status,
org-owned journals, two balanced identity-FX legs, orphan/duplicate references
and saved output are validated. Organization/schedule locks serialize writers;
bounded complete-transaction retries cover serialization/deadlock/journal-number
collisions. Period/advisor/fiscal-year gates are checked inside the recognition
transaction, with SHARE table locks protecting absent legacy lock/year rows.
Schedule/period/journal/legs/recognizedAmount/status/output/audit commit together.
Audit JSON retains normalized retry fingerprints and original responses.

Create keys normalize transports; recognize keys or period targets replay without
advancing; unkeyed/untargeted calls intentionally advance. Empty REST bodies
remain supported. Cancel retries preserve posted history without new audit.
Dashboard create sends exact major text and a stable key; recognize targets the
visible next period UUID. Fixed-cent display and list sums use bigint. Removed
two unused ESLint directives in the touched list page. Contract registry,
manifest, money README, test matrix, runbook and source inventory are refreshed.

## Acceptance mapping

1. REVENUE_WIRE_CONTRACTS documents all five operation pairs, original envelopes,
   inputs/outputs/units, aliases/ranges/rounding, monthly dates/methods, roles,
   references, currency/history guards, period gates, atomicity and retry behavior.
   Pure fixtures cover major/cents distinction, exact ties/alias disagreement,
   safe maximum, malformed values, conserved large/zero allocations and date bounds.
2. Migrated isolated PostgreSQL fixtures invoke actual API-key REST handlers and
   full registerAllTools MCP SDK transports. All five pairs, numeric/exact/dual
   clients, USD/JPY/KWD/IRR fixed cents, owner/custom denial/allowance, foreign
   roots/invoices/lines/accounts, spoofed org header, expired/invalid keys,
   inactive/deleted/type/FX accounts, draft/void/deleted sources, saved account
   snapshots and permission-aware period/fiscal-year gates are exercised.
3. Unsupported input/history/output leaves task-owned snapshots unchanged.
   Financial assertions cover exact recognized totals, balanced saved journals,
   zero periods, large periods, null legacy account references/identity FX,
   corrupt recognized totals/line/accounts/amounts/legs and orphan journals.
   Injected audit faults roll back all three writers on both transports; unsafe
   saved period output and changed legs roll back preceding writes. Keyed create/
   recognize races produce one result; unkeyed races advance distinct periods;
   cancel/recognize serializes. One-shot journal-number unique failure verifies
   complete-transaction retry. Terminal/key/target/cancel replays preserve history.

## Verification

All commands ran in D:/Projects/dubbl. Disposable PostgreSQL 18 UTC cluster at
127.0.0.1:55498, synthetic dubbl_fixture role without application credentials.
Explicit TEST_DATABASE_URL targets that cluster; the harness creates/migrates/
drops random dubbl_ci_ databases. The configured application database was not
touched. Fault injection and temporary user-trigger disable to synthesize null
pre-expansion exact-FX history affect only the random fixture database.

| Actual command/check | Result | Limit |
|---|---|---|
| node --import tsx --test tests/revenue-wire.test.ts tests/integration/revenue-schedules.test.ts tests/integration/accrual-schedules.test.ts, final run | Exit 0; 4/4, no skips; 16789.0947 ms | Revenue five pairs, two pure groups and previous accrual regression |
| pnpm test | Exit 0; 304/304, no skips | Pure/unit suite |
| pnpm typecheck, final | Exit 0 | MDX generation and tsc; no Next build |
| pnpm lint | Exit 0; 0 errors, 123 existing warnings | Two unused directives removed from previously 125 warnings |
| pnpm exec eslint on changed services/tools/routes/UI/fixtures, final | Exit 0; clean | After final UI import fix |
| python .agentic/scripts/money_inventory.py --write; node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0; 415 columns, 1313 consumers, 25963 occurrences | Source/hash/line and Drizzle inventory |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0; nine regression checks | No new legacy money consumers |
| git diff --check | Exit 0 | Git LF/CRLF notices only |
| python .agentic/agent.py validate/status/context/next | Exit 0; 149 tasks structurally valid | Controller structure is not implementation/review authenticity |

Initial integration found a fixture contact used displayName instead of required
name; corrected it. Typecheck found a missing useRef import in the dashboard;
corrected it and reran typecheck. Self-review added zero-method periods, corrupt
recognized totals, foreign saved invoice lines, legacy null account references
and corrupt saved-leg fixtures; the final behavioral run passes with all added
checks. No service changes followed the passing behavioral run.

No build, Next dev server, Docker, browser/screenshot, live provider, deployment,
application DB mutation, schema/migration generation, IRR enablement or
independent accounting review was performed.

## Review and handoff

See MON-098-review-1.md. No task blocker remains. Independent schedules and
caller-selected totals retain existing behavior: no aggregate invoice-total cap
or original invoice deferral policy is introduced. Unsupported history requires
separate remediation. Full-int64, FX/history, performance, economic workflow and
MON-028 combined acceptance remain wider gates. Stop after MON-098; expected next
controller task is MON-099.
