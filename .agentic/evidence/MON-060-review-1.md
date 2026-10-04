# MON-060 self-review 1

2026-10-04, Asia/Tehran. Reviewer: coding-assistant, the implementing assistant.
Self-review only; no independent peer/human/financial/security/production sign-off.

Approved within documented expense CRUD supported range. Inspected actual shared
schemas/services, REST/MCP adapters and registration, UI diff, fixture assertions,
contract/docs/manifest/matrix and inventory. All three criteria map to concrete
evidence. Actual schema has no contact/project column, so those inputs reject;
there is no fabricated support or out-of-scope schema migration.

REST decimal-major and MCP documented integer-minor inputs are explicit; the old
MCP accidental second conversion is corrected and prominently documented, without
retroactive stored-data repair. Bigint ratio rounding and sums preserve safe numeric
envelopes with additive aliases, including max exact major cents. SQL-text aggregates
guard individuals and status sums and reject mixed currencies. No scalar serializer
is relied on to reverse already committed mutations.

Org and claim locks serialize adopted atomic CRUD/audit effects. Strict schemas
prevent header/status/tenant/total mass assignment. Saved/current references,
receipt ownership, user memberships, expense account/purchase tax eligibility,
old/new dates and two-tier/fiscal locks validate before commit. Public profiles
omit secrets. Unsafe saved lines/mileage or mismatched totals reject before writes.
Read snapshots retain historical inactive owned references; writable history has
the stricter eligibility policy. Unsupported departed-member history is explicit.

Review added complete line audit snapshots, scoped receipt validation and precise
alias/invalid JSON handling. Real SQL fault injection proves header/line/audit
rollback; snapshots exclude only normal API-key last-use audits. Concurrent edit/
delete produces a serialized result without orphan items. Repeated create remains
another draft, not an invented idempotency promise. Replacement IDs carry metadata
and are regenerated; the editor sends IDs/accounts and exact major strings.

UI review found Number/fixed-scale preview and summary currency/error issues.
Exact bigint helpers now preserve fractional cents, explicit currency scales and
cross-status sums above safe numeric range. Unlike currencies display a label;
backend/count failures stay visible. Pure fixtures cover actual helper behavior.
Browser interaction was not run and no screenshot claim is made. Generic create
drawer mileage/display and broader locale/list/detail formatting remain separate.

Final evidence records 180/180 units, nine PostgreSQL regression workers plus the
final expense rerun, typecheck, full lint (0 errors/155 baseline warnings), clean
affected-path lint and inventory/legacy checks. Preliminary inference/fixture
enum and shell placeholder defects are repaired and final checks pass. Synthetic
databases are removed and server shutdown verified.

Limits are explicit: legacy lifecycle and bank/restore/merge/configuration writers
have not acquired adopted CRUD locks; MON-061/021 retain concurrency and exact
GL/tax/FX/settlement/reversal qualification. Historical MCP monetary remediation,
full-int64, PostgreSQL 16/clean install/production migration, receipt/session/OAuth/
provider/browser/performance and independent financial/security/locale/IRR/release
gates remain assigned. No slice blocker or deployment. Next MON-061; commit/push
are authorized by the user.
