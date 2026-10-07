# MON-112 self-review 1

2026-10-08, Asia/Tehran. Reviewer: codex. Kind: self; same implementer,
not independent peer/human/accounting review. Result: approve bounded MON-112.

Inspected root/controller instructions, MON-112 criteria, MON-011 wire evidence,
ADR-006, source routes/services/MCP registration, final diff and fixture results.
The contract registry covers all five boundary pairs, legacy units, canonical
aliases, safe ranges, error/preflight policy and existing transport envelopes.

Findings and disposition:

- Duplicated general/print/email calculations used current amountDue in opening
  balances and then deducted historical cash again. Shared original totals less
  dated cash correct this; the actual fixture sets current amountDue to zero and
  proves opening/closing balances and JSON/print/email parity without data writes.
- All report paths use scoped, undeleted contact ownership and view:data; email
  also checks manage:contacts. Source docs/payments and carrier lookup scope to
  the authenticated org. Explicit read-only repeatable-read snapshots cover all
  financial reads. Activity now returns 404 for foreign/deleted contacts.
- Bigint intermediates, safe emitted fields and currency guard run before JSON,
  render and SMTP. Actual signed edges, cancellation, stored int64/result overflow,
  mixed currencies, strict negative inputs and unchanged snapshots pass. Added
  explicit MCP email tenant/permission/unsafe preflight assertions; final focused
  fixture and worker lint pass. Transport is recorded, never sent externally.
- Numeric compatibility and supplier {statement} envelope/signs remain. Index
  registers all five tools exactly once; obsolete builder and purchasing tool
  registration removed. Print remains HTML rather than promising binary PDF.
- Exact currency formatting and escaped organization/contact/reference/description
  strings preserve USD/IRR/JPY/KWD units and protect rendered HTML. UTC period and
  generation dates are deterministic except for today's displayed date.
- Corrected comment encoding/scope during review. The removed-file inventory
  enumeration issue is resolved by scoped staging and final regeneration/hash
  verification. No unrelated source changes or schema/migration edits.

Validation: final focused fixture 4/4, scoped contact/aging regression run 6/6,
unit suite 333/333, typecheck, changed-file lint, full lint (0 errors/120 warnings
outside changed files), inventory/source hashes, legacy money gate and diff checks
passed. Limits: no full build/dev server, production provider/delivery, independent
accounting review, high-volume or full-int64 support qualification. Activity keeps
legacy timestamp-tie pagination behavior. SMTP retries may resend; outcome on a
provider failure may be uncertain. Public portal and parent MON-102 integration
remain separately owned; none is implicitly completed by this approval.
