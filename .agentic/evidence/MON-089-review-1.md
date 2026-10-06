# MON-089 review 1

2026-10-06, Asia/Tehran. coding-assistant, implementing assistant reviewing its own
uncommitted changes; self-review, no independent peer/human/accountant approval.

Inspected shared wire/service, both REST route files, MCP registration/replacement,
master holding-account guard, exact dashboard input/sum, fixtures, inventory and
ASSET_CWIP_WIRE_CONTRACTS against all three acceptance criteria.

The unified direct-DB path closes actual missing MCP cost parity and divergent
capitalization behavior. Positive numeric cents/Minor agreement and safe bridges
are explicit; bigint sums retain opening basis and reject aggregate/root overflow.
Recorded cost remains unchanged during capitalization. Distinct scoped accounts,
identity-rate lines, construction journal linkage and transactional audit/output
preflight support the tested ledger results. No historical repricing/rescaling.

Review tightened nonzero CWIP master account protection even before cost history,
missing cost-journal rejection, year-zero input rejection and capitalization
saved-account preflight. Fixtures cover maximum safe GL, malformed/saved money,
missing/foreign/corrupt journals, category and account scope, tenant/custom roles,
API-key identity, date/period tiers and closed years. Concurrent cross-transport
cost/capitalization fixtures, once-only replay and whole-table audit/output/GL/
default-account rollback assertions all pass. Final 6/6 scoped groups, typecheck,
changed-file ESLint, inventory and legacy gate pass; full lint reports the same
129 existing warnings and zero errors.

Opening basis funding is explicitly assumed already booked to the saved CWIP
account. There is no currency-tagged asset snapshot or reconstruction of implicit
opening/history balances. Legacy inconsistent missing-journal/holding balances
need separate remediation; full-int64/performance, table-lock scaling, browser/
OAuth and independent accounting qualification remain parent/release concerns.
Fixed-cents compatibility and safe inputs do not enable IRR. No schema/migration,
app database reset, build/dev server, provider call or deployment occurred.

Approve MON-089 as the bounded self-reviewed slice. Finish controller closure and
authorized commit/push, verify remote SHA/clean tree, then stop; MON-090 is next.
