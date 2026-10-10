# MON-127 self-review 1

2026-10-10, Asia/Tehran. Reviewer coding-assistant; actual self-review, not peer
or human. Reviewed source diff, document contract map, fixture assertions and
recorded passing checks. Approve this bounded bridge task.

Findings addressed: fixed two-decimal PDF and portal formatting lost non-two-
decimal currency units and maximal-safe digits; HTML/PDF now uses the existing
exact statement formatter. Authenticated and public render routes now share
reference/scope/soft-delete guards. Saved parties read raw SQL JSON text before
numeric-token decoding and validate known text fields. Original invoice HTML
generator remains for route compatibility. Derived public payment gross sums
fail before successful output if unsupported. Requested email attachments no
longer silently disappear; standalone send/resend preflights before delivery/log
mutation, and REST invoice PDF send preflights before posting/link creation.
Existing resend/send MCP names, emailLogId input and response shapes retained;
full registration caught and resolved the duplicate tool. Strict schemas keep
unknown fields from being discarded before validation. No DB schema was changed.

Evidence: 4 focused wire tests, 368 unit tests, six real REST/MCP integration
suites and final rendering/public-portal rerun; typecheck, full/changed-file lint,
money inventory/legacy gates and diff check passed. Fixtures cover exact and
legacy writers, safe-limit currencies, frozen text, raw numeric snapshot
corruption, malformed JSON/query/schema, missing/foreign/deleted references,
permission/capability failures, mixed statements, sends/resends and unchanged
domain/log/delivery rejection state. SMTP is mocked; no actual provider claim.

Boundaries: numeric compatibility is safe-integer only; full-int64 consumers,
broader MON-008 client/background cutover, independent MON-034 integration,
visual PDF/print/Persian fit, real SMTP, delivery races/outbox/idempotency,
browser/session and accounting/production IRR qualification remain separate.
Payroll PDF-named endpoint remains its existing JSON data/note contract; no
binary payroll PDF completion is claimed. Domain invoice send still delivers
after committed lifecycle, consistent with MON-019. These are documented scope
limits, not unrecorded completion claims.
