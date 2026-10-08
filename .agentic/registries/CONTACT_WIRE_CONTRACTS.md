# Contact credit-limit and balance wire contracts

MON-014 integration update (2026-10-09): REST create/update reject unknown fields;
all six MCP operations use full strict object schemas, so SDK validation cannot
discard unsupported aliases such as creditLimitExact before a write. Defaults,
nullable credit aliases and operation-specific metadata stay as documented below.
The new core fixture exercises all six tools through the real SDK, including
merged invoice/bill/payment reference ownership and subsequent reversal. See
[core integration](CORE_ACCOUNTING_INTEGRATION_CONTRACTS.md).

Source-verified MON-017 slice, 2026-10-02, Asia/Tehran. Scope: three REST route
files under `contacts` (collection, ID, ID/merge) and the six operations in
`lib/mcp/tools/contacts.ts`. MON-014 retains combined core integration; its other
children cover journals, receivables, payables, banking/payments/expenses and
organization/tax configuration. No full-range business cutover is claimed.

## Adopted amounts and compatibility

`creditLimit` keeps its existing integer cents/minor-unit value. Additive
`creditLimitMinor` is a canonical ASCII integer string in the same units; neither
locale, currency nor magnitude causes rescaling. Currency context is the saved
contact `currencyCode`, including historical nulls; this change does not invent
a historical currency snapshot or attest non-USD input correctness.

Both create/update transports accept either alias, or both with exact agreement.
Omission leaves updates unchanged; null clears the limit; zero sets a zero limit.
Positive supported write range: 0 through 9007199254740991. Syntactically valid
signed-int64 strings above this legacy business/ORM range return classified
`LEGACY_NUMERIC_RANGE`/422 before contact/audit mutations. Negative, malformed,
noncanonical, out-of-int64 and disagreeing aliases fail validation (REST 400;
MCP schema validation or wrapped validation error). Strings never pass through
Number parsing. DTOs retain numeric `creditLimit` and nullable `creditLimitMinor`.
Safe historical negative values remain signed on reads; no remediation is guessed.
Unsafe stored limits fail the existing ORM safe-number guard before mutations.

REST list `owesYou`, `youOwe`, `overdue` retain numeric integer units and gain
matching `*Minor` strings. PostgreSQL `sum(bigint)` is requested as text, then
parsed/added with bigint; no int32 casts or Number aggregate arithmetic remain
here. Each returned total must fit the signed safe-number range, including the
combined customer/supplier overdue sum. Nonzero included documents must use the
contact currency. Unlike currencies (including unknown contact currency with
outstanding documents) fail the page with 422 instead of silently aggregating.
Zero-amount rows do not invalidate currency compatibility. No FX conversion or
currency-grouped balance alternative is implemented. MCP listings preserve
their existing shape without balance aggregates.

| Operation | Inputs and response | Authorization, scope and policy |
|---|---|---|
| REST GET `/api/v1/contacts` | Existing search/type/date/sort/pagination; `{data: contactWithBalance[], pagination}` with limit/balance aliases | Authenticated org and not-deleted predicates; same guards on invoice/bill aggregates. Only sent/partial/overdue invoices and received/partial/overdue bills; overdue uses PostgreSQL current_date. One unsupported row fails the page. |
| REST POST `/api/v1/contacts` | Existing metadata plus optional credit aliases; 201 `{contact}` | `manage:contacts`, resource-limit and currency-plan checks; validated aliases before insert; org taken from AuthContext; awaited existing best-effort create audit. |
| REST GET `/api/v1/contacts/{id}` | ID; `{contact}` with existing account/tax/people relations and limit alias | Authenticated org/not-deleted lookup; foreign/missing ID 404; tax percentage fields retain basis-point units. Existing relation behavior is unchanged. |
| REST PATCH `/api/v1/contacts/{id}` | Partial metadata/credit aliases; `{contact}` | Role plus org/not-deleted on lookup and update; guards before mutation; awaited diff audit. Existing currency/metadata update policies remain; no rescaling. |
| REST DELETE `/api/v1/contacts/{id}` | ID; `{success:true}` | Role and org/not-deleted lookup/update; soft-delete; existing awaited audit; foreign/deleted ID 404. No monetary input. |
| REST POST `/api/v1/contacts/{id}/merge` | Source ID, `targetContactId`; success/source/target IDs | Role, both contacts scoped/not-deleted; transactional FK repointing and source soft-delete; audits both contacts. No money/rate input/output. |
| MCP `list_contacts` | Existing search/type/page/limit; `{contacts,total,page,limit}` with limit aliases | Context org/not-deleted queries; no REST balance aggregates. |
| MCP `get_contact` | `contactId`; `{contact}` with original relations and limit alias | Org/not-deleted lookup; foreign ID tool error; existing generic not-found classification retained. |
| MCP `create_contact` | Existing metadata and optional credit aliases; `{contact}` | Role, pre-write guards/resource/currency-plan checks, normalized ISO currency code, direct Drizzle insert and create audit. |
| MCP `update_contact` | ID, partial metadata and credit aliases; `{contact}` | Role, org/not-deleted lookup/update, pre-write guards and diff audit. Omitted fields preserve current values. |
| MCP `merge_contacts` | Source/target IDs; success/source/target IDs | Same transactional parent/child scope as REST; people repointed too; source/target limit and document amounts unchanged. No monetary input/output. |
| MCP `delete_contact` | `contactId`; `{success:true,contactId}` | Role, org/not-deleted lookup/update, soft-delete and audit. No monetary input. |

REST uses shared `jsonResponse`; MCP uses `wrapTool`, direct DB and the supplied
AuthContext. There is no header/version negotiation or magnitude-driven output
mode. Numeric aliases remain required by the existing Number consumers. Current
financial flags, schema, migrations and configured databases are unchanged.

## Merge scope and limits

Both transports scope org-owned references explicitly, bank transactions through
their bank account, payment-batch items through their batch, and entity tags
through their tag. Deliberately inconsistent foreign-org child links are left
unchanged; fixtures prove amount/reference preservation. Tag deduplication and
contact-person transfer remain inside the transaction. Contact configuration and
reference merges create no journal or payment; no new period-lock/replay policy
is invented. Concurrent merge/idempotency, cross-currency merge product policy,
all nested relation authorization and application-wide security remain later
qualification; this slice does not certify them. Audits retain best-effort
delivery, not an atomic delivery guarantee.

## Remaining boundaries

Contact statements/supplier statements/activity and their financial aggregates
remain MON-015 report adoption. Bulk contact import/preview/tag/delete, exports,
email/PDF and opaque/nested contact envelopes remain MON-016 or their enclosing
MON-018..022 domain task; they must reuse the contact DTO where appropriate.
Nonmonetary people/files routes need no money alias. Contact credit-limit
evaluation against foreign invoices, full int64 consumers and historical unit
qualification remain MON-007/010. No exact full-range posting, IRR enablement or
approved numeric-client sunset is asserted. ADR-006's qualification and approved
client-window gates remain.

Fixtures call actual REST exports with hashed synthetic API keys, actual custom
role/member resolution and two tenants, and actual registered MCP validators/
handlers on a disposable migrated PostgreSQL 18.6 database. They do not exercise
HTTP/OAuth/session MCP, browser clients or the production/PostgreSQL 16 target.
