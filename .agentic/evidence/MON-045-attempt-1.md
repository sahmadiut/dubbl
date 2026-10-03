# MON-045 attempt 1 - exact bulk invoice contracts

## Identity

2026-10-03, Asia/Tehran. Operator: coding-assistant. Entry HEAD
`a5601dca1196dbcfbba2dc7a6cdeec942df66f17`, master, clean tree at entry.
User requested the next task and commit/push on full completion. Controller
validate/status/context selected MON-045 in the valid 95-task graph; started via
controller. This evidence describes uncommitted work and honest self-review;
no independent/human accounting/security or deployment approval is implied.

Read root/nested instructions, START_HERE, controller/project/repository map,
backend role, MON-011/MON-039/MON-040 dependency reviews, ADR-006 and manifest.
Inspected actual five route files, legacy MCP bulk/import registration, invoice
write/lifecycle/shared numbering/reference/tax/lock/limit/audit services, import
preprocessing/CSV wizard, schemas, SMTP and migrated PostgreSQL fixture harness.
Source requirements: database-and-currency-migration and api-backward-compatibility
headings in SOURCE.md. Existing runtime money units, not plan hypotheses, determine
the contracts. No upstream implementation code was copied.

## Implementation

- `invoice-bulk-wire.ts`: described nested/flat schemas, explicit decimal-major
  numeric/exact prices and canonical minor aliases; USD omission default, explicit
  currency scales and strict unknown-field/date/UUID/range policy. Import reuses
  bigint invoice extended-price/discount/tax/sum arithmetic. Flat CSV grouping
  verifies headers and separates explicit-number keys from fallback-header keys.
  Exact reminder formatting uses minor-to-major strings and bigint Intl parts.
- `invoice-bulk.ts`: shared direct-DB services for preview/import/send/mark-paid/
  reminders. All import monetary aliases/products/sums preflight before jobs;
  scoped tax-inclusive totals and invalid saved rates preflight too. Business
  reference/period/plan failures remain per-document job errors. Rechecks scoped
  references/locks/limits and atomically commits organization-serialized numbering,
  draft header and every line. Preview checks references/totals without writes.
- Bulk send replaces the old status-only path and self-route calls with MON-040's
  recognition transaction, including saved FX/snapshots/stock. Whole selected
  draft batch commits together; any failure rolls back earlier documents too.
  Missing/foreign/deleted/non-draft IDs remain ignored/skipped. Repeated and
  concurrent send updates once. No email is requested by bulk recognition.
- Bulk mark-paid retains its explicitly documented compatibility annotation for
  externally settled documents, without creating a payment/allocation/settlement
  journal. Only sent/partial/overdue targets qualify. Guards saved money/refs,
  header/line/balance agreement and issue-date locks; all updates share a transaction.
  Audit records annotationOnly; MON-021 handoff explicitly retains settlement,
  reversal, carrying-FX, bank and report coordination rather than claiming it done.
- Reminder preflight covers the entire selection before delivery or dunning/log
  mutation. Exact currency display preserves safe-max fractional minor units.
  Best-effort delivery remains per-item, with successful log/dunning sharing a
  post-delivery DB transaction. No durable delivery/retry guarantee is invented.
- Thin REST adapters use authenticated contexts, shared JSON/error handling and
  malformed-body 400. Five described SDK tools live in registered invoice-bulk.ts;
  existing invoice tools moved out of bulk.ts, unrelated bank/contact tools retained.
  Full registration is exercised, ensuring no duplicate names.
- Invoice CSV mapping now exposes grouping/currency/line/price/account fields.
  The shared wizard displays failed HTTP requests as errors instead of a false
  zero-row success. The existing simple CSV parser is retained and explicitly
  bounded; broad quoted/multiline parser qualification stays DATA-001.
- Added boundary registry, public API/import guide, money README, manifest,
  test matrix, MON-021 coordination handoff and refreshed source inventory.

## Acceptance mapping

1. INVOICE_BULK_WIRE_CONTRACTS.md records every adopted REST/MCP operation,
   formats/units/aliases/defaults/ranges, outputs, permissions, errors, atomicity,
   partial jobs, retry/idempotency and settlement/provider limitations. Public docs
   match the actual implementation. No nonexistent bulk edit/delete is claimed.
2. Actual authenticated REST handler and registered MCP SDK fixtures on migrated
   disposable PostgreSQL cover legacy/exact/dual prices, USD/JPY/IRR/KWD, extended
   signed rounding, grouping/date preprocessing, custom read-only role/API keys,
   two tenants despite conflicting org header, foreign/deleted contacts/accounts/
   taxes/documents, all five tools, adjacent integration and full registration.
