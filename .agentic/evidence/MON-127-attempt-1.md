# MON-127 attempt 1 - remaining document render bridges

## Identity

2026-10-10, Asia/Tehran. Operator coding-assistant; self-review only.
Entry master HEAD fd14a39a30aa535cb14c958481c15a0f2b6d2fb2, clean tree.
Controller selected/started exactly MON-127. This evidence precedes the authorized
scoped commit/push. No independent human/peer review is claimed.

Fresh synthetic trust-authenticated UTF-8 PostgreSQL 18 cluster on loopback
port 55427, max_locks_per_transaction=256. Explicit TEST_DATABASE_URL selected
that server; each harness creates/migrates/drops a random dubbl_ci_ database.
An initial attempt loaded the configured test .env server and received
permission denied to create database before any fixture/database creation. It
was replaced with the isolated cluster; the application database was not
modified. No secrets were printed/persisted. SMTP is captured by a fixture mock;
actual services, Next handlers, authentication, full MCP SDK and SQL execute.

## Implementation and acceptance mapping

1. [DOCUMENT_RENDER_WIRE_CONTRACTS](../registries/DOCUMENT_RENDER_WIRE_CONTRACTS.md)
   inventories all five document HTML/PDF routes, template/email previews,
   authenticated send/resend, payment/portal invoice downloads, dated portal
   statements, signing SSR, payroll files and remaining client/report/background
   ownership coordinated with MON-008. MONEY_MANIFEST and machine inventory are
   refreshed. No unsupported payroll PDF or full-int64 feature is advertised.
   Safe numeric document-currency minor amounts retain explicit *Minor strings
   in MCP data; binary PDF/base64/HTML contracts and existing resend/send input/
   response shapes are documented. Currency scales never rescale saved integers.
2. document-rendering-worker executes real legacy REST/exact MCP invoice writers,
   five document render pairs, preview pairs, public capabilities, statement
   exports, email send/resend and full registration. Tests assert numeric/Minor
   parity, maximal-safe USD/IRR/JPY/KWD text, actual PDF/base64 signature,
   escaped content, saved recipient/sender, custom roles, organization isolation,
   active capability scoping and unchanged domain/log/delivery rejection state.
   Separate existing signing SSR, payroll outputs, dated contact print/email,
   public portal and receivable integration suites pass as regressions.
3. Shared read-only repeatable-read document service validates live owned
   document/contact/org, supported currency, complete header/line amounts,
   quantities and SQL-text opaque snapshots. Exact whole/fraction text avoids
   Number decimal rounding and fixed /100 assumptions. Physical hundredths keep
   independent units. Portal statement reuses the existing exact dated contact
   calculation with mixed-currency filters. Public page gross sums use bigint
   and the summary rejects unsupported sums before successful output. Invalid
   schema/query/history/range/reference input produces classified failures.
   Rendering completes before standalone email provider/log writes and before
   REST invoice PDF send posts or creates a link. Requested attachments are no
   longer silently omitted on rendering failure. No monetary mutation/schema
   migration/history rewrite/IRR flag change was added.

## Verification

All commands ran in D:/Projects/dubbl.

| Command / procedure | Observed result | Limits |
|---|---|---|
| python .agentic/agent.py validate/status/next/context, start MON-127 | Valid 177-task graph; selected this bounded task | Controller validity is not financial qualification |
| node --import tsx --test tests/document-render-wire.test.ts | Exit 0, 4/4 | Signed/max-safe text, currency units, hidden fields, hundredths, exact sums, strict query controls |
| Explicit TEST_DATABASE_URL; node --import tsx --test --test-concurrency=1 tests/integration/document-rendering.test.ts tests/integration/public-portal-wire.test.ts tests/integration/invoice-signatures.test.ts tests/integration/payroll-outputs.test.ts tests/integration/contact-statement.test.ts tests/integration/receivable-document-integration.test.ts | Exit 0, 6/6 | Disposable migrated PostgreSQL; SMTP fixture only |
| Final node --import tsx --test --test-concurrency=1 tests/integration/document-rendering.test.ts tests/integration/public-portal-wire.test.ts | Exit 0, 2/2 | After final HTML preservation, gross-range preflight and malformed-JSON assertions |
| pnpm test | Exit 0, 368/368 | Pure/unit regression suite |
| pnpm typecheck | Exit 0 | MDX generation plus tsc, no full build |
| pnpm lint | Exit 0; 0 errors, 105 existing warnings | Existing portal quote hook warning retained |
| Node ESLint API lintFiles over Git changed tracked/untracked TS/TSX | Exit 0; 30 files, 0 errors, 1 existing warning | Final changed source and fixtures |
| python .agentic/scripts/money_inventory.py --write; node --import tsx .agentic/scripts/verify_money_inventory.mjs | Exit 0; 415 columns, 1,925 scanned files, 1,425 consumer hashes, 27,167 occurrences | Static inventory, not complete consumer cutover |
| node --import tsx .agentic/scripts/verify_legacy_money.mjs | Exit 0; 9 regression checks | Existing guard policy |
| git diff --check | Exit 0 | LF/CRLF notices only |

Initial full SDK fixture exposed a duplicate existing resend tool registration.
Removed the duplicate and updated the existing tool in place, preserving
emailLogId input and success/emailLogId/status output. Final fixture uses full
registration and passes. Initial PowerShell argument quoting/list flattening
errors were corrected; final tests/lint above actually executed successfully.

No full build, dev server, Docker, production/application DB migration, browser,
real SMTP/provider, screenshot or deployment was run. DEC-005 render/data
assertions apply. Actual PDF output exists in fixture memory; no visual print-fit,
Persian fonts/layout or security/accounting release qualification is inferred.

## Review and handoff

Actual self-review: MON-127-review-1.md. MON-127 has no remaining blocker.
MON-034 must independently qualify all four children together; MON-008 retains
broad auxiliary/public/background and full-int64 cutover. Existing lifecycle
provider-after-commit, failed-email-log and delivery concurrency limitations
remain explicit. Next action: controller completion, scoped commit/push and
remote/clean-tree verification; stop after this task.
