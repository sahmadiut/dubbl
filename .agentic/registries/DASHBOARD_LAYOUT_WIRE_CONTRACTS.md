# Dashboard layout contracts (MON-120)

2026-10-08, Asia/Tehran. Bounded child of MON-105; technical self-review.
MON-105 retains combined dashboard/report/delivery/budget acceptance.

| REST boundary | MCP tool | Input and output |
|---|---|---|
| GET /api/v1/dashboard/layouts | list_dashboard_layouts | No input; {layouts} in creation order |
| POST /api/v1/dashboard/layouts | create_dashboard_layout | name, layout, optional isDefault; 201 {layout} (MCP returns {layout}) |
| GET /api/v1/dashboard/layouts/[id] | get_dashboard_layout | Layout UUID; {layout} |
| PATCH /api/v1/dashboard/layouts/[id] | update_dashboard_layout | UUID plus at least one of name, layout, isDefault; {layout} |
| DELETE /api/v1/dashboard/layouts/[id] | delete_dashboard_layout | Layout UUID; {success:true} |

All operations use shared direct Drizzle services in lib/api/dashboard-layouts.ts;
MCP uses wrapTool and is registered in lib/mcp/tools/index.ts. Input objects are
strict, UUIDs valid, names nonempty, flags boolean. Each ordered widget has string
widgetType, numeric x/y/w/h and optional object config. Existing/custom widget
identifiers, fractional/negative grid values and independently set default flags
remain supported. Omitted create isDefault defaults false; setting a flag does
not clear other defaults. No new widget-type or grid-dimension policy is invented.

Layouts return id, organizationId, userId, name, isDefault, layout, createdAt and
updatedAt. Timestamp output is ISO JSON, with finite SQL and JavaScript date
checks. Reads preserve stored values; PATCH updates updatedAt. SQL isfinite is
checked because Drizzle's appended timezone can turn timestamp infinity into an
ordinary-looking JS date. Internal validity projections are never returned.

Grid values are physical layout coordinates/dimensions with magnitude at most
9007199254740991; they are not money. Opaque config JSON accepts finite numbers
within that same safe numeric range, strings, booleans, arrays, plain objects and
null. Fractional numbers keep the existing JavaScript-number contract. Exact
consumers retain decimal/integer values as strings; arbitrary precision numbers
are not advertised. Numeric money cents/units are never inferred from key names.
There is no arithmetic, currency conversion, rescaling, generated Minor alias or
exact-mode negotiation. For example amount:1250, amountMinor:"9223372036854775807"
and rateExact:"0.000000000000000001" round-trip unchanged. This configuration
layer does not enforce domain-specific agreement or canonical syntax of opaque
strings. Actual financial operations must enforce their own money contracts.
Opaque object keys, including an own __proto__, constructor and prototype, are
preserved as JSON data; the validator does not assign them into a target object's
prototype. A record parser that silently stripped __proto__ was replaced and both
actual transports have round-trip assertions for these keys.

The complete name/flag/layout input and stored projection is limited to 10000
JSON values (including root and containers), depth 32 (root depth zero) and
262144 UTF-8 bytes of compact JSON. Undefined, bigint, nonfinite/unsafe numbers,
functions, symbols, dates/other non-JSON objects, accessors, hidden/named array
properties, sparse arrays and cycles are rejected. Config must be an object.
These limits apply across all widgets, including merged PATCH output, rather
than independently granting each widget a full limit.

REST uses existing API-key/session authorization. Every query/mutation requires
both authenticated organizationId and userId; neither is accepted from payload.
Another organization's same user and another user in the same organization see
empty lists and 404 detail/mutations. Existing member/custom-role access to
personal layout configuration is retained without requiring view:data or granting
financial-data permissions. MCP uses the trusted AuthContext established when
the server is created. API-key auth can update lastUsedAt separately.

Invalid shape, UUID, empty PATCH, malformed REST JSON or unsupported input JSON
returns 400; MCP SDK schema errors or wrapped validation errors have isError.
Unsafe config numbers return 422 LEGACY_NUMERIC_RANGE (MCP also includes status).
Unsupported stored shape/complexity/timestamps returns 422; unsafe stored config
numbers retain LEGACY_NUMERIC_RANGE. No magnitude-based strings or null fallback.

Create validates before insertion and validates returned output inside a DB
transaction. PATCH/DELETE lock the owned row, validate the stored layout before
mutation, then validate updated output before commit. A valid individual PATCH
that exceeds the combined stored-output limit rolls back, including updatedAt.
Unsupported stored layouts require explicit separate remediation; these APIs
never silently repair or delete them. No financial posting, period lock, new
audit/notification/email, schema migration or IRR production flag change occurs.
Existing CRUD retry/default semantics are retained; create is not newly idempotent.

Actual tests: tests/dashboard-layout-wire.test.ts and migrated disposable
PostgreSQL REST/API-key/MCP SDK tests/integration/dashboard-layouts.test.ts.
They cover both legacy numeric and exact string configs, all CRUD pairs, full
tool registration, auth rejection, organization/user isolation, member access,
invalid/unsafe/oversized inputs, stored corruption/infinite timestamps and
pre-commit rollback of merged output. No browser/build/dev/deployment required.
