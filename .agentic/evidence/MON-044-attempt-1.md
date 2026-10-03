# MON-044 attempt 1 - exact recurring invoice contracts

## Identity

2026-10-03, Asia/Tehran. Operator/reviewer: coding-assistant. Entry HEAD
`e78cf528549b0fd3de7d3614cd61c2a8e40954d1`; clean working tree at entry.
The user requested the next task, followed by commit and push on full completion.
Controller selected/started MON-044 in the valid 95-task graph. Work is uncommitted
at evidence creation; no human, independent accounting or deployment approval.

Read root/nested instructions, START_HERE/controller/project/repository map,
backend role, MON-011/MON-039 evidence, ADR-006 and MONEY_MANIFEST. Inspected the
actual dedicated/generic recurring routes, MCP registration, schema, invoice
writes/lifecycle, numbering, period locks, audit, exact primitives, email sender,
background maintenance and migrated PostgreSQL fixture harness. Source requirements
are database-and-currency-migration and api-backward-compatibility in SOURCE.md.

## Implementation

- `lib/api/recurring-invoice-wire.ts`: described shared invoice template schemas,
  canonical dates/UUID references, decimal-major unitPrice/unitPriceExact and
  canonical unitPriceMinor aliases, quantity hundredths and discounts/taxes in
  basis points. Price-first stored rounding and bigint ratios/sums preserve
  signed positive-infinity ties. Every monetary product/component/sum is guarded
  for safe numeric coexistence. Stored DTOs add unitPriceMinor and contact
  creditLimitMinor; preview adds currencyCode/lineTotalMinor without changing its
  gross-before-discount/tax semantics. Invalid JSON objects return 400.
- `lib/api/recurring-invoice.ts`: scoped transactional CRUD/header edits, pause,
  deletion, saved-data/reference validation and preview. Organization/template
  locks serialize changes with generation. Old/new date bounds and currency scale
  changes are validated; changing across minor-unit scales requires a new template.
  No template FX storage exists; supplied invoice FX fields reject instead of
  being discarded. MCP exposes those fields for explicit rejection.
- `lib/api/recurring-invoice-generate.ts`: locks and rereads each active due
  template, validates saved data/refs/dates, and atomically commits the entire
  catch-up's invoice numbering, headers/lines, optional recognition journals/
  saved FX/snapshots and schedule. Concurrent/repeated runs do not duplicate
  occurrences. A second-occurrence failure rolls back the first occurrence too.
  Unavailable refs, locks or posting errors leave the whole schedule pending;
  resolves the prior partially committed/silently downgraded-draft path.
- `lib/api/invoice-lifecycle.ts`: extracted the existing recognition transaction
  body as sendInvoiceInTransaction for scheduler reuse; manual send authorization,
  audit and behavior remain intact. Saved historical FX uses existing exact
  invoice posting rather than the former float automation path.
- `lib/api/recurring-generate.ts`: routes invoice templates through the new
  processor. Bill/expense/journal processing ownership is retained. The ordinary
  maintenance and MCP org-wide run use that same processor.
- Dedicated/generic REST routes and `lib/mcp/tools/recurring-templates.ts` delegate
  invoice operations to shared services. Existing envelopes/numeric fields and
  defaults remain. Added invoice delete/preview tools (eight tools total) through
  the existing index registration. Fixed document/status/frequency filtering
  before MCP pagination. Every MCP input field describes its units/policy.
- External auto-send email follows committed posting and keeps existing best-
  effort delivery. Fixture without provider credentials records failed delivery
  while retaining sent status and preventing document generation on rerun.
- Added pure and actual handler/SDK operation fixtures, recurring invoice registry,
  public API/module/money documentation, manifest/test matrix and source inventory.

## Acceptance mapping

1. RECURRING_INVOICE_WIRE_CONTRACTS.md inventories five dedicated REST operations,
   five generic CRUD/list operations, generic pause/preview, eight MCP tools and
   the scheduler. Documents units/aliases/rounding, response envelopes, supported
   ranges, currency/FX policy, error and mutation behavior, atomicity and delivery
   limits. API/module docs and money README match implementation.
