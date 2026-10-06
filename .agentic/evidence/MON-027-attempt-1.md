# MON-027 attempt 1 - project, CRM and pricing integration

## Identity

2026-10-06, Asia/Tehran. Operator: codex, implementing assistant. Repository
D:/Projects/dubbl, master, entry HEAD 0800d5f750c89d61cac20827c40578fe4cea568a.
Entry tree was clean; origin fetch showed 0 ahead/0 behind. User requested
completion and push of the next controller task. MON-027 was already in_progress
with resolved dependencies and was resumed rather than starting other work.
Read root/nested instructions, START_HERE/controller/project/map, backend role,
MON-011 and all four child attempt/review records, ADR-006, contract maps and
source migration/API compatibility sections, then inspected actual services,
routes, tools, schemas and fixtures. No delegation or independent/human approval.
This record precedes the authorized commit/push; resulting Git SHA is verified
after closure without changing immutable completion evidence.

## Implementation and acceptance mapping

1. PROJECT_CRM_PRICING_INTEGRATION consolidates every boundary through the four
   field/envelope maps: 10 pricing, 16 CRM, 48 project master/time and 7 billing
   pairs, plus the singular cost MCP adapter. It documents fixed cents, exact
   aliases, safe/int64 syntax bounds, physical units, currency rules, reference
   ownership, allocation/retry/locking and remaining historical/financial gates.
   MONEY_MANIFEST, master/billing contracts, money README and CI_RUNBOOK record
   parent qualification. Child evidence has not been rewritten.
2. New project-crm-pricing.test.ts/worker invokes actual API-key REST routes and
   complete MCP SDK registration with in-memory transport against a migrated
   random PostgreSQL database. Both transport directions verify inherited rates
   versus saved/explicit-zero rates, preview/invoice/master agreement, keyed
   replay, billed-time immutability, milestone remaining/deletion/reduction,
   tiered invoice prices and historical snapshots after price currency edits,
   shared owned contacts and explicit invoice-to-deal value transfer, JPY fixed
   cents and filtered CRM/project totals. Foreign headers/contacts/inventory/
   project roots reject; master details omit password fields. Fresh child workers
   qualify every pair, legacy/exact/agreed/null/maximal clients, roles and auth,
   saved references, audits/output faults and child lifecycle cases. Invoice/quote
   workers qualify the adjacent lookup.
3. Combined full domain/audit snapshots remain unchanged after bad aliases,
   unsupported exact inputs, foreign references, mismatched price currencies,
   billed edits and fixed-price reductions. Injected billing audit faults roll
   back numbering/invoices/lines/time allocations/project totals. Cross-transport
   races qualify master time edit versus invoicing, pricing tier edit versus
   invoice creation, and fixed-price reduction versus further allocation.
   Integration exposed an actual fixed master defect: after invoicing 1250,
   fixedPrice 1249 was accepted and made preview inconsistent. The regression
   failed before the fix. project-master.ts now calls the shared exported
   projectFixedInvoiced calculation inside its organization/project-locked
   transaction; a below-allocation price returns 409 before writes/audit in both
   transports. Equality remains valid; a 4500 invoice including 2000 recharged
   costs allows fixedPrice 2500 but rejects 2499. This avoids using totalBilled
   as the fixed allocation. No duplicate history calculation or numeric rescale.

## Verification

All commands ran in D:/Projects/dubbl. A new PostgreSQL 18 disposable cluster
listened only on 127.0.0.1:55427 with UTC timezone and synthetic identity.
Explicit TEST_DATABASE_URL lets the harness create/migrate/drop randomly named
fixture databases. Application .env credentials/configured DB were not opened,
migrated, reset or seeded. No schema changed or migration generation required.

| Actual command/check | Result | Scope/limitations |
|---|---|---|
| Controller validate/status/context/next and pre-closure validate | Exit 0, 144 tasks valid; MON-027 selected | Structural workflow only |
| node --import tsx --test --test-concurrency=1 tests/integration/project-crm-pricing.test.ts tests/integration/pricing.test.ts tests/integration/crm.test.ts tests/integration/project-master.test.ts tests/integration/project-billing.test.ts tests/integration/invoice-writes.test.ts tests/integration/quotes.test.ts | Exit 0; 7/7, no skips; 169746.8655 ms | All child transports and adjacent document regression, after service correction |
| node --import tsx --test --test-concurrency=1 tests/integration/project-crm-pricing.test.ts (final) | Exit 0; 1/1, no skips; 49295.8305 ms | Final added expense-excluding bound, fixed race and exact 409 assertions |
| pnpm test | Exit 0; 297/297, no skips; 52613.1072 ms | Full pure regression suite |
| pnpm typecheck (final) | Exit 0 | Fumadocs plus tsc --noEmit; no full build |
| pnpm lint | Exit 0; 0 errors, 127 existing warnings | Same baseline warning count |
| pnpm exec eslint lib/api/project-master.ts lib/api/project-billing.ts tests/integration/project-crm-pricing-worker.ts tests/integration/project-crm-pricing.test.ts (final) | Exit 0; no warnings | All changed TS clean |
| money_inventory.py --write, verify_money_inventory.mjs | Exit 0; 415 columns, 1704 scanned files, 1304 consumers, 25714 occurrences | Source/Drizzle/hash coverage only |
| verify_legacy_money.mjs | Exit 0; nine checks | Legacy import regression gate |
| Fixture DB count and pg_ctl stop | Zero random fixture databases remain; disposable cluster stopped | Temporary cluster files retained; no broad deletion |
| git diff --check | Exit 0 | Git LF/CRLF conversion notices only |

Initial combined fixture used an incorrect unprefixed CRM route path; corrected
to actual /crm/deals and /crm/pipelines. The fixed-price red regression then
proved the real defect before correction. A default-concurrency seven-worker run
failed during migrations: PostgreSQL reported out of shared memory and suggested
max_locks_per_transaction. Those random databases were cleaned by the harness;
the serial rerun above passed without modifying any DB setting. Parent combined
cross-writer races remain concurrent inside each worker. Existing pg client
deprecation output was visible in failing subprocess diagnostics; it did not
affect passing behavior. No application provisioning fix is claimed.

## Review and handoff

See MON-027-review-1.md for implementing-assistant self-review. All three parent
criteria are supported within the documented safe-number fixed-cents scope;
no parent criterion was inherited solely from child completion. No slice blocker
remains. Full-int64, FX/currency-scale migration, historical allocation repair,
high-volume/performance and independent accounting/production IRR/release gates
remain separate. No build, Next dev server, screenshot, Docker, live provider,
schema generation, deployment or production migration was performed.

Complete controller checks/submit/self-review/done, validate state, commit only
owned files and push origin/master as authorized. Verify remote SHA and tree,
then stop after this one task; use controller next for subsequent selection.
