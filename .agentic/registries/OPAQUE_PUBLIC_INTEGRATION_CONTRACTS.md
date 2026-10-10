# MON-034 combined opaque and public boundary acceptance

Verified 2026-10-10 through actual REST handlers, full registered MCP SDK linked
transports, static signing SSR and HTML/PDF generation on disposable PostgreSQL.
This parent supplies independent combined acceptance for MON-124..127. Existing
domain registries remain authoritative for their own operations and ranges.

## Boundaries, units and ownership

| Boundary and owner | Inputs and scope | Outputs, exact aliases and supported ranges |
|---|---|---|
| Invoice snapshot GET/PATCH, get_invoice_snapshot/update_invoice_snapshot; [snapshot contracts](INVOICE_SNAPSHOT_WIRE_CONTRACTS.md) | Owned live invoice UUID; view:data/read or manage:invoices/correct. Strict nonempty allowlisted party text objects. Organization -> invoice -> signatures locking. | sender/recipient objects or null. Arbitrary exact strings/identifiers retain literal values; no inferred aliases or rescaling. JSON Numbers must be finite, within +/-9007199254740991 and retain the original decimal token on round-trip. Signed history rejects corrections with 409. Party-only reads do not decode unrelated monetary headers. |
| Audit list and administrative forwarding; [opaque/admin contracts](OPAQUE_ADMIN_WIRE_CONTRACTS.md) | Audit: AuthContext tenant/view:audit-log, strict filters and pagination, retained plan-date clamp. Admin: real site-admin gate; API/MCP tenant scope, global session-only controls remain session-scoped. Strict int32 quotas, canonical numeric text/reset and boolean controls. | Literal originating audit before/after payloads, original units/string aliases and safe JSON Numbers as above. No synthetic monetary semantics for opaque keys. Known org billApprovalThreshold/mileageRate numeric cents gain Minor siblings. Counts, bytes, MB and seats are separate units, 0..2147483647 write quotas (seats >=1); only documented plan Infinity sentinels become unlimited null. |
| Signature request/list/resend REST/MCP, public POST and signing SSR; [signing contracts](INVOICE_SIGNING_WIRE_CONTRACTS.md) | Tenant-owned live invoice; manage:invoices/request/resend, view:data/list; public signing token is a bearer capability. Strict signer text/email, optional future ISO expiry, PNG submission. No money inputs. Same organization -> invoice -> signature lock order as corrections. | Signature identity/proof/status/UTC timestamps retain existing envelopes; summary subtotal/taxTotal/total/amountPaid/amountDue numeric currency minor units and matching Minor strings. Finite safe integers only; USD cents, IRR/JPY scale 0, KWD scale 3. Unsupported saved snapshots/summary fail before mutation or delivery. Repeated signing cannot overwrite proof. |
| Document, public portal/payment, email and template bridges; [render contracts](DOCUMENT_RENDER_WIRE_CONTRACTS.md) | Live owned invoice/quote/credit note/purchase order/debit note and contact; view:data, template/email management permission, or active contact/payment capability. Strict format/UUID/filter inputs. Read-only repeatable-read snapshot for document projection. | HTML or PDF base64/bytes plus safe numeric document currency minor units and Minor aliases. Quantities remain hundredths; tax/percentage scales retain their owning contract. Template samples use org currency. Saved parties and exact currency text feed authenticated/public render consistently. Unsupported numeric/snapshot history rejects with 422 LEGACY_NUMERIC_RANGE before requested attachment writes/delivery. |

Public token capabilities intentionally authorize their limited public operation
without session authentication. Authenticated MCP token operations additionally
enforce the current organization and grants. A forged organization header cannot
expand API-key scope. A site administrator API key also retains tenant scope.
No new monetary write, MCP operation or schema is introduced by this parent.

## Persisted JSON ownership closure

The machine-readable declaration list below is checked against every actual
jsonb property in lib/db/schema by opaque-public-integration.test.ts. New, removed
or renamed declarations fail until this inventory and their owner are reviewed.
The complete units/alias policies are in the linked registries and in the
[opaque/admin ownership map](OPAQUE_ADMIN_WIRE_CONTRACTS.md).

<!-- JSON ownership -->
```json
{
  "approvals.ts": ["conditions"],
  "audit.ts": ["changes"],
  "auth.ts": ["backupCodes", "permissions"],
  "backups.ts": ["entityCounts"],
  "banking.ts": ["warnings", "metadata", "rawPayload", "conditions", "splitAllocations"],
  "bulk.ts": ["errorDetails"],
  "contacts.ts": ["addresses"],
  "crm.ts": ["stages"],
  "dashboard.ts": ["layout"],
  "email.ts": ["customEmails"],
  "integrations.ts": ["metadata", "payload"],
  "inventory.ts": ["options"],
  "invoicing.ts": ["senderSnapshot", "recipientSnapshot"],
  "mcp.ts": ["redirectUris"],
  "payroll.ts": ["deductionsBreakdown", "formData"],
  "projects.ts": ["tags", "labels"],
  "reports.ts": ["config", "recipients"],
  "webhooks.ts": ["events", "metadata", "payload"]
}
```

