# MON-005 self-review 1

2026-10-02, Asia/Tehran. Reviewer: Codex, the implementing assistant. Self-review
only; no independent peer, human accounting or production approval.

Approved within provider/history scope. Reviewed exact lexical JSON ingestion,
bounded exponent expansion, all three retained adapters, UTC source/date policy,
failure redaction, bigint cross/inverse arithmetic, rational six-place rounding,
one basis point coexistence ceiling, per-tenant extreme guard and write counters.
Schema snapshot comparison confirms only six nullable fields, no original object
change. Old provenance stays null; no migration or refresh assigns posted history.

Review improvements included canonical UTC timestamp checks, explicit derived
overflow/underflow reporting, synthetic quarantine lookup rejection, multi-base
public-feed reuse, concurrent worker serialization/manual protection and rejection
of older same-day observations. The final affected unit/integration cases pass.

Org-scoped historical keys include base/quote/as-of/effective dates; caches live
only inside an authorized request/batch. Public invocation-local feeds never
contain manual or business tenant rows. Frozen cached snapshots and fresh reads
after update are tested. Direct-then-inverse selection preserves prior preference;
invalid history fails closed. Manual role checks/validators stay in REST/MCP and
manual override clears misleading provider metadata and records audit.

Actual invoice journal posting proves complete saved line rows survive source
refresh and a real MCP override while later postings obtain new rates. This is
posting-service qualification, not a complete invoice HTTP/period-lock/report or
exact-money migration acceptance. The task introduces no new posting workflow.

Full results: 70 unit tests, 18 PostgreSQL 18.6 integration tests, typecheck and
lint pass (167 existing warnings). After the final arithmetic reporting edge,
11 affected unit tests and all five new integration workflows pass again; final
affected lint, migration drift, schema preservation and inventory checks pass.
Dedicated fixture server stopped; zero test DBs remain. No build/dev/Docker/live
provider/production operation or configured app-DB migration was run.

Limits: first-seen quotes and sub-threshold manipulation cannot be certified by
a change heuristic; provenance/manual review remain necessary. Frankfurter v1
is retained with null observation timestamp and no availability promise. Legacy
int32/six-place consumers remain bounded and IRR disabled. Full-range contracts,
exact amount posting, immutable historical base currency, cohort remediation,
provider eligibility and production migration/release gates remain later tasks.
