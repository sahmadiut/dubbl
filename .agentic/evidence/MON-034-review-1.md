# MON-034 self-review 1

2026-10-10, Asia/Tehran. Reviewer codex, kind self. The same operator implemented
and reviewed this task; no peer/human accounting or security approval is claimed.

Reviewed new combined worker/runner, parent boundary registry, MONEY_MANIFEST
handoff, task acceptance and actual command results in MON-034-attempt-1.md.

- Parent acceptance uses its own dataset and real legacy/exact writers across
  three currency scales. It tests corrections, literal audit payloads, signing
  SSR/public POST and public/authenticated render together; child done statuses
  are not substituted for this evidence.
- Persisted JSON inventory is checked against actual declarations and links;
  nonfinancial hashes/permissions/URIs/counts retain explicit owners and do not
  acquire money aliases. Runtime source and generated money inventory stay intact.
- Signed correction and repeated submission rejection preserve all mutation
  tables and the previously corrected audit/render state. Decimal loss, unsafe
  integer and underflow cases reach all composing consumers with no write.
  Whole-string exact amounts, FX and leading-zero identifiers remain literal.
- Tenant/grant/authentication failures execute actual routes/registered SDK.
  Public bearer tokens retain limited capability authorization; authenticated
  MCP adds tenant/grant scope. A site-admin key cannot address a foreign tenant.
- Party-only reads intentionally survive unsupported unrelated headers. Financial
  signing/rendering guards those headers; the test documents the narrower
  projection instead of imposing a new snapshot-only monetary contract.
- Inspected the fixture's endpoint defaults: payment-link REST returns PDF while
  its MCP operation defaults HTML. The fixture compares HTML projections through
  matching consumers and validates binary PDF signatures separately. No binary
  PDF equality or extracted PDF visual/content proof is claimed.
- Current child reruns supply deterministic lock/race/rollback, global session
  forwarding, raw audit/admin numeric-token, all-document and SMTP capture coverage.
  The independent parent worker has no SMTP config; no real provider is contacted.

All final source/static/focused checks passed. No blocking issue found in this
bounded integration diff. Approve MON-034 self-review with the explicit limits:
safe numeric compatibility only, no full-int64 cutover, historical remediation,
production IRR enablement, native Persian/visual fit, browser identity proof,
independent accounting/security qualification or deployment.
