# MON-049 self-review 1

2026-10-03, Asia/Tehran. Reviewer: coding-assistant, the implementing assistant.
Self-review, without independent peer/human/accounting/security/deployment approval.

Approved within the purchase-order contract slice. Reviewed actual shared schemas/
services, thin routes, complete registered MCP operations, bill reservation bridge,
contract/docs/source inventory and meaningful negative/database fixture evidence
against all three criteria. No schema change or additional task split.

Numeric prices remain decimal major units in both transports. Exact aliases agree
before calculation, integer ratios preserve extended signed rounding and discount/
tax units, and safe guards prevent unsupported prices/products/sums/history from
committing. Headers/lines add named minor strings; counts use exact SQL-text sums
and min/max to reject unsafe offsetting history and mixed currencies. Existing
PATCH no-tax/discount line replacement is explicitly retained and documented.

All operations are tenant-scoped, roles remain manage:bills except approve:bills
for send, and references/dates/history are validated. Organization/header/line/
reference locks protect numbering and state, with transactional audit and response
preflight. Read-only transactions avoid mutation/reference locks. Full MCP registry
fixtures show each operation registered exactly once with described schemas.

Review identified procurement coordination requirements: unit-price recomputation
must not discard saved discounts/subminor amounts, earlier partial void must not
duplicate rounding residuals, GRN slices must not be reused, and bill recognition
must not increment conversion reservations again. Exact active audit allocation
metadata and receipt capacities now govern new conversions. Recognition retains
reserved tallies; posted/unposted void releases them. Converted draft CRUD refuses
amendments; void/reconvert is the tested safe path. Unknown legacy partially billed
history rejects rather than guessing; no prior posted history is rewritten.

Reverse-charge partial/sliced tax can conflict with recognition's rate rounding.
The final guard rejects such allocations before conversion, with actual REST/MCP
and snapshot coverage. Normal residual/discount conversion and reverse-charge due
are verified. Foreign GRN identity and foreign receipt bill-reference guards apply.
Receipt FX, stock whole-unit/FIFO policies remain their prior qualification limits.

Email schema/JSON errors now reject before sent status. Rendering is precommit,
delivery postcommit; failure is reported as 502 with committed sent state and a
failed log, retaining attachPdf=false. Synthetic tests blank all provider credentials,
verify actual delivery-failure behavior without network email and prove failed
audit produces no delivery. Live delivery remains unqualified.

Final checks: 153/153 units, all four migrated PostgreSQL workers, typecheck, full
lint with 0 errors/159 existing warnings, clean affected-path lint, inventory/
Drizzle/hash/legacy/diff checks. Fixture setup and one mistaken MCP error-status
assertion were corrected; final fixtures pass. Test databases are removed and
the synthetic server is stopped. Repository branch was synchronized before commit.

MON-020 retains combined procurement acceptance; MON-050 is expected next. Other
bulk/receipt/settings writers and configuration races, legacy remediation, full
int64, browser/session/OAuth/live providers, production migration and independent
financial/security/native-language/release/IRR gates are not inferred. No
deployment/build/dev or production enablement. Commit/push is user-authorized.