| Persisted/serialized family | Existing contract owner and units |
|---|---|
| approvals.conditions | [Approvals](APPROVAL_WIRE_CONTRACTS.md): named condition operators with fixed monetary minor-unit strings. |
| audit.changes | [Opaque/admin](OPAQUE_ADMIN_WIRE_CONTRACTS.md), originating domain and [snapshots](INVOICE_SNAPSHOT_WIRE_CONTRACTS.md): literal payloads, no guessed units. |
| auth.backupCodes/permissions, mcp.redirectUris | auth/two-factor, preset roles, OAuth/security: credential hashes, permission/URI strings, no money. Security qualification remains separate. |
| backups.entityCounts | [Backup](BACKUP_WIRE_CONTRACTS.md): counts; versioned money/snapshot restoration stays backup-owned. |
| banking.warnings/metadata/rawPayload/conditions/splitAllocations | [Import](BANK_IMPORT_WIRE_CONTRACTS.md), [reads](BANK_TRANSACTION_READ_WIRE_CONTRACTS.md), [rules](BANK_RULE_WIRE_CONTRACTS.md): source-native metadata, declared minor-unit fields, basis points separate. |
| bulk.errorDetails | [Generic import/export](GENERIC_IMPORT_EXPORT_WIRE_CONTRACTS.md): row counts/indices/errors; row money remains domain-owned. |
| contacts.addresses | [Contacts](CONTACT_WIRE_CONTRACTS.md): text address metadata; credit limits use contact-owned cents/Minor siblings. |
| crm.stages | [CRM](CRM_WIRE_CONTRACTS.md): IDs/text/probabilities; deal money uses declared deal aliases. |
| dashboard.layout | [Layout](DASHBOARD_LAYOUT_WIRE_CONTRACTS.md): coordinates/config, report-owned money filters. |
| email.customEmails | [Providers](PROVIDER_WEBHOOK_WIRE_CONTRACTS.md) and [rendering](DOCUMENT_RENDER_WIRE_CONTRACTS.md): recipient strings and email/attachment orchestration; display labels are text. |
| integrations.metadata/payload, webhooks.events/metadata/payload | [Providers/webhooks](PROVIDER_WEBHOOK_WIRE_CONTRACTS.md): literal native envelopes; only named provider/domain mappings carry money aliases. |
| inventory.options | [Catalog](INVENTORY_CATALOG_WIRE_CONTRACTS.md): option text; monetary price/cost retains domain ownership. |
| invoicing.senderSnapshot/recipientSnapshot | [Snapshots](INVOICE_SNAPSHOT_WIRE_CONTRACTS.md): literal saved party JSON; signing/rendering consume checked SQL text. |
| payroll.deductionsBreakdown/formData | [Payroll output](PAYROLL_OUTPUT_WIRE_CONTRACTS.md): declared saved cents/exact aliases and currency snapshots. |
| projects.tags/labels | [Projects](PROJECT_MASTER_WIRE_CONTRACTS.md): text arrays, cost/billing remains domain-owned. |
| reports.config/recipients | [Custom reports](CUSTOM_REPORT_WIRE_CONTRACTS.md), [schedules](REPORT_SCHEDULE_WIRE_CONTRACTS.md): allowlisted source filters/units and recipient strings. |
| Non-jsonb serialized configurations and forwarding | Existing report/layout registries own report filters; banking registries own bank profiles/rules; payroll/journal registries own FX provenance; backup/import/export own whole snapshots. Document templates/email/public SSR/PDF use rendering contracts above. Authenticated global admin read forwarding and text settings retain opaque/admin ownership. |

## Independent parent fixtures

opaque-public-integration-worker.ts uses real legacy REST and exact MCP writers
in USD, IRR and KWD. Each invoice is corrected through REST or MCP, its literal
before/after audit is read through both transports, and the signing summary/SSR,
authenticated HTML/PDF, public payment PDF and portal render are checked together.
Signing then freezes corrections; repeated signing rejects and subsequent
render/audit retain the same corrected history and amount. Literal full-int64
strings, leading-zero identifiers, tiny FX strings and safe fractions survive.

The same disposable dataset also combines REST/MCP administrative partial quota
updates with exact organization money aliases. Tenant, denied custom grants,
invalid credentials, forged headers, unknown/unsupported correction fields and
foreign admin addressing fail with snapshots of all relevant mutation tables
unchanged. Persisted decimal loss, unsafe integers and underflow are then tested
across snapshot, signing/public POST/SSR and authenticated/public render together.
Unsafe monetary headers reject financial consumers while party-only reads remain
usable. No provider is configured or contacted by this independent parent worker.

Child regression suites independently exercise audit/admin malformed raw tokens,
rollback, race locks, all five document kinds, previews, SMTP capture and session
site-admin forwarding. Those suites supplement this parent fixture; their prior
completion alone does not satisfy parent acceptance.

## Qualification limits and next ownership

No historical repair, rescaling, production flag, migration or deployment changes.
Safe numeric compatibility remains +/-9007199254740991, even when opaque strings
carry larger integers. Already-decoded MCP Numbers cannot recover precision lost
before the SDK. Domain best-effort audit and provider-after-commit delivery retain
their documented limits; no exactly-once provider guarantee is implied. No browser
interaction, PDF visual fit, native Persian review, full-int64 cutover, independent
accounting/security approval or release qualification is claimed. MON-008 owns
broad consumer arithmetic and localized display; migration and release gates
retain their own acceptance after this parent completes.
