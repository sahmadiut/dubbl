# Budget CRUD wire contracts

## MON-015 integration amendment (2026-10-10)

All five CRUD tools now use registerTool with complete strict input objects.
REST/MCP create/update bodies, lines and periods reject unknown fields before
mutation; routing budgetId is removed before shared update-body parsing.
Actual full-SDK tests reproduce and prevent organizationId stripping and verify
valid legacy/exact create/update/list/get/delete and nested no-write failures.
Authenticated-member master reads and manage:budgets writes retain their policy.
See [auxiliary/report integration](AUXILIARY_REPORT_INTEGRATION_CONTRACTS.md),
auxiliary-report-integration.test.ts and MON-015-attempt-1.md. The historical
MON-023 description below records the original slice; report integration is now
independently accepted in MON-029 and MON-015 with downstream gates retained.

Source-verified MON-023 slice, 2026-10-02, Asia/Tehran: collection and ID REST
routes plus MCP list/get/create/update/delete. The sixth registered budget tool,
`budget_vs_actual`, and its REST report remain MON-029. MON-015 retains final
auxiliary/report integration after MON-023..029; full domain/UI cutover remains
MON-008. No full-range reporting or posting is claimed.

## Amounts, periods and limits

Budget line `total` and period `amount` keep their existing signed integer cents
units. Additive `totalMinor` and `amountMinor` are canonical signed ASCII integer
strings in exactly the same units. No locale/currency/magnitude rescaling or new
currency snapshot: budgets lack a stored currency and inherit organization context.
Neither this contract nor existing cents data attests correct historical IRR units.

Either alias may be supplied; both must agree. Missing period amounts default to
zero. Missing line totals use the explicit-period sum, or zero for generated periods.
Explicit total retains the existing precedence over an explicit-period sum even
when they differ; this slice does not impose a new equality rule. Every period
amount, supplied total and final period sum must fit +/-9007199254740991 before
writes. Sum arithmetic uses bigint, including cancellation with intermediate sums
above Number precision. Valid signed-int64 strings outside supported Number
coexistence fail with `LEGACY_NUMERIC_RANGE`/422. Malformed/noncanonical/out-of-int64,
fractional/unsafe numeric and disagreeing aliases are validation errors (REST 400;
MCP schema validation or wrapped validation result). Null amount aliases are invalid.

Omitted/empty periods auto-generate from the effective header period type/dates.
Distribution uses exact floor division followed by first-period remainder units,
preserving existing signed behavior: 1/3 -> [1,0,0], -1/3 -> [0,0,-1]. Safe-max
and signed-safe-min totals conserve exactly. No floating monetary product occurs.
Generated calendar boundaries use UTC throughout; dates remain Gregorian date-only
values, English labels/order stay unchanged, and Tehran/New York DST does not
change their canonical days. Early years avoid Date constructor's 1900 offset.

Supported request bounds: at most 500 lines and 10000 periods across a budget.
Generated counts are checked before allocation; excessive generated/combined
periods return classified 422, excessive input array schema bounds return validation
errors. Sort order is signed int32. Header and explicit-period dates must be valid
Gregorian YYYY-MM-DD and start <= end. Explicit periods need not fit inside the
header range, preserving that existing policy. Date-range counts are nonmonetary
Numbers. Existing bad period types reject replacement before mutation.

Reads retain numeric totals/amounts and add string aliases; unsafe stored values
fail the transitional ORM/DTO guard without rounded recovery. Update and deletion
read existing monetary children before mutation, so unsafe history cannot be
silently erased even by line replacement. Header-only lists/create/update responses
contain no monetary field and preserve existing shape.

| Operation | Input/output | Scope and workflow |
|---|---|---|
| REST GET `/api/v1/budgets` | Existing pagination; `{data: budgetHeaderWithFiscalYear[], pagination}` | Authenticated org/not-deleted rows/count; rejects a foreign-org fiscal-year relation before serialization. No monetary totals in this envelope. |
| REST POST `/api/v1/budgets` | Name/fiscal/year/dates/type/active and 1-500 lines; 201 `{budget: header}` | `manage:budgets`; all aliases/dates/sums/distributions and org-owned not-deleted account/fiscal refs checked before writes. Header/lines/periods inserted in one transaction; create audit after commit. |
| REST GET `/api/v1/budgets/{id}` | ID; `{budget}` including fiscal/lines/accounts/periods and exact aliases | Org/not-deleted lookup; foreign/missing ID or foreign-org nested fiscal/account association returns 404; unsafe stored money returns 422. |
| REST PATCH `/api/v1/budgets/{id}` | Partial header, optional replacement lines; `{budget: header}` | Same role/preflight/ref guards; effective dates/type from saved header; transaction updates header, deletes old lines (periods cascade), inserts new children. Omitted lines preserve IDs; empty lines delete all. Header diff/line-count replacement audit after commit. |
| REST DELETE `/api/v1/budgets/{id}` | ID; `{success:true}` | Role, org/not-deleted lookup/update; guarded existing children, soft-delete header, retain lines/periods, audit. Foreign/deleted ID 404. |
| MCP `list_budgets` | Existing page/limit; `{budgets,total}` | Same org/not-deleted header/fiscal guard, direct DB; no monetary totals. |
| MCP `get_budget` | `budgetId`; `{budget}` with aliases/relations | Same shared scoped read/DTO as REST; classified 404/422 tool errors. |
| MCP `create_budget` | Same described create schema and aliases; `{budget: header}` | Same direct-DB preflight/transaction/audit service and AuthContext as REST; no HTTP self-call. |
| MCP `update_budget` | ID and same described partial schema/aliases; `{budget: header}` | Same effective-header, guarded replacement/transaction/audit semantics. |
| MCP `delete_budget` | ID; `{success:true}` | Same scoped soft-delete/history preservation/audit service. |

REST uses guarded JSON; MCP uses `wrapTool`. Reference validation occurs before
mutations, including all lines after the first, and mutations include organization
predicates. Trigger-injected failures after header/line writes roll back the entire
create/replacement transaction; audits are emitted only after successful writes
and retain existing best-effort delivery. Configuration changes do not post GL
entries, so no new period-lock/ledger-replay contract is invented. Concurrent
replacement/replay qualification remains later work.

## Remaining boundaries and qualification

Budget-vs-actual SQL/Number aggregates, variance/percent/burn-rate projections,
mixed currency/base-ledger policy and exact report aliases remain MON-029. This
CRUD support does not attest that those reports handle safe-max inputs losslessly.
Frontend Number-based amount distribution/display remains MON-008/LOC-003; only
the shared calendar boundary generator is made timezone-stable here. Backup/export/
opaque monetary envelopes remain MON-016. Historical currency snapshots, full int64
consumers and functional IRR qualification retain MON-008/010 gates. No schema,
migration file, production flag or client sunset is changed.

Five pure contract groups plus actual PostgreSQL 18.6 REST/API-key/member and
registered-MCP fixtures cover old/exact/dual/default signed clients, safe limits,
alias/sum/date/reference rejection with unchanged snapshots, tenant/role isolation,
malformed existing nested refs, exact period conservation, transaction rollback,
replacement/soft-delete behavior, audits and unsafe historical preservation.
HTTP/OAuth/session transport, browser clients, PostgreSQL 16, independent accounting
review and concurrent writes are not qualified by these fixtures.
