# MON-126 actual self-review

2026-10-10, Asia/Tehran. Reviewer coding-assistant, kind self; no independent
peer/human/security/accounting review is claimed. Result: approve this bounded
signing contract slice with the limitations recorded in attempt 1 and registry.

Reviewed original and final public POST/SSR, signature request/list/resend routes,
MCP registrations, wire/service layers, actual fixtures and contract inventory.

- Verified required permissions, strict full MCP schemas, UUID/text/email/expiry
  inputs and no organization override. Public token derives its own organization;
  live organization/invoice rechecks and SQL-scoped contact projections prevent
  deleted capability use and foreign contact disclosure. During review moved
  contact organization filtering into SQL, then reran the complete signing
  fixture, typecheck and changed-service lint.
- Verified saved five-header money preflight and matching Minor strings without
  conversion/rescale, SQL-text JSON decimal preflight and opaque exact strings.
  Public summary uses frozen currency scales and bigint/string fractional
  formatting, with safe endpoints, IRR/KWD/USD and negative subunit assertions.
  Wider history fails visibly before signature change/delivery. Projected contact
  name avoids accidental decoding of unrelated money/opaque columns.
- Verified organization -> invoice -> signature ordering matches corrections;
  status/expiry recheck follows lock wait. Conditional pending update and row lock
  prevent competing submissions or repeat requests from replacing proof. Actual
  concurrent signing/correction and the pre-existing opposite correction/signing
  lock fixture support signed snapshot preservation. No fixture mutates the
  application DB or performs a real email call.
- Verified all signature statuses, expired timestamps, active newest request
  selection, missing SMTP, safe email escaping, malformed/unknown PNG/body/token
  inputs, strict empty/no-body resend compatibility and transaction rollback on
  injected SMTP failure. Review strengthened PNG magic/IHDR/dimensions/IEND
  envelope checks, without claiming a full image decoder/security screen.
- Verified outputs retain original signature envelopes, REST 201, existing status
  errors, additive emailSent/resentTo and stable list order. No guessed aliases
  appear on nonmonetary signature records. Previous successful fixtures plus
  364 unit tests, final typecheck, zero-error lint/money gates support acceptance.

No outstanding blocker in this bounded task. Provider side effects cannot be
rolled back after an accepted email; outbox/exactly-once delivery, signer identity,
legal validity, browser runtime, full-int64/production/IRR and combined parent
integration remain separate. The existing permissive invoice-status policy is
documented and retained; this change hardens existing signing rather than adding
a new approval/posting policy. General SSR/PDF rendering stays MON-127.
