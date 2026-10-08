# MON-019 attempt 1 - combined receivable document contracts

## Identity

2026-10-08, Asia/Tehran. Operator: codex. Entry HEAD
40b77054b0aea2079afe811412b830f2ac7d945c, master, clean working tree.
User requested complete and push next task. Controller selected MON-019, an
integration parent; all eight children were done. Started through the controller.
Read root/nested instructions, controller/project/repository map, backend role,
task/dependency evidence, ADR-006, child boundary registries and actual services,
routes, SDK registrations, schemas and fixtures. Requirements remain SOURCE.md's
database-and-currency-migration and api-backward-compatibility sections.

## Implementation and acceptance mapping

1. RECEIVABLE_DOCUMENT_INTEGRATION.md consolidates the eight complete boundary
   inventories with actual REST/MCP units, defaults, ranges, alias/envelope policies,
   errors, permissions, FX and atomicity. MONEY_MANIFEST and TEST_MATRIX point to
   independent combined acceptance. Child evidence remains immutable.
2. Added receivable-document-integration.test.ts/worker with actual authenticated
   REST/API-key handlers, full MCP SDK registration and background generation on
   committed migrations. REST legacy quote price and partial conversion cross into
   MCP acceptance/remaining conversion/posting; REST note creation/application
   crosses MCP recognition/reversal. Customer cash/deposit settlement uses that
   recognized invoice. Receipt legacy creation crosses cash posting/reversal;
   recurring generation feeds bulk posting and both read/summary boundaries.
   Custom roles and two organizations are exercised with conflicting org headers.
   All eight child suites retain detailed every-operation, period-lock, FX/stock,
   approval, concurrency, corruption and injected rollback coverage.
3. Found raw-shape MCP registration silently accepted unknown fields. All 59
   adopted receivable tool schemas now register as full z.strictObject instances,
   including empty-input, recurring run/summary and bulk tools. SDK fixture tests
   every adopted name's unknown-control rejection and additionalProperties:false
   with complete unchanged data snapshots. Corrected two old fixtures that sent
   undeclared fields to authorization/preview calls, retaining their assertions.
   Conflicting/invalid/out-of-safe-range aliases, foreign references/IDs, denied
   roles, unsafe raw history and unsafe imports reject before committed changes.
   USD/IRR/JPY/KWD minor integers stay identical, safe maximum serializes, every
   posted journal balances, and independent final AR/cash/deposit/revenue net
   assertions are 1875/625/0/-2500 minor units. No money arithmetic or units changed.

## Verification

Commands ran at D:/Projects/dubbl. A new synthetic PostgreSQL 18.6 cluster listened
only at 127.0.0.1:55519, UTC. TEST_DATABASE_URL explicitly targeted this server with
a synthetic fixture role. Harness created/migrated/dropped random dubbl_ci_ databases.
Configured application DB and credentials were not accessed. Workers blanked
provider/encryption keys and used synthetic contacts without email delivery.

| Actual command/procedure | Observed result | Scope/limit |
|---|---|---|
| Controller validate/status/context/start | Exit 0, 173 tasks, MON-019 selected | Workflow only |
| node --import tsx --test --test-concurrency=1 tests/integration/invoice-reads.test.ts tests/integration/invoice-writes.test.ts tests/integration/invoice-lifecycle.test.ts tests/integration/quotes.test.ts tests/integration/credits.test.ts tests/integration/sales-receipts.test.ts tests/integration/recurring-invoices.test.ts tests/integration/invoice-bulk.test.ts | Six passed initially; credit/bulk failed due to undeclared fixture fields, repaired and rerun below | Real handlers/auth/SDK; no skipped failures |
| node --import tsx --test --test-concurrency=1 tests/integration/receivable-document-integration.test.ts tests/integration/credits.test.ts tests/integration/invoice-bulk.test.ts | Exit 0, 3/3 | Parent with initial 57 strict tools plus repaired child fixtures |
| node --import tsx --test --test-concurrency=1 tests/integration/receivable-document-integration.test.ts tests/integration/recurring-invoices.test.ts tests/integration/recurring-payables.test.ts | Both recurring suites passed; parent failed its completed-template repeat expectation | Final shared recurring schemas include run/summary |
| node --import tsx --test tests/integration/receivable-document-integration.test.ts | Final exit 0, 1/1, no skips, 22.93s | All 59 strict tools, corrected completed-template rejection; nine receivable suites plus adjacent payable have passing results |
| pnpm test | Exit 0, 359/359, no skips | Full unit suite |
| pnpm typecheck | Exit 0 on final registration schemas | MDX + TypeScript, no build |
| pnpm exec eslint (all eight changed tool files and four changed/new fixture files) | Exit 0, clean | Final registrations and fixture corrections |
| pnpm exec eslint tests/integration/receivable-document-integration-worker.ts; pnpm exec tsc --noEmit | Final exit 0, both clean | After final completed-template assertion correction |
| pnpm lint | Exit 0, 0 errors/106 existing warnings | Full repository |
| python .agentic/scripts/money_inventory.py --write | Exit 0, 415 columns, 1873 scanned files, 1402 consumer hashes, 26618 occurrences | Lexical inventory only |
| node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0 | Drizzle columns, hashes and occurrence/source lines |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0, 9 checks | Legacy helper regression gate |
| git fetch origin; git rev-list --left-right --count HEAD...origin/master | Exit 0, 0/0 before task commit | Authorized commit/push follows closure |
| Controller validate; git diff --check | Exit 0 | Structure and whitespace |
| Temporary fixture database count; pg_ctl fast stop | Count 0; exit 0, server stopped | Only synthetic cluster; files retained outside Git |

Initial parent failure reproduced the unknown-field gap. Subsequent failures were
fixture assumptions: quote conversion returns 200, journal columns are debit_amount/
credit_amount, deposit control code is 2410, and completed recurring templates reject
explicit MCP runs (native generator returns zero). Corrected these from actual
source, preserving financial assertions. No failed check is claimed as passed.
Review also caught and restored unrelated MON-057 references after a documentation
count replacement. Final diff contains only task-owned changes.

No full build/dev server, Docker, schema changes, configured DB migration/reset,
deployment, real provider traffic or IRR rollout. Local PostgreSQL 18 results do
not establish Linux/PostgreSQL 16 or clean-install qualification.

## Review and handoff

Honest self-review recorded in MON-019-review-1.md. No bounded blocker. Full-int64/
domain cutover, MON-021 settlement/annotation integration, inventory qualification,
external-writer/configuration races, durable delivery, CSV breadth, browser/session/
OAuth, PDF/locale/high-volume and independent accounting/migration/IRR/production
qualification remain separate. Existing bulk mark-paid stays a compatibility status
annotation without cash/payment/settlement journals. Controller completion does not
enable application flags. Commit/push the authorized task, verify remote SHA/clean
tree and stop; next MON-020.
