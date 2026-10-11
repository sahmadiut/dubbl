# MON-134 attempt 1 - shared line editor and invoice creation money

## Identity and scope

2026-10-11, Asia/Tehran. Operator: coding-assistant; honest self-review only.
Entry master HEAD 132196c997ab37e05c91068f94cd525b92481ba5. Live controller
selected in-progress MON-134. The entry tree contained its partial shared editor,
InvoiceDrawer and document-editor adapter, plus the uncommitted MON-131 split
and MON-134..137 task records. Resumed that draft. The split records are required
to commit a coherent selected task/dependency graph; sibling work stays todo,
and none of the parent acceptance checkboxes is completed by this delivery.
No unrelated edits were found in the entry status. This evidence precedes commit.

Read root/nested instructions, START_HERE/controller/project/map/frontend role,
selected/sibling/parent tasks, relevant dependency evidence and money architecture
source, CORE_UI_MONEY_CUTOVER, MONEY_MANIFEST, lexical boundaries, invoice wire
contracts/calculator, REST/MCP handlers, shared inputs and disposable DB harness.
The user authorized one task completion/push and additionally the observed CI
repair documented in CI-expense-utc-midnight-fix-2026-10-11.md.

## Implementation and acceptance mapping

1. CORE_UI_MONEY_CUTOVER enumerates MON-134's shared editor and InvoiceDrawer,
   MON-135..137 and remaining payable/auxiliary ownership. document-editor.ts
   preserves bounded ASCII major price text, emits existing unitPriceExact,
   retains numeric quantity and basis-point units, and uses the actual invoice
   wire calculator for exact preview arithmetic/range checks. Bigint amounts
   drive currency-scale decimal display. Invoice creation explicitly uses REST's
   price-first policy. Currency is resolved through org-scoped customer/org GETs
   or selected explicitly, then included in the payload. Aborted old fetches and
   context keys protect customer/org resolution; the editor remounts for org
   changes so fetched tax choices belong to its org. The save button and handler
   gate unresolved/invalid input, and submission reparses prices without Number.
   Blank description submission fails before HTTP. No new public operation is
   needed: existing registered direct-DB MCP create_invoice accepts the exact
   fields and is tested rather than duplicated.
2. Five adapter tests and three actual React render tests cover USD/JPY/IRR/KWD,
   safe-edge low digits, sums, sub-minor positive/negative ties, tax-exclusive
   rounding, malformed/incomplete/unsupported/range failures, line bounds,
   quantity defaults/zero/fractional values, currency fallback and exact English
   display. The SQL editor fixture uses authenticated customer/org GETs, REST
   POST and registered MCP SDK transports. It checks resolved contact versus
   explicit currency, independent stored price/line/tax text totals, max-safe
   amounts, taxed decimals, fractional quantity, signed ties and low-digit sums.
   REST preview for USD 0.005 x 3 is 3 minor units; MCP preview/save remains 2
   under its independently adopted extended-price policy. Both are asserted.
   Existing invoice-write and expense-lifecycle suites verify domain guards.
   Rendered checks establish input labels, decimal keyboard mode, scrolling,
   exact totals and alert/suppressed totals; save/fetch effects are source reviewed,
   not live browser interaction tested. Synthetic IRR tests do not enable IRR.
3. Other shared-editor callers explicitly keep fixed-two/extended preview and
   two-fraction input defaults pending their domain-specific cutover. Those
   payloads were not migrated or qualified by this child. MON-135 owns saved
   invoice lifecycle; MON-136 other receivables and MON-137 recurring. Quantity
   remains numeric hundredths storage; deposit/tax/recovery percentages remain
   nonmoney basis-point controls. Blank price is zero; blank quantity is one,
   matching invoice write defaults; a supplied zero quantity remains zero.
   Source sections no longer parse monetary prices into Number, use floating
   monetary sums or toFixed money display. No schema/migration, stored-unit
   rescale, backend rounding, IRR flag or parent completion changed.

## Verification

All commands ran from D:/Projects/dubbl. No full build, Next dev server, Docker,
deployment, .env or application database access was used.

