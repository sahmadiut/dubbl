# MON-065 attempt 1 - exact bank categorization contracts

## Identity

2026-10-04, Asia/Tehran. Operator codex, implementing assistant; no delegation,
independent peer/human financial review or production approval. Entry HEAD
92ad956, master, clean tree. Controller validate/status/context selected MON-065;
claimed with owner codex. User explicitly requested completion, commit and push.
Evidence describes uncommitted work before closure/publication, not an invented SHA.

Read root/nested AGENTS, START_HERE/controller/project/repository map/backend role,
MON-011 dependency evidence, ADR-006, task/money/source compatibility and migration
sections, and MON-042/045/048/051 carrying/settlement handoffs. Matching/payment,
noncash and final combined acceptance remain assigned; no receipt/payment carrier
or recognition code is changed by this categorization slice.

## Implementation

- New bank-categorization-wire.ts strict described schemas and explicit aliases;
  split numeric amounts remain minor units. REST expense numeric input remains
  major units; the new MCP bank-expense numeric input follows integer minor-unit
  convention. Both accept decimal-major amountExact and canonical amountMinor
  with agreement and safe coexistence guards. Currency defaults to bank currency.
- New bank-categorization.ts shared direct-DB/AuthContext services for categorize,
  split-account, create-expense, per-item bulk and same-account cash code. Four
  existing REST handlers call them; five tools register through one new MCP file.
  Removed replaced registrations/implementations from bank-transactions/bulk,
  retaining unrelated tools. Numeric output envelopes/MCP transaction IDs remain.
- Exact bigint allocation sums, tax ratios/residuals, currency-scale historical FX,
  safe journal totals and saved rate aliases replace floating categorization math.
  Standard/partial/blocked/exempt/US/reverse-charge behavior is explicit and shared;
  compound taxes are rejected rather than silently ignored. Every expense item's
  category is posted; missing categories use a validated fallback.
- Org/bank/movement locks and scoped ownership precede decoding. Live references,
  account/tax applicability, exclusive bank GL link, saved movement currency,
  period locks and fiscal closure are enforced. Self-link/control/fallback creation,
  journal/bank/expense writes, corrections and audits roll back together. Bulk
  retains partial success with per-item atomicity, not whole-batch atomicity.
- Plain correction verifies owned posted history, bank leg, balanced amounts and
  stored FX/base; it voids the old journal and posts with the saved quote, even when
  current quotes change or are absent. Split and bulk repeats fail; concurrent
  single corrections leave one active journal. Invalid history fails visibly.
- Bank-created expenses are paid and journal-linked, preventing ordinary draft
  approval/reimbursement from recognizing them again. Existing live expense audit
  identity also prevents recreation after a cleared bank journal link. Coordination
  of claim state with generic bank undo belongs to MON-068/MON-021; no automatic
  repair of old unlinked drafts or bad-unit data is claimed.
- Added pure tests and migrated PostgreSQL REST/MCP worker; public API/module/MCP
  docs, BANK_CATEGORIZATION_WIRE_CONTRACTS, MONEY_MANIFEST, TEST_MATRIX and generated
  money inventory are updated. No schema/migration or currency rollout flag change.

## Acceptance mapping

1. Registry operation/input/output/unit/range/FX/tax/history tables and public docs
   cover all four REST/five MCP boundaries. IDs/counts/envelopes remain stable;
   exact aliases are additive, supported amounts remain within safe Numbers.
   Tests exercise canonical syntax, alias conflicts, safe edges and USD/JPY/KWD/IRR.
2. Actual exported REST handlers use authenticated synthetic API keys with custom
   roles, invalid/expired keys and spoofed org headers. Registered MCP SDK tools
   run through linked InMemoryTransport with AuthContext and strict schemas. All
   five migrated operations, numeric/exact/dual aliases, cross-org parents and
   references, missing/deleted/inactive resources, and duplicate registration are
   asserted. New bank-expense tool's integer-minor numeric inputs are verified
   against decimal-major REST inputs across 0/2/3 decimal currencies.
