# MON-023 self-review 1

2026-10-02, Asia/Tehran. Reviewer: codex, the implementing assistant; self-review,
not independent peer/human/accounting or production approval.

Approved within the budget CRUD scope. Reviewed shared schemas/preflight/DTOs,
REST and MCP adoption, actual transactions/reference/read predicates, exact sum/
signed distribution, UTC generation, docs/task split/inventory and actual positive/
negative operation fixtures. Original parent criteria and report work are retained.
Only five CRUD tools are adopted; the registered report remains MON-029.

Existing numeric cents/header envelopes, omitted/zero/negative behavior and explicit
total precedence are retained. Aliases agree exactly and remain in stored units;
the bridge rejects unsupported strings before writes. Bigint sums tolerate safe
final cancellation without Number overflow, and floor/remainder distribution
conserves both safe edges. Generated work is bounded before allocation. DTOs reject
unsafe Numbers before BigInt conversion; no precision-recovery/rescaling claim.

Preflight checks every line and org-owned account/fiscal ref before atomic writes.
Injected failures prove header/line/period replacement rollback and unchanged audit
snapshots. Scoped reads reject malformed historical foreign-org nested associations.
Unsafe monetary history rejects replacement/deletion before erasure. Metadata-only
edits preserve child IDs; soft-delete retains amounts/periods. Direct DB/wrapTool/
AuthContext behavior is shared consistently between REST/MCP, without HTTP self-calls.

UTC calendar regression fixtures expose timezone-dependent old date generation and
prove stable Gregorian results in UTC, Tehran and New York, including DST and early
years. Frontend monetary distribution is deliberately unchanged and remains later
consumer work. Configuration writes do not post GL or invent new period-lock/replay
policies; audit keeps best-effort delivery, not an atomic-delivery guarantee.

Review caught the fixture `let` lint issue and added an explicit unsupported stored
period-type guard plus nested-ref read checks/fixtures. Final 96-unit suite, two
PostgreSQL operation workers, typecheck/full lint (167 existing warnings/0 errors),
affected-file lint, inventory and diff checks pass. Controller initially failed on
disk capacity; its unchanged 32-test suite passed using D: temp storage with the
usual Windows symlink privilege skip. No false test/human approval is asserted.

Limits: current safe-number business range, implicit budget currency, explicit-total
versus period-sum policy, pending budget report arithmetic/aliases, frontend amounts,
full int64 storage/domain consumers, transport/session/browser/PostgreSQL-16 and
concurrent/idempotent workflow qualification. No schema, migration, configured DB,
feature flag, client sunset, functional IRR enablement or deployment changed.
