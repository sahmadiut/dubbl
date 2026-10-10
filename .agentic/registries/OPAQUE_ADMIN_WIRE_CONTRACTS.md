# MON-125 opaque JSON and administrative forwarding

Verified 2026-10-10 against actual source and disposable PostgreSQL fixtures.
MON-034 retains combined integration acceptance. No schema, stored-history,
currency rescale, provider request or production IRR flag change.

## Adopted boundaries

| Boundary | Input and authorization | Output, units, aliases and range |
|---|---|---|
| GET /api/v1/audit-log; list_audit_log | Current AuthContext organization, view:audit-log; strict action/entityType/entityId/userId/date/page/limit filters. Page 1..1000000, limit 1..100. Gregorian dates mean UTC midnight, ISO instants require offsets. Plan retention still clamps client dates. | Existing data/pagination envelope, actor name, UTC instant, network metadata and literal changes JSON. Originating domain units and exact strings retained; no fabricated Minor siblings or inferred currency. |
| Generic logAudit changes writer | Internal originating-domain payload and AuthContext; opaqueJsonRecord preflight occurs before audit-row insert. No public audit write API/tool. | Safe bigint becomes existing numeric JSON; exact string values remain strings. Numeric compatibility range is +/-9007199254740991; NaN, Infinity and unsupported bigint reject before audit insertion. Existing database-error logging/best-effort policy remains. Domain transaction/audit atomicity belongs to originating services, not this generic helper. |
| GET /api/v1/admin/organizations/:id; get_admin_organization | Database-backed site-admin flag required. Session administrator retains global organization addressing. Site-admin API key and MCP access are restricted to the credential/AuthContext organization; request headers/unknown tool keys cannot widen scope. | Existing organization/subscription/member/default-limit envelope. billApprovalThreshold and mileageRate retain legacy integer cents and gain nullable billApprovalThresholdMinor/mileageRateMinor strings. No amount rescaling, including IRR organizations. Monetary magnitude max 9007199254740991 through transitional ORM. |
| PATCH /api/v1/admin/organizations/:id; update_admin_organization | Same site-admin/scope checks; live organization lock, strict nonempty schema. Seat count 1..2147483647. Other counts and storage MB 0..2147483647; canonical decimal strings retained for existing forms. Null/empty overrides reset; boolean/null multi-currency flag only. Enum controls and text notes/name max 10000. Unknown keys, money inputs, coercible objects/booleans, exponents and unsupported ranges reject. | {success:true}; atomic partial subscription upsert under organization lock. Other subscription fields and historical payloads remain intact; concurrent first-row creation produces one row. No billing price input or Stripe action. |
| GET /api/v1/admin/organizations, users, stats, usage | Existing global session-only site-admin gate; no additional global MCP access. These existing global controls do not acquire an organization override from public inputs. | Guarded forwarding; organization/user identity, plan/seat metadata, counts, file counts/storage bytes. Existing SQL count string fields retain their types. Numeric counts/byte sums must remain finite and within safe Number range. No monetary amount or inferred money alias. |

Admin plan `Infinity` values have a specific, explicit conversion to `null`, which
retains the existing JSON representation of unlimited plan quotas. Other numeric
Infinity/NaN values never receive that exception. `planDefaults` and
`effectiveLimits` retain all other values, including report arrays and booleans.
Missing subscriptions keep the established free-plan read defaults.

Opaque audit reads select `changes::text`, then validate every unquoted JSON number
before pg can decode it. A numeric token must be finite, within safe range and
equal the decimal value of its shortest JavaScript round-trip representation.
Thus 0.5 and signed safe integers survive, while 0.1234567890123456789,
9007199254740993 and underflowing 1e-400 fail with HTTP/MCP 422
LEGACY_NUMERIC_RANGE. Arbitrary strings such as 001250, huge integer aliases,
high-precision FX and escaped numeric text remain literal. Numeric history is
never repaired, rescaled or rewritten by a read failure. The same parser is
shared with MON-124 invoice snapshots without changing their contract.

Admin PATCH reads raw JSON through this token guard before schema parsing, so
1.0000000000000000001 cannot round to an accepted integer. Malformed JSON is 400;
unsupported numeric tokens are 422; well-formed schema violations are 400. MCP
validates full strict schemas through the real SDK and uses wrapTool; already
decoded Number inputs cannot recover precision lost before the SDK boundary.
Canonical text overrides avoid that ambiguity. Dates, quantities, basis points,
counts and money do not share an implicit unit conversion.

## Complete persisted JSON ownership map

All 30 `jsonb(...)` declarations currently in lib/db/schema are covered below.
This is an ownership map, not a new claim of independent financial/security
qualification for each existing domain. Domain fixtures and their documented
ranges remain authoritative. Historical remediation remains separate.

