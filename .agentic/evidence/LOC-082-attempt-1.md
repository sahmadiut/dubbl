# LOC-082 attempt 1 - contractor catalogs

## Identity and scope

2026-10-21 (Asia/Tehran), Codex, D:/Projects/dubbl, master.
Entry HEAD: `84c81fce`; clean entry tree. Live validate/status/next selected
LOC-082; started exactly that child. Fetched origin/master and confirmed zero
ahead/zero behind before editing. The user authorized completion and push.
No subagents. The memory controller-task skill guided the workflow; current
repository/controller state governed selection and scope.

Read root/.agentic instructions, controller/project/map/frontend guidance,
task/parent, prior employee evidence, catalog contract and locale source sections.
Inspected both contractor pages, creation drawer, money helpers, actual master/
payment REST/MCP/shared-service envelopes, schemas and migrated fixtures.

## Acceptance mapping

1. Extracted authored contractor list/detail/creation copy into 74 paired
   `PayrollContractors` messages. Catalog validation reports 7,266 compatible
   keys per locale; all new Persian leaves contain Persian script. The
   [scope inventory](../registries/PAYROLL_CONTRACTOR_CATALOGS.md) records
   shared loading/cancellation ownership, technical examples, saved data and
   fixed-two cents exceptions.
2. Production JSX renders through real next-intl/PresentationProvider in both
   locales. Checked readers validate success/envelopes/displayed fields/enums/
   pagination and exact aliases before adoption. Failed reads and mutations
   use finite translated messages; raw server/parser/network/storage prose
   never reaches visible feedback. Missing-org creates release saving. Failed
   mutations retain forms, avoid navigation/false success, and confirmation
   cancellation sends no request. Read cleanup ignores obsolete responses,
   including load-more requests. Payment refreshes preserve unsaved fields;
   a failed follow-up read does not reverse verified mutation success.
3. Task handoff, catalog index, scope inventory and honest self-review retain
   provisional Persian and independent LOC-067/008/002/native/RTL acceptance.

Preserved cents input/display, canonical exact aliases, currency fallback,
Gregorian/UTC transport values, IDs, routes/methods/headers, optional nulls,
org-scoped services, registered MCP operations and financial/statutory rules.
Zero hourly rates render formatted zero instead of React's bare numeric zero;
null still hides the rate. Only ContractorDrawer and its import changed in
the shared drawer file. No schema/migration, provider, IRR flag or Stripe change.
Generated money inventory changes only scanned paths and source consumers;
schema-column classifications and other sections match entry HEAD.

## Actual verification

All commands ran from D:/Projects/dubbl.

| Check | Observed result | Boundary |
|---|---|---|
| Focused production rendering/callback and payroll money guard suite | 17/17 pass, no skips; 9.472 seconds | Controlled hooks/IO and portal/currency-picker boundaries |
| Catalog validation | Exit 0; 7,266 keys per locale | No native linguistic approval |
| Owned-file ESLint | Exit 0; zero errors/warnings | Both pages, shared drawer, reader, focused/guard tests and two workers |
| Full lint | Exit 0; zero errors and 51 existing warnings | No owned-file warnings |
| Migrated payroll master/payment fixtures | 3/3 pass, no skips; 121.908 seconds | Real REST, linked registered MCP and SQL on isolated PostgreSQL 18 |
| Typecheck | Exit 0 on initial and final-source runs | fumadocs-mdx and tsc --noEmit |
| Full unit/static suite, concurrency 2 | 1,171/1,171 pass; no skips; 443.298 seconds | Unit/static/render/callback scope |
| Money inventory/source and legacy gates | Exit 0; 417 columns, 2,384 scanned paths, 1,775 consumer hashes; nine legacy checks | Conservative source inventory and existing regression guards |
| Controller validation / diff checks | Pass during verification; repeat at closure | Workflow structure and diff whitespace |
| Owned Markdown links | 93 local targets exist | Task, index, scope, attempt and review |

```text
node --import tsx --test tests/payroll-contractor-catalogs.test.ts tests/payroll-ui-money.test.ts
node --import tsx --test --test-concurrency=2 tests/*.test.ts
node --import tsx --test --test-concurrency=1 tests/integration/payroll-master.test.ts tests/integration/payroll-payments.test.ts
pnpm typecheck
pnpm i18n:check
node node_modules/eslint/bin/eslint.js "app/(dashboard)/payroll/contractors/page.tsx" "app/(dashboard)/payroll/contractors/[id]/page.tsx" components/dashboard/create-drawer.tsx i18n/payroll-contractor-presentation.ts tests/payroll-contractor-catalogs.test.ts tests/payroll-ui-money.test.ts tests/integration/payroll-master-worker.ts tests/integration/payroll-payments-worker.ts
pnpm lint
python .agentic/scripts/money_inventory.py --write
python .agentic/scripts/money_inventory.py
node --import tsx .agentic/scripts/verify_money_inventory.mjs
node .agentic/scripts/verify_legacy_money.mjs
python .agentic/agent.py validate
git diff --check
```

The focused suite covers populated/empty/pending/not-found/error states, every
status/sort value, search, escaping, ICU plurals, zero/29/max-safe cents, nullable
currency, conflicting/missing/unsafe money aliases, invalid enums/pagination,
real creation/save/payment/process/delete callbacks, route/header/payload
contracts, optional null/omitted fields, failure retention, storage errors,
cancelled confirmations, invalid money rejected before IO, late read suppression,
load-more failure/staleness and follow-up read failure after mutation success.

The migrated master worker checks real REST/MCP creation, profile update,
list/detail and deletion envelopes through the new reader. MCP list results
are explicitly adapted to REST pagination for reader assertions without
changing either transport. The payment worker checks actual created/processed
payment results and contractor history; existing independent SQL, balanced
ledger, FX snapshots, audits, isolation, authorization and rollback checks remain.
Legacy expansion preservation also passed.

Database tests use a new OS-temp PostgreSQL 18 cluster on 127.0.0.1:6452,
trust authentication and max_locks_per_transaction=256; TEST_DATABASE_URL/PG_BIN
are process-scoped and each fixture creates/drops a randomized database.
After tests, a separate admin count confirmed zero remaining dubbl_ci_* DBs.
The isolated cluster is stopped. No application database was used.

The initial orchestration helper stalled reading an inherited pg_ctl pipe;
stopped that owned helper/server and used a file handle for process output.
The final test subprocess passed all three checks. Its wrapper then hit a
Windows console encoding error while printing Unicode result symbols; retained
and inspected the UTF-8 test log, verified the pass/fail totals, and independently
checked database cleanup. The wrapper's finally stopped the server. These
orchestration issues were not product/test failures and are not hidden passes.
Initial catalog validation caught a plural-contract mismatch; corrected the
Persian ICU selectors before the successful catalog/focused checks. Owned lint
also prompted removal of unused scoped imports and a request cleanup refactor.

## Review and remaining qualification

See [Codex self-review](LOC-082-review-1.md). This is self-review, not independent
peer, human, native linguistic or accounting approval. Persian terminology is
provisional. LOC-067/008/002 retain independent combined acceptance.
Mounted browser/keyboard, complete RTL/numeral/calendar, output translation,
hosted CI, provider, deployment and production acceptance are not claimed.
No full build, dev server, Docker, external provider request, application DB,
deployment or dedicated Stripe work ran. Controller closure and scoped commit/
push happen after all required checks; remote synchronization is reported only
after it is verified.
