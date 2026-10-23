# LOC-116 attempt 1 - 2026-10-23

Implemented document email history catalogs in the production component and seven paired English/Persian messages. Relative time uses next-intl; recipient/subject remain escaped caller content. Sent/failed display labels and unknown-status fallback do not change stored statuses. Resend HTTP/network failures use a localized fallback; successful resend reloads the same document history.

Inspected REST document-emails list/resend and lib/mcp/tools/email.ts list_document_emails/resend_document_email. No API/MCP, schema, permission, exact-money or Stripe change. No database fixture or provider delivery is required for this presentation-only slice.

Verification:
- Focused production JSX/callback tests: 2 passed, both locales, relative time, escaped subjects, loading, status fallback, success/HTTP/network failures and exact URL/method/org header.
- message-catalogs.test.ts: 11 passed.
- pnpm i18n:check: 9437 paired keys passed; Persian-script assertions pass.
- pnpm typecheck: passed.
- Changed-file ESLint: passed after renaming a test harness variable rejected by Next lint.
- Full pnpm lint: passed after that correction, zero errors and 24 pre-existing warnings.
- Controller validation and git diff --check: passed before submission; rerun at completion.

Scope: LOC-071 split into LOC-116 history, LOC-117 dashboard/widgets, LOC-118 document workspace and LOC-119 send controls. Parent acceptance remains open. Native Persian terminology, RTL/browser workflows, provider delivery and LOC-009 authored email/PDF templates remain independently owned. No full build or dev server run.

Operator/reviewer: Codex. Base commit: 4cc2f9de. Acceptance mapping: criterion 1 is covered by component/catalog changes and scope registry; criterion 2 by the checks above; criterion 3 by task handoff and scope registry.