3. Before/after SQL snapshots assert unchanged financial/audit state on rejection.
   Safe-limit bank values post; unsafe persisted values and allocation/tax/FX sums
   fail. FX corrections retain saved rates; corrupt bank legs/base changes fail.
   Period/fiscal/item-date locks, compound tax rejection, paid claim linkage and
   duplicate approval/creation protection pass. Forced audit trigger failures after
   earlier bank link/journal/claim writes roll everything back, including previous
   journals on failed correction. Concurrent split and expense requests create
   exactly one posting/claim; single categorize concurrency leaves one active entry.
   Partial bulk, invalid full schemas and duplicate items retain documented results.

## Verification

All commands ran in D:/Projects/dubbl with installed dependencies. Synthetic
PostgreSQL 18 cluster at D:/Temp/dubbl-mon065-pg-cca1165775bf4342a012926d77bc0ee8/data,
loopback port 55475, trust-auth fixture only. The harness uses explicit synthetic
TEST_DATABASE_URL and creates/migrates/drops randomly named disposable databases;
it does not read/use or migrate/reset the configured .env database. Provider keys
are blank in workers. Final psql disposable database count: 0; pg_ctl fast/wait
shutdown succeeded. Cluster files retained outside repository.

| Actual command/procedure | Result | Limits |
|---|---|---|
| Controller validate/status/context/start | Exit 0, valid 119-task graph, MON-065 selected/claimed | Orchestration only |
| `node --import tsx --test tests/bank-categorization-wire.test.ts` | 2/2 pass; final cases also in full suite | Pure schemas/arithmetic, not DB proof |
| `npm test` final | Exit 0, 191/191 pass | Existing pure suite plus new groups |
| `node --import tsx --test tests/integration/bank-categorization.test.ts tests/integration/bank-accounts.test.ts tests/integration/bank-transaction-reads.test.ts tests/integration/bank-imports.test.ts tests/integration/expense-crud.test.ts tests/integration/expense-lifecycle.test.ts` final, explicit synthetic test URL | Exit 0, 6/6 pass | Actual migrated PostgreSQL handlers/SDK, not browser/OAuth/providers |
| `npx tsc --noEmit` final runtime/fixture check | Exit 0 | No full build |
| `npm run typecheck` after public docs | Exit 0, fumadocs-mdx generation and tsc | MDX/types, no full build |
| `npm run lint` | Exit 0, 0 errors/148 existing warnings | Full run before final unit refinement; final affected lint clean |
| `npx eslint` all changed TS paths, then final affected service/schema/MCP/fixture paths | Exit 0, no warnings | Final unit refinement covered |
| Money inventory `--write` after source/docs, then read-only verify | Exit 0, no drift after final refresh | 410 columns, 1506 scanned, 1223 consumer files, 23949 occurrences |
| `verify_money_inventory.mjs`, `verify_legacy_money.mjs` | Final exit 0, 410 columns/1223 hashes and 9 legacy gates | Inventory integrity/legacy regression gate, not financial approval |
| `git diff --check` | Exit 0 | LF/CRLF notices only |
| `git fetch origin master`, divergence query | Exit 0, 0 ahead/0 behind before commit | Requested fork target only |

Initial fixture syntax, snapshot setup and payment field typing were corrected;
restored the period-lock import still needed by unrelated legacy tools. Initial
initdb failed because its own redirected log occupied the target; using a separate
data subdirectory fixed it. Final self-review changed the new MCP bank-expense
numeric field from major to minor units per project conventions; expanded actual
adapter scale/alias fixtures and reran all six integrations, full units and types.
Inventory drift after source/docs edits was refreshed; final inventory read-only,
Drizzle/hash and legacy verification passed before controller closure. These are repaired development failures, not passed checks.

No full build, Next dev server, Docker, production migration/deployment/provider
request, browser/session/OAuth qualification or independent accounting approval.
This is safe-number coexistence, not full-int64 or production IRR qualification.
Period configuration and other legacy writers do not share these locks yet.

## Review and handoff

Actual self-review: MON-065-review-1.md. No bounded task blocker. Close with the
controller, commit/push as user authorized and stop. Next task MON-066 bank document
matching. MON-068/MON-021 retain bank-expense undo coordination; MON-066..069 retain
other bank writers and MON-021 combined acceptance/AUD-002 discrepancies.