3. Pure/operation fixtures reject malformed/conflicting/int64/unsafe prices,
   gross/tax/header sums, bad dates/currencies/FX/shape/quantities before jobs.
   Snapshots verify no committed writes/audits for invalid actions, unsafe saved
   header/line history, corrupt tenant references, locks, missing FX and injected
   journal faults. Import-line faults roll back headers and sequence numbers while
   retaining accurate job errors; mixed business outcomes independently commit.
   Actual batch failure after a qualified send leaves all drafts unchanged.
   Concurrent/repeated send posts once with balanced saved exact-FX journals.
   Mark-paid balances/retries/locks preserve explicit annotation semantics and
   create zero payment/allocation records. Reminder skips and local SMTP failure
   are tested without provider traffic. Safe-max preview total and reminder output
   preserve 9007199254740991 and the .91 fractional display, respectively.

## Verification

All commands ran in `D:/Projects/dubbl`. Synthetic PostgreSQL 18.6 cluster
`D:/Temp/dubbl-mon045-pg-c5a1d197868f4e1b91c32c7bd267c84d`, loopback port 55455,
synthetic dubbl_ci role; launched hidden. Explicit TEST_DATABASE_URL selected
only that server. Fixture harness creates/migrates/drops randomly named databases;
configured app database/credentials were not read or changed. Provider credentials
are blanked in workers; SMTP failure uses a blank encryption key and fails locally
before transporter/network construction. No real email was sent.

| Actual command/procedure | Observed result | Limit |
|---|---|---|
| Controller validate/status/context/start | Exit 0, 95 valid tasks, MON-045 selected | Workflow only |
| node --import tsx --test tests/invoice-bulk-wire.test.ts | Exit 0, 4/4 groups; final rerun 1.21s | Pure boundaries, including grouping-key collision repair |
| node --import tsx --test --test-concurrency=1 tests/*.test.ts | Exit 0, 138/138, 41.49s | Full unit regression |
| Bulk/invoice-lifecycle/invoice-writes/recurring-invoices integration workers | Exit 0, 4/4, 72.15s | Actual handlers/auth/SDK on migrated PostgreSQL |
| Final expanded bulk worker after review/key repair | Exit 0, 1/1, 23.21s | Full bulk operation fixture, not browser/HTTP session/OAuth |
| npm run typecheck; final targeted eslint plus npx tsc --noEmit | Exit 0; changed-code lint clean | MDX/TypeScript, no build/dev |
| npm run lint | Exit 0, 0 errors / 159 existing warnings | Full repo |
| Inventory --write/reproducibility/Drizzle source verification | Exit 0; 410 columns, 1389 paths, 1146 hashes, 22309 occurrences | Conservative inventory, not transitive dataflow proof |
| Temporary fixture database count / pg_ctl fast stop | 0 databases; exit 0, server stopped | Synthetic cluster files retained outside repo |
| git fetch origin; divergence HEAD...origin/master | Exit 0; 0 ahead / 0 behind before commit | Authorized commit/push follows controller closure |
| git diff --check | Exit 0 | No whitespace defects; line-ending conversion notices only |

Initial fixture runs failed because an invalid token lacking dk_ entered the
session-auth path outside a Next request scope, fixture schema names were wrong,
and canonical FX strings were expected padded instead of normalized. Corrected
fixture assumptions, used the actual API-key rejection path and reran successfully.
Typecheck exposed the schema-name mistakes. First targeted lint reported unused
invoiceLine; the final unsafe-saved-line assertion uses it and changed-code lint
is clean. Self-review also repaired explicit-number/fallback grouping-key collision
and a PowerShell Unicode range spelling in documentation. No remaining failing
check is hidden. Expected fault-injection errors are asserted rollback responses.

No full build, dev server, Docker, screenshots, schema change/migration generation,
configured DB reset/migration, deployment, successful provider delivery or IRR
enablement. Existing financial/provider/human gates remain intact.

## Review and handoff

Self-review is recorded in MON-045-review-1.md. No blocker for this bounded slice.
MON-019 retains combined receivable acceptance; MON-021 retains real settlement
and the annotation's interaction with ledger/payment/reversal/bank/report writers.
Full-int64/domain/report and financial/IRR migration qualification, external writer/
lock/configuration races, broad CSV formats, durable jobs/outbox/email delivery,
browser/session/OAuth and Linux/PostgreSQL 16 qualification remain separate gates.
No request idempotency key, durable resume or successful SMTP claim is made.

After controller closure, perform the user's authorized commit/push, verify clean
tree and remote synchronization, and stop after one task. Controller next: MON-020.
