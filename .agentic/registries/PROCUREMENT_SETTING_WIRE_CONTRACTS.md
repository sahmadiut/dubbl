# Procurement setting contracts (MON-054)

2026-10-04, Asia/Tehran. MON-020 child; combined payable/procurement acceptance
remains with its parent. No monetary storage, currency scaling or rollout change.

## Boundary inventory

| REST | MCP operation | Input | Successful output |
|---|---|---|---|
| GET /api/v1/procurement-settings | get_procurement_settings | No controls | 200 {procurementSettings} |
| PATCH /api/v1/procurement-settings | update_procurement_settings | Partial controls object | 200 {procurementSettings} |
| PUT /api/v1/procurement-settings | Same update operation | Partial controls object, retained for existing UI/clients | 200 {procurementSettings} |

Actual source previously exposed GET/PUT, despite the task's GET/PATCH wording.
PATCH is additive; PUT retains its existing partial-upsert behavior. Both
transports use procurement-settings.ts and procurement-settings-wire.ts. MCP
uses direct Drizzle, captured AuthContext, wrapTool and a dedicated registration
in tools/index.ts; the old purchasing registrations are removed without changing
tool names or duplicating them. Shared JSON serialization protects REST outputs.

## Units, aliases and supported ranges

| Control | Type/range | Meaning/default |
|---|---|---|
| priceTolerancePercent | Integer JSON number, 0..100000 inclusive | Basis points; 500 = 5%, default 0 |
| qtyTolerancePercent | Integer JSON number, 0..100000 inclusive | Basis points, default 0 |
| requireGrnBeforeBill | JSON boolean | Block billing unreceived goods, default false |
| blockOverBill | JSON boolean | Block billing beyond ordered quantity outside tolerance and unreceived goods, default false |

Despite the historical Percent suffix, these controls are **basis points**, not
whole percentages, amounts, FX rates or physical quantities. 1 = 0.01%,
10000 = 100%, 100000 = 1000%. Their entire supported range is exactly representable
by JSON numbers. Legacy and exact clients use the same numeric fields. No *Minor,
*Exact or FX aliases, currency metadata or mode negotiation are introduced.
Strings, localized digits, null, fractions, negative/above-limit values and
coerced booleans fail. NaN, infinity and bigint fail direct schema validation;
they are not representable as ordinary JSON values. Currency never rescales them.

All four fields are optional on updates. Omission preserves saved values; first
save fills omissions with defaults. Explicit 0/false is retained. Empty objects
retain the existing partial-upsert semantics: create defaults when absent,
otherwise refresh updatedAt and audit. Unknown keys retain legacy Zod stripping;
they have no effect, including purported money aliases or organizationId.
Unknown-only requests follow empty-object semantics. No caller-selected tenant
or row ID exists. This is not a strict unknown-key rejection contract.

GET when unconfigured returns organizationId and four defaults without inserting
or auditing. Saved reads/writes additionally retain id, organizationId, createdAt
and updatedAt. IDs are strings; timestamps serialize as ISO UTC strings. Response
controls stay numeric/boolean; no bigint conversion or precision repair occurs.
Stored controls are validated on API reads and by getProcurementSettings and
threeWayMatch before consumption. Invalid historic values fail visibly; a partial
write leaving them invalid rolls back, while an explicit valid replacement can
repair the invalid field. No automatic rescale/default repair occurs.

## Authorization, atomicity and errors

REST uses getAuthContext and MCP receives AuthContext at server creation. Reads
require authentication, preserving the existing read policy. Writes require
manage:bills, including custom-role permission resolution. API-key organization
takes precedence over conflicting organization headers; body keys cannot change
scope. Queries/upsert conflict targets use the authenticated organization.

Input validation precedes writes. An organization-unique INSERT ON CONFLICT
updates only supplied controls plus updatedAt, preserving omitted controls across
concurrent first saves and existing-row partial writes. Returned controls and
wire output validate inside the transaction; settings and scoped update audit
commit together. REST records IP/user agent; MCP records actor and supplied
controls without request metadata. Audit failure rolls back both insert/update.
Repeated requests retain row identity/createdAt and settings but refresh updatedAt
and create a separate audit per successful request; no durable idempotency key is
advertised. Conflicting writes to the same control use database serialization,
with the last executed write winning. No period/date input or posting occurs;
period locks apply to document workflows, not prospective settings changes.

REST returns 400 for malformed JSON/input, 401 for invalid/expired API keys,
403 for denied write permissions, 422 with LEGACY_NUMERIC_RANGE for unsupported
stored controls and 500 for internal/audit failure. MCP SDK input validation or
wrapTool returns isError for invalid input; wrapped permission/history failures
carry status 403/422 (history includes the compatibility code). Internal failures
return an error result. SDK validation errors do not promise an HTTP-style status.

## Verification and qualification limits

Pure procurement-settings-wire tests cover boundary values, types, unknown-field
compatibility and unsupported history. Migrated PostgreSQL operation fixtures
invoke actual handlers/API-key/custom-role auth and registered MCP SDK tools:
legacy PUT, PATCH and GET parity; defaults/no-write reads; endpoints/tool discovery;
limits/negative inputs; false/zero and omissions; row metadata; tenant/currency
isolation; initial/existing concurrent disjoint updates; repeats; scoped audits;
history rejection/repair; matching at 500-basis-point price/quantity edges and
GRN blocking; injected audit rollback. Bill lifecycle and PO regression fixtures
also pass. See MON-054 attempt/review evidence for actual commands and results.

The existing UI continues to submit numeric controls through PUT; no UI/browser,
session/OAuth, production deployment or independent accounting/security review
is claimed. Broader matching arithmetic, posting, settlement, inventory and
full-int64/IRR qualification remain with their assigned tasks. This task protects
the configuration boundary; it does not certify every match-engine input or
financial consumer. No schema migration is needed.
