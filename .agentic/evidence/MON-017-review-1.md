# MON-017 self-review 1

2026-10-02, Asia/Tehran. Reviewer: codex, the implementing assistant; self-review,
not independent peer/human/accounting or deployment approval.

Approved for the contact slice. Reviewed helper/schema/DTOs, three REST routes,
all six MCP operations, SQL aggregate units, direct DB/auth/audits, source/task
split, docs/inventory and positive/negative operation fixtures. Original parent
criteria are retained. Safe numeric aliases/envelopes and stored values remain;
string aliases neither enable full-range consumers nor rescale old cents.

Canonical syntax and alias agreement are guarded before any amount conversion.
Valid unsupported int64 strings return classified 422 before contact/audit writes;
null/omission/zero are distinct. Read DTOs check safe integers before BigInt, and
aggregate values come from PostgreSQL text and bigint sums. Unlike currencies and
safe-range overflow fail visibly. Existing unsafe history is preserved and rejected
before mutation. No schema/flags/posted amount changes or hidden negotiation.

Review identified merge children/tags with absent explicit parent organization
predicates and the MCP/REST contact-person mismatch. Both transports now scope
bank transactions, batch items and tags through their owning parent and move
people transactionally. Added actual cross-org-child fixtures prove foreign rows
unchanged, scoped amounts preserved, target limit preserved and tag deduplication.
One intermediate fixture assumed a duplicate tag row survived; corrected the
assertion while retaining deduplication, then reran successfully. Trailing whitespace
was removed. MCP currency creation uses the shared normalized ISO schema and a
negative invalid-currency fixture confirms no writes.

Final contact PostgreSQL worker, final typecheck and changed-file lint pass.
Full unit suite passes 91/91; full lint has the established 167 warnings/0 errors;
last small ISO normalization additionally has final fixture/typecheck/lint coverage.
Controller suite passes with its single documented Windows symlink skip. Inventory
and diff checks pass. Actual verification and intermediate failures are recorded
in attempt evidence; no checks or human approval are fabricated.

Limits remain explicit: full int64 business/ORM cutover, grouped-currency reporting,
contact statements/bulk/export/enclosing nested envelopes, all nested relation
authorization, concurrent merge/idempotency and complete financial/client/browser/
OAuth/session/PostgreSQL-16 qualification remain assigned tasks. Audit uses the
existing best-effort delivery helper. No numeric sunset date or IRR enablement is
invented; no configured database or production target was migrated/deployed.