2. Migrated disposable PostgreSQL fixtures invoke actual authenticated REST routes
   and registered SDK tools. Cover legacy/exact/dual clients, USD/JPY/IRR/KWD prices,
   custom read-only role, two-tenant/API-key scoping despite conflicting org header,
   foreign contact/account/tax, type/deleted targets, list/preview/header edits,
   pause/delete/run, zero payment terms, automated recognition and saved exact FX.
3. Pure groups cover malformed/conflicting/unsafe aliases, int64/safe range, gross/
   tax/header sums, cancellation guards, signed rounding and schedule/header/FX
   policy. Operation snapshots prove no committed mutation for invalid inputs,
   unsafe saved prices, foreign/deleted saved references, locked periods, missing
   FX and injected template-line/invoice-line/journal-line/schedule failures.
   Concurrent catch-up generates three unique complete sent invoices only once;
   second-occurrence fault leaves no invoice/sequence/schedule/audit changes.
   Safe-max draft totals retain 9007199254740991 without precision loss.

## Verification

All commands ran in `D:/Projects/dubbl`. Disposable PostgreSQL 18.6 cluster
`D:/Temp/dubbl-mon044-pg-b1d9cbe817a242278c09fb70f04e8858`, loopback port 55454,
synthetic dubbl_ci role, launched hidden. Explicit TEST_DATABASE_URL selected
only that cluster; harness creates/migrates/drops randomly named test databases.
Configured app database and credentials were not read/migrated/reset. Email fixture
clears RESEND_API_KEY and uses no SMTP config, preventing provider network calls.

| Actual command/procedure | Observed result | Limits |
|---|---|---|
| Controller validate/status/context/start | Exit 0, 95 valid tasks, MON-044 selected | Workflow only |
| node --import tsx --test tests/recurring-invoice-wire.test.ts | Exit 0, 4/4 groups | Pure boundaries |
| node --import tsx --test --test-concurrency=1 tests/*.test.ts | Exit 0, 134/134, 31.28s | Full unit regression suite |
| Combined recurring-invoice/invoice-lifecycle/recurring-journal PostgreSQL integration workers | Exit 0, 3/3, 33.20s | Actual handler/auth/SDK fixtures; no browser/session/OAuth |
| Final recurring-invoice PostgreSQL integration after second-occurrence/foreign/deleted/malformed JSON cases | Exit 0, 1/1, 7.55s | Expanded complete operation fixture |
| npm run typecheck; final npx tsc --noEmit | Exit 0 | MDX/TypeScript; no build/dev |
| npm run lint | Exit 0, 0 errors / 159 existing warnings | Full repo; no new warnings |
| Final targeted eslint of adopted routes/services/tools/tests | Exit 0, clean | After final parser/filter hardening |
| Inventory --write, reproducibility and Drizzle/source verifier | Exit 0; 410 columns, 1383 paths, 1140 consumer hashes, 22181 occurrences | Conservative source inventory |
| Temporary database count and pg_ctl fast stop | Count 0; stop exit 0, server stopped | Cluster files retained outside repo |
| git fetch origin and HEAD...origin/master divergence | Exit 0; 0 ahead / 0 behind before commit | Authorized commit/push follows task closure |
| git diff --check | Exit 0 | Line-ending notices only |

The first targeted ESLint run found four unused variables/import warnings introduced
by the edits; removed them. Final changed-code lint is clean. All operation tests
passed; expected fault-injection errors are asserted 500/rollback results, not
passing unhandled failures. No full build, dev server, Docker, screenshots, schema
changes/migration generation, deployment, provider delivery or IRR flag change.

## Review and handoff

Actual self-review recorded in MON-044-review-1.md. No bounded-slice blocker.
Full-int64/domain cutover, other recurring bill/expense writers, coordination with
external period-lock/base/FX writers, unbounded historical catch-up performance,
durable email outbox/recovery, browser/session/OAuth and production accounting/
IRR qualification remain separate gates. Auto-send financial errors now retain
pending schedules; delivery remains best effort after committed posting. Audit
retains the existing best-effort helper policy. No template inventory dimensions,
new provider or exact-only output negotiation are introduced.

MON-019 retains combined acceptance. After controller closure, execute the user's
authorized commit/push, verify clean working tree and remote synchronization, and
stop after this task. Next task: MON-045, exact invoice bulk contracts.
