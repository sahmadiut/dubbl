# MON-099 attempt 1 - exact recurring payable document contracts

## Identity

2026-10-06, Asia/Tehran. Operator: codex. Entry HEAD
abf708f18b8158e71eae29e2285932fda00c058c on master; clean working tree at entry.
Task changes are uncommitted at evidence creation. Review is the implementing
assistant's self-review, not independent peer/human/accounting/deployment approval.

## Implementation and source

Controller validate/status/context selected MON-099; start claimed it. Read root
and .agentic instructions, START_HERE, controller/project/repository map, backend
role, MON-099/MON-028/MON-011 evidence, ADR-006, source migration/API sections,
money manifest/inventory and actual schema/REST/MCP/UI/generator sources.

Added lib/api/recurring-payable-wire.ts and recurring-payable.ts. Five existing
REST files and registered recurring-template tools delegate bill/expense work to
shared org-scoped direct-DB services; summary now shares one safe aggregate query.
Added payable delete/preview and recurring-summary tools within the existing
registerRecurringTemplateTools registration in tools/index.ts.

Exact major strings and fixed-cent Minor aliases extend numeric major input.
Fixed cents never follow currency scale for payables, preserving legacy values.
Bigint ratios implement signed Math.round ties, price/quantity rounding, bill
net/tax and totals. Expense generation retains gross-only, no template discount/
tax behavior; both generate drafts, without automatic ledger posting.

Strict headers/dates/UUIDs/line bounds, scoped live contact/account/tax checks,
creator membership and supported saved output guard writes/reads. Organization
and template locks serialize CRUD/generation. Whole catch-up preflights dates,
period/fiscal-year gates, due-date/occurrence bounds and all financial totals.
Numbering, documents/lines/items, schedule/status and per-occurrence audits commit
together; create/update/pause/delete also audit transactionally. Persisted create
lines are reloaded before commit. Runs recheck selected status/deletion; retries
and concurrent runs do not duplicate occurrences. Catch-up cap is 1000.

Existing MON-044 invoice and MON-037 journal service branches remain in use.
Existing invoice fixture's expected recurring-tool count updates from 8 to 11;
its completed evidence is unchanged. Two payable dashboards now submit exact
major text instead of parseFloat money. No other UI behavior changes.

RECURRING_PAYABLE_WIRE_CONTRACTS maps actual remaining auxiliary configuration
money writers to organization/tax/approval/banking/payroll/procurement/asset/
project/consolidation/report/opaque owners, with explicit non-money controls and
outstanding boundaries. Updated money manifest/README/test matrix/CI runbook and
refreshed generated MONEY_BOUNDARIES source hashes/lines. No schema edits.

## Acceptance mapping

1. Registry maps list/create/get/update/delete/pause/preview/summary, MCP manual
   run, Trigger maintenance delegation, inputs/outputs/envelopes/units/aliases,
   numeric ranges, non-money fields, supported dates, locks and replay policies.
   Pure fixtures verify signed ties, major/minor alias agreement, malformed/
   unsafe rejection, fixed cents and exact bill/expense arithmetic.
2. Actual API-key REST and registered recurring MCP SDK fixtures exercise legacy,
   exact and dual aliases on bill/expense templates in USD/JPY/KWD/IRR. Spoofed
   org headers, cross-org roots/contact/account/tax, custom role denial, invalid
   keys, malformed JSON/UUIDs, CRUD/preview/summary and manual generator run are
   exercised. 64 generated documents assert bill total 1856 versus expense 1875.
3. Snapshots prove unsupported inputs/history and injected header/line/item/
   audit/schedule faults leave task tables unchanged. A second-occurrence failure
   rolls back the first occurrence and bill numbering. Unsafe persisted-create
   output rejects/rolls back. Bill/expense generation races yield one result per
   occurrence; replays return zero. Safe-max totals persist exactly. Foreign
   saved accounts, removed creator membership, period/fiscal-year gates, excessive
   catch-up and deleted/paused/future templates are checked. Invoice/journal
   integration regressions pass through the shared dispatch.

## Verification

All commands ran in D:/Projects/dubbl. Disposable PostgreSQL 18 UTC cluster at
127.0.0.1:55499; synthetic dubbl_fixture role, no application credentials. Explicit
TEST_DATABASE_URL; harness creates/migrates/drops random dubbl_ci_ databases.
Fault/unsafe-output triggers affect only fixture databases. Configured application
DB was not accessed. The task-created cluster was stopped after checks.

| Actual command/check | Result | Limit |
|---|---|---|
| node --import tsx --test tests/recurring-payable-wire.test.ts tests/integration/recurring-payables.test.ts tests/integration/recurring-invoices.test.ts tests/integration/recurring-journal-wire.test.ts, final | Exit 0; 5/5, no skips; 12776.0865 ms | Actual REST/MCP/generation plus two pure groups and core regressions |
| pnpm test | Exit 0; 306/306, no skips | Pure/unit suite |
| pnpm typecheck, final | Exit 0 | MDX generation and tsc; no Next build |
| pnpm lint | Exit 0; 0 errors, 123 existing warnings | Same baseline warning count |
| pnpm exec eslint on changed services/tools/routes/UI/fixtures, and final changed server/test files | Exit 0; clean | Final UUID validation included |
| python .agentic/scripts/money_inventory.py --write; node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0; 415 columns, 1317 consumers, 25992 occurrences | Drizzle/source/hash/line inventory, refreshed after final edits |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0; nine regression checks | No new legacy money consumer |
| git diff --check | Exit 0 | LF/CRLF notices only |
| python .agentic/agent.py validate/status/context/next | Exit 0; 149 structurally valid tasks at selection | Structure is not proof of implementation/review authenticity |

Initial typecheck found a missing closing brace in the new wire helper; fixed.
Initial integration found nullable unused mileageRate incorrectly included in a
non-null alias projector; retained null and projected actual amount only. A
negative-key fixture initially omitted the dk_ prefix and incorrectly entered
session auth outside a Next request; corrected to an invalid dk_ key. Review
added persisted-create-output validation, summary parity/safe aggregates,
catch-up bound, large totals and invalid UUIDs; final behavioral run passes.
A Windows text decoding artifact in early file edits was corrected using explicit
UTF-8; final UI diff contains only intended exact price changes.

No build, Next dev server, Docker, browser/screenshot, real provider/email,
deployment, schema/migration generation, application DB mutation, IRR enablement
or independent accounting review was performed.

## Review and handoff

See MON-099-review-1.md. No task blocker remains. Per-template generation is
atomic; org-wide sweeps deliberately commit one template at a time. Creates
remain distinct; pause remains a toggle; PATCH status is repeatable. Payables
retain draft, fixed-cent and expense gross-only policies. Reverse-charge economic
policy, posted-history repair, full-int64/FX/IRR/performance and MON-028 combined
acceptance remain separate gates. Stop after MON-099; read live controller next.
