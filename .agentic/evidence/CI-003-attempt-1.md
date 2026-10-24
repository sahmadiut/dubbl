# CI-003 attempt 1 - current GitHub CI repair and owner-change preservation

## Identity and scope

Operator and actual self-reviewer: codex-task-014. Main checkout entered at
`8deaff54763dd94e34216e6444ab8db19d488e61`. The owner explicitly requested
committing their existing changes as well as investigating and committing a CI
repair. The isolated RTL-006 worktree and its unfinished task were not modified,
integrated, reset, staged or counted complete.

The ten reviewed owner-authored files were committed separately and unchanged as
`1e1ffde210285370345d72f85853b44895553ec7` (48 additions, 32 deletions). They cover
RTL-neutral lifecycle connectors, matching persisted default CRM-stage labels,
dashboard-only Persian rial placement after the amount, and shared directional
back-arrow CSS. Owner-file ESLint and whitespace review passed; the first
`pnpm typecheck` also completed with exit 0. No owner files remain uncommitted.

## Authoritative failure

GitHub run [40132766994](https://github.com/sahmadiut/dubbl/actions/runs/40132766994),
head `8deaff54`, was inspected live with `gh run view --json jobs` and
`gh run view --log-failed` against the explicit `sahmadiut/dubbl` repository.

- Test / `pnpm test`: 1499 passed, 18 failed, 1517 total.
- PostgreSQL Migration Fixtures / `pnpm test:integration`: 183 passed, 2 failed,
  185 total.
- Hosted lint, typecheck and controller jobs passed. Build and downstream
  migration/deployment jobs were skipped; no successful build is inferred.

The exact 20 titles and locations are retained in
[CI-003-hosted-failures.json](CI-003-hosted-failures.json). The unit failures span
accounting/sales/purchasing composition, budget composition, consolidation, CRM,
forecast/calendar, inventory assembly, project composition, VAT and warehouses.

## Cause and repair

The amount fixtures still used English/default helper presentation after the
rendered pages adopted the active locale and numeral preference. Expected
amounts now receive that same explicit presentation; fixture source amounts,
int64/low-order-digit comparisons, escaping, currency codes, org headers,
canonical mutation bodies and export assertions remain unchanged. The settlement
fixture uses the independent expected-character mapper, and the warehouse
illustration asserts a literal Persian currency/number string at its documented
zero-decimal authored scale.

VAT direct-callback fixtures called a component using `usePresentation` outside
a React render. They now capture the real component tree under the existing real
dual-identity presentation provider. Production hooks, templates, callbacks,
queries, validation, cache, cancellation and canonical exports are retained.

Both signing workers controlled `next-intl/server` but omitted the newer
request-scoped `getPresentation` boundary. The public signing server page then
called Next `cookies()` outside a request. Each worker now supplies only a
controlled English presentation at that boundary. Real signing handlers,
authorization, snapshot services, registered MCP tools, database work, SMTP
capture and race/tenant guards still execute. No production auth or locale
resolver was weakened.

The owner's new dashboard amount/unit order is proved with independent literal
Persian strings, including the negative value. The admin back-arrow test now
checks the real shared global selector and compiled rotation instead of requiring
a removed local utility class. The owner implementation was not changed.

This repair changes test fixtures and generated consumer inventory only; it adds
no production endpoint, MCP operation, schema, financial transformation or
provider behavior. Stripe remains untouched.

## Reproduction and verification

1. Initial affected unit baseline reproduced the stale settlement expectation;
   that broad run was deliberately stopped under memory pressure and is not
   claimed complete.
2. Initial two-file integration baseline reproduced the exact missing-request
   cookies stack in opaque/public integration. The signing worker timed out at
   its 120-second limit under concurrent memory pressure; that is recorded as a
   failed run, not a pass. A direct `getPresentation` invocation independently
   reproduced the same missing request-scope boundary.
3. Initial corrected VAT/warehouse run: 20/21. Its sole remaining test expected
   `.00` for an intentionally zero-scale authored illustration; the independent
   literal was corrected before the final run.
4. Final command:

   `node --import tsx --test --test-concurrency=2 tests/accounting-sales-purchasing-catalog-integration.test.ts tests/asset-loan-budget-accrual-catalog-integration.test.ts tests/consolidation-pack-catalogs.test.ts tests/crm-catalog-integration.test.ts tests/forecast-calendar-catalogs.test.ts tests/inventory-assembly-catalogs.test.ts tests/project-catalog-integration.test.ts tests/vat-return-catalogs.test.ts tests/warehouse-catalogs.test.ts tests/dashboard-overview-catalogs.test.ts tests/rtl-shells.test.ts`

   Exit 0, **73/73**, no skips/cancellations, about 207 seconds.
5. Final integration command, with explicit loopback `TEST_DATABASE_URL`:

   `node --import tsx --test --test-concurrency=1 tests/integration/invoice-signatures.test.ts tests/integration/opaque-public-integration.test.ts`

   Exit 0, **3/3**, no skips/cancellations, about 73 seconds. A task-owned
   PostgreSQL 18 cluster bound only to `127.0.0.1:55439` was initialized with
   `max_locks_per_transaction=256`; fixtures created/migrated/dropped random
   databases. The cluster was stopped after verification. No application
   `.env`, database target or data was used.
6. An exact-title comparison maps all 18 hosted unit failures and both hosted
   integration failures to final passing cases. See
   [CI-003-local-coverage.json](CI-003-local-coverage.json).
7. Final test-inclusive `pnpm typecheck`: exit 0. No full build/dev server run.
8. `pnpm i18n:check`: 10702 keys per locale, pass.
9. `python .agentic/scripts/money_inventory.py --write` and
   `node --import tsx .agentic/scripts/verify_money_inventory.mjs`: 417 columns,
   1867 consumers, pass. An explicit UTF-8 comparison with HEAD proves all 417
   complete schema classification records unchanged. Consumer hashes/occurrence
   lines were refreshed for the owner commit and repaired fixtures.
10. `node .agentic/scripts/verify_legacy_money.mjs`: all nine regression checks pass.
11. Owned/full lint: owned ESLint exit 0 with no warnings; full pnpm lint exit 0, 20 pre-existing warnings.
12. Controller structural validation, UTF-8 evidence/links and `git diff --check`:
    pass (370 structurally valid tasks before closure).

## Limits and handoff

The final local scope covers every failure from the inspected hosted run plus
the directly affected owner changes. No replacement hosted pass, entire 1517-test
unit run, entire 185-test integration run, full build, deployment, mounted browser
or native linguistic qualification is claimed. The CI repair is committed
separately from the owner commit; the parent supervisor owns any authorized
paired push and resumption of isolated RTL-006.