| Command | Actual result | Scope and limits |
|---|---|---|
| node --import tsx --test tests/document-editor-money.test.ts tests/document-editor-components.test.ts | Exit 0, 8/8 | Real adapter and React render; no browser effects |
| node --import tsx --test --test-concurrency=2 tests/integration/document-editor-money.test.ts tests/integration/invoice-writes.test.ts tests/integration/expense-lifecycle.test.ts | Exit 0, 3/3 | Real REST/MCP/SQL, migrated disposable databases |
| node --import tsx --test tests/integration/payment-expense-bank-integration.test.ts | Exit 0, 1/1 | Current GitHub failure repaired; snapshot-backed date denial retained |
| pnpm test | Exit 0, 391/391 | Complete repository unit suite |
| pnpm typecheck; pnpm exec tsc --noEmit | Exit 0 | MDX generation and TypeScript |
| pnpm exec eslint on eight changed/new TS/TSX files | Exit 0, no warnings/errors | Task and CI repair source |
| pnpm lint | Exit 0, 0 errors, 105 existing warnings | No full build |
| python .agentic/scripts/money_inventory.py --write, then verify; node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0 | 415 columns, 1952 scanned files, 1450 consumers, 27603 occurrences |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0, 9 regression checks | Legacy guard |
| python .agentic/agent.py --json validate | Exit 0, 187 tasks | Structural workflow only |
| python - with unittest discovery, excluding the two named exhaustive graph cases | Exit 0; 40 run, 39 passed, 1 Windows symlink-permission skip | Focused controller workflow regressions; full graph replay unverified |
| git diff --check | Exit 0 | No whitespace errors |
| synthetic psql fixture database count / pg_ctl fast stop | Count 0 / exit 0 | Dedicated cluster stopped; temporary cluster files retained |

Initial render test assumed Radix's selected No tax option text existed during
server rendering; removed that unsupported SSR assumption. Actual English labels
and data/totals are verified. Draft review found default callers displayed dashes
despite a valid fixed-two preview; corrected the display currency fallback.
Added save gating and revalidation on input/currency changes, including selecting
the already active currency without leaving saving disabled. Error/range checks
keep the existing supported safe numeric workflow, not complete signed-int64.

Dedicated PostgreSQL 18 cluster:
C:/Users/Sajjad/AppData/Local/Temp/dubbl-mon134-pg-6a4ae69d62234aab96be63a35498da5d,
127.0.0.1:55434, synthetic trust-authenticated dubbl_ci role, loopback only,
max_locks_per_transaction=256, jit=off. Explicit TEST_DATABASE_URL selected this
server; harnesses created/migrated/dropped random dubbl_ci_* databases. Workers
only received disposable DATABASE_URL. No application database was read/changed.
Final fixture database count was zero and the dedicated cluster stopped successfully.

The optional full controller suite was stopped during its first exhaustive graph
replay because it was outside this bounded task's required controller-validation
scope and slow on the local filesystem. No failures were reported before the
stop, but the full suite and both exhaustive replay cases are explicitly not
passed. Focused workflow regression tests exclude only those two full-graph
cases and retain actual split/dependency, queue, review, fingerprint, role,
completion and single-active-slot coverage. Result: exit 0; 40 tests in 84.881s,
39 passed and one existing Windows symlink-permission skip. Excluded only
test_full_graph_can_resolve_without_deadlock and
test_graph_resolution_includes_new_split_child from unittest TestLoader discovery.

## Review and handoff

Actual self-review: MON-134-review-1.md. No scoped blocker. Final editor org-key
TypeScript/changed-file ESLint and refreshed inventory/legacy checks passed.
Focused controller workflow tests passed (39 passed, one permission skip), and
final controller validation/diff checks passed. Complete check/submit/self-review/done,
commit the task, supporting split records and explicitly authorized CI repair,
push origin/master and verify remote SHA/tree. Stop after this child. Next is
MON-135. No new remote CI success, live browser, independent financial/locale/
migration/security review or production qualification is claimed.