| Schema and JSON fields | Owner, units and exact-alias policy |
|---|---|
| audit.changes | This task: literal originating-domain envelopes; guarded writer and SQL-text reads above. Transactional domain audit inserts retain the originating domain owner. |
| approvals.conditions | [Approval contracts](APPROVAL_WIRE_CONTRACTS.md): fixed minor-unit monetary condition strings and named operators; no generic string reinterpretation. |
| banking.warnings, metadata, rawPayload | [Bank imports](BANK_IMPORT_WIRE_CONTRACTS.md) and [bank transaction reads](BANK_TRANSACTION_READ_WIRE_CONTRACTS.md): parser warnings/configuration and provider-source units; money aliases only for declared bank fields. |
| banking.conditions, splitAllocations | [Bank rule contracts](BANK_RULE_WIRE_CONTRACTS.md): fixed signed monetary rules and explicit exact strings; basis-point allocations keep separate units. |
| backups.entityCounts | [Backup contracts](BACKUP_WIRE_CONTRACTS.md): entity counts, not money; versioned whole-snapshot range/preflight is owned by MON-032. |
| crm.stages | [CRM contracts](CRM_WIRE_CONTRACTS.md): stage IDs/text/probabilities, not deal-value cents; stage metadata does not acquire Minor aliases. |
| dashboard.layout | [Dashboard layout contracts](DASHBOARD_LAYOUT_WIRE_CONTRACTS.md): coordinates and opaque widget configuration, owning report filters retain their declared money units/aliases. |
| auth.backupCodes, permissions | Authentication/TOTP and role configuration in lib/auth/two-factor.ts and lib/api/preset-roles.ts: credential hashes and permission strings; no financial numeric fields/aliases. Authentication/security qualification remains separately scoped. |
| bulk.errorDetails | [Generic import/export](GENERIC_IMPORT_EXPORT_WIRE_CONTRACTS.md): row counts/indices and error text, not money; domain row writers retain monetary units. |
| contacts.addresses | [Contact contracts](CONTACT_WIRE_CONTRACTS.md): address text/metadata; explicit contact credit-limit cents/Minor siblings remain on the contact DTO. |
| email.customEmails | Document email recipient string list; provider/email orchestration owned by MON-123 and PROVIDER_WEBHOOK_WIRE_CONTRACTS, no money fields. |
| integrations.metadata, payload | [Provider/webhook contracts](PROVIDER_WEBHOOK_WIRE_CONTRACTS.md): native provider envelopes stay in provider units; only allowlisted mapping money has Minor siblings. |
| invoicing.senderSnapshot, recipientSnapshot | [Invoice snapshots](INVOICE_SNAPSHOT_WIRE_CONTRACTS.md): opaque saved party strings/numbers with token validation, signed-history preservation and atomic text corrections; no guessed monetary aliases. |
| inventory.options | [Inventory catalog](INVENTORY_CATALOG_WIRE_CONTRACTS.md): variant option names/string values; prices and costing retain catalog/movement/valuation ownership. |
| reports.config, recipients | [Custom reports](CUSTOM_REPORT_WIRE_CONTRACTS.md), [report schedules](REPORT_SCHEDULE_WIRE_CONTRACTS.md): allowlisted columns/filters and recipient strings; exact money filters have source-specific units. |
| mcp.redirectUris | OAuth client redirect URI string list; no money or FX. OAuth/security acceptance stays separately scoped. |
| payroll.deductionsBreakdown, formData | [Payroll outputs](PAYROLL_OUTPUT_WIRE_CONTRACTS.md): saved deduction/tax-form cents and declared exact aliases, currency snapshot and payroll-owned validation. |
| projects.tags, labels | [Project master](PROJECT_MASTER_WIRE_CONTRACTS.md): text tags/labels, not time/cost/billing units. |
| webhooks.events, metadata, payload | [Provider/webhook contracts](PROVIDER_WEBHOOK_WIRE_CONTRACTS.md): event names and original domain/provider payload units; outgoing guarded canonical bytes/signature and incoming provider-money schemas remain MON-123 ownership. |

Non-JSONB configuration and serialized strings also retain explicit owners:
saved report filters/schedules/layouts -> report/dashboard registries;
payroll/journal FX provenance -> payroll/journal contracts; bank profile/rules ->
bank registries; document email/template rendering -> MON-127; signing payloads
-> MON-126; backup/import/export documents -> MON-032/033. Admin settings are
text flags/domain lists; check/user-role/cancellation mutations return constant
boolean/success envelopes and do not carry opaque monetary payloads. There is no
remaining unassigned monetary JSON declaration in this inventory.

## Fixture evidence and limits

opaque-admin.test.ts runs actual REST handlers and full registered MCP SDK tools
against a migrated randomly named database on an explicit disposable loopback
server. It covers exact/legacy opaque aliases, signed safe bounds, decimal loss,
underflow, null history, filters, plan retention, two tenants, denied custom
permissions/site-admin users, invalid credentials, rejected unknown fields/raw
JSON, unchanged persisted state after failures, int32 extremes/resets, concurrent
existing and first-subscription updates, guarded audit writes and unsafe stored
organization money. invoice-snapshots.test.ts verifies parser reuse and existing
immutable/signed-history behavior. A second worker invokes all four actual global admin read handlers and global
organization GET/PATCH with only NextAuth session resolution stubbed; real
site-admin database gates enforce unauthenticated, denied and revoked access,
while authorized sessions retain global addressing. Global session UI/JWT/login
and large admin aggregate scale are not browser-qualified. Detail admin
authorization/scoping is also exercised through actual API credentials and MCP. No global administrative tools are exposed through an
organization-scoped MCP credential.
