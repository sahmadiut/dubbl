# Combined settings catalog acceptance

LOC-012 independently accepts the catalog integration of LOC-014, LOC-015,
LOC-016 and LOC-017. LOC-006/LOC-002 retain their own integration acceptance.
This is settings message extraction/rendering/behavior acceptance; native Persian
financial terminology, complete RTL and broader presentation adapters remain open.

## Complete scope and exceptions

The current settings tree has 21 pages plus layout/loading. Twenty pages and the
shared layout/loading are in this acceptance. DEC-008 excludes dedicated Stripe
work: its existing page, card, helpers, tools and catalog namespace are preserved.
Ordinary combined navigation/full-suite regression checks do not qualify Stripe.
Billing remains in the existing catalog inventory; no billing/provider service
changes or network calls are introduced here.

| Family | Pages and supporting inventory |
|---|---|
| Core | General, procurement, cost centers, tags, navigation, loading and locale preferences: [core inventory](SETTINGS_CATALOGS.md), including country/payment/legal/scheme exceptions. |
| Automation | Bank rules, approvals, pipelines, webhooks, reminders and notification preferences: [automation inventory](SETTINGS_AUTOMATION_CATALOGS.md), including saved templates, literal insertion tokens, event IDs and canonical money fields. |
| Access/audit | Members, roles, advisors, API keys and audit log: [access inventory](SETTINGS_ACCESS_CATALOGS.md), including all 45 permission IDs, seeded/custom role names, raw key bytes and finite audit labels. |
| Provider/document/data | Billing, document templates, import/export, backups, trash and bulk import: [combined acceptance](SETTINGS_PROVIDER_DATA_ACCEPTANCE.md), [document inventory](SETTINGS_DOCUMENT_CATALOGS.md), [data inventory](SETTINGS_DATA_CATALOGS.md). Stripe is owner-excluded as described above. |

All authored settings copy is catalog-backed within these boundaries. Existing
names, HTML/template variables, CSV headers/aliases, codes, permission/status/type
IDs, routes/query/body fields, URLs, filenames, technical abbreviations/samples,
legal reference names and browser-owned messages retain the child inventories'
explicit exceptions. Saved caller content is not translated or used as a key.
Date/number/money inputs and provider prices retain their existing semantics.
No translation is written back into historical financial or document data.

## Independent integration findings

| Finding | Disposition |
|---|---|
| General settings reads `lock`, while GET returns `periodLock` | The production reader now consumes the actual envelope, including null. Failed HTTP/JSON/wire reads report translated guidance and do not adopt a lock. The real REST response is passed through the UI reader in both locales on migrated PostgreSQL. |
| Pipeline deletion says live deals lose their reference | Both catalogs now describe the live-deal deletion prerequisite. The exact existing 409 response maps to contextual translated guidance. REST and registered MCP both reject without data changes, including exact saved deal cents. |
| Pipeline/reminder deletion may report success on rejected HTTP | Both callbacks check the response, toast localized errors and reject so the confirmation remains available for retry. Cancel labels are explicitly catalog-backed. Successful deletes still refresh and report success. |
| Pipeline default/reminder toggle and initial loads lack error handling | HTTP failures and network/JSON errors now report operation/status guidance without adopting failure data or success state. Reminder create/update retain forms on failure. Initial loading finishes even on rejection. |
| Inert organization Delete button | Existing nonfunctional control, retained and catalog-backed; this task does not introduce or claim organization deletion. Organization lifecycle/admin qualification remains separate. |
| Duplicate PEPPOL scheme value | Existing reference identity/alias retained; changing it would alter a stored/request contract outside message extraction. No new network/legal qualification is claimed. |
| Access-page fetch rejection/indeterminate states | Existing limitations remain as recorded by LOC-016; initial server rendering does not certify every access-page network workflow. Existing translated mutation errors and permissions remain unchanged. |

Eight paired error keys were added across SettingsGeneral, SettingsPipelines,
SettingsReminders and SettingsErrors; pipeline deletion copy was corrected.
The complete production catalogs contain 2,160 compatible keys per locale.
Persian wording remains provisional pending native linguistic/financial review.

## Contracts and MCP boundary

No REST route, domain service, MCP registration, permission, schema, migration or
financial write logic changed. Existing organization/procurement/cost-center/tag,
bank-rule/approval/pipeline/webhook/reminder/notification, role/audit,
document-template/import/export/backup/trash tools remain in place. Existing
locale preference tools retain their shared service and separate language,
currency, calendar, numeral and time-zone settings. No new operation is added.

Source inventory found no dedicated get/set-period-lock, member invitation/link,
advisor or API-key management MCP counterparts. Fiscal-year close/reopen tools
are not substitutes for direct lock settings. These are existing broader MCP
coverage gaps, not changes to REST/MCP contracts or claims of complete settings
operation parity. This catalog acceptance does not certify those workflows.
Stripe-specific parity/provider gaps cannot block this task under DEC-008.

## Verification boundary

The new combined rendering test composes all 20 in-scope pages with the real
settings layout, router context and PresentationProvider in both locales. Child
tests separately cover populated controls, source extraction, technical write
identities, ICU interpolation and escaped caller data. Production callbacks run
with controlled request/state boundaries to exercise HTTP, network, malformed
JSON, retry, success, loading and failure adoption behavior.

A new parent PostgreSQL fixture composes core settings, pipeline/reminder,
access-role, document-template and notification operations in one migrated
disposable tenant. It uses authenticated REST, linked registered MCP and separate
SQL-text assertions for persistence, tenant isolation, denied writes, saved
template tokens, soft deletion, exact `3000000001` deal cents and no journal
creation. Broader existing locale/organization/procurement tests supplement it.
Coverage is sampled integration of the catalog families, not every endpoint's
business or security qualification.

No browser click/layout, screenshot, native-language approval, live provider,
PDF/physical printer, application database, hosted CI, build, dev server or
deployment acceptance is claimed. IRR readiness and all currency flags remain
unchanged. See [attempt evidence](../evidence/LOC-012-attempt-1.md) and
[self-review](../evidence/LOC-012-review-1.md).
