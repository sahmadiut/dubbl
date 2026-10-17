# Provider, document and data settings combined acceptance

LOC-017 independently integrates LOC-018, LOC-019 and LOC-020. The three child
registries retain their extraction inventories and dated findings. This record
describes the combined implementation after integration repairs; it does not
complete LOC-012, LOC-006, LOC-002, native L10N or RTL qualification.

## Coverage and preserved exceptions

The eight namespaces SettingsBilling, SettingsStripe, SettingsDocumentTemplates,
SettingsImportExport, SettingsBackups, SettingsTrash, BulkImport and
SettingsDataEntities have matching English/Persian keys. SettingsErrors remains
the shared finite error allowlist. Existing child inventories cover all authored
copy in the six settings pages, supporting views and bulk CSV wizard.

Provider/product names, saved caller HTML/text, template variables, file formats,
CSV machine headers/aliases, entity/status identifiers, exact money strings,
URLs, filenames, technical units and browser-owned control text retain their
documented boundaries. Prices, timestamp/number adapters, server-generated
documents and native Persian financial wording remain separate qualification.
Persian copy remains provisional. The only changed catalog message clarifies
that emptying trash affects the entire organization's trash outside current
filters/pages; it deliberately makes no filtered-page count claim.

## Findings resolved in integration

| Finding from child handoff | Current behavior and verification |
|---|---|
| No document-template CRUD MCP tools | Five strict, described tools use the same direct-DB service as REST list/get/create/update/delete. Organization scope, manage:invoices on writes, nullable/omitted fields, immutable type, soft deletion and audit are verified on PostgreSQL. |
| Template default assignment | Creation and update serialize on the organization row and atomically clear live same-type defaults; other types and organizations remain unchanged. No schema change. |
| No bulk-empty-trash MCP tool | `empty_trash` requires explicit confirm=true and delete:organization. It uses the same service as REST; all deletions are atomic. Injected late failure proves rollback. |
| Additional billing/provider MCP gaps found in parent inventory | Billing summary, billing portal and Stripe settings now share direct-DB/provider services with REST. Mapping updates reject foreign/deleted ledger or bank accounts and return only saved mapping fields, never access/refresh/webhook secrets. |
| Filtered/page count misstates destructive scope | Both catalogs and the production confirmation describe all organization trash without interpolating the current view's count. Includes records older than the 30-day list. |
| Multi-selection exports all entity files | Selected CSVs use existing individual REST endpoints and are packaged into one client ZIP containing exactly selected files. Transactional files receive inclusive date filters; master data does not. Exact bytes remain unchanged. |
| Explicit all action omits dates and names ZIP .csv | All uses the existing read-only snapshot ZIP endpoint with both dates and the .zip filename. |

The pre-extraction HTTP fixture is updated only for the intentionally replaced
export branch. The new request-helper tests inspect actual calls, independent
ZIP local headers and exact CSV payload bytes rather than snapshotting broken
selection behavior. Other source request fixtures remain unchanged.

## MCP operation inventory

- Billing/Stripe: existing tools in integrations.ts (checkout, status, connect,
  sync, disconnect); get_billing_settings, create_billing_portal and
  update_stripe_settings in provider-settings.ts close the additional gaps.
- Document templates: list_document_templates, get_document_template,
  create_document_template, update_document_template, delete_document_template;
  existing preview_document_template retains shared rendering.
- Import/export: existing generic, journal, invoice, bill and bank import tools;
  individual and all CSV export tools retain their existing contracts.
- Backups: existing backup list/create/download/restore/delete operations.
- Trash: existing list/restore/purge plus empty_trash.

## Verification boundary

Combined child tests render real components through PresentationProvider in both
locales, audit authored JSX/attributes and preserve request/field contracts.
Parent tests cover selected/all export requests, ZIP bytes and truthful destructive
copy. A migrated disposable loopback PostgreSQL fixture invokes real REST and
linked registered MCP tools and independently reads SQL text for template/default,
tenant, soft-delete, purge/rollback and audit assertions. Existing backup, Stripe,
document rendering and generic import/export fixtures provide regression checks.

Selected exports fetch separate per-entity snapshots; they do not promise the
single consistent snapshot of the existing all-export endpoint. The existing
trash filter omits backup records, although returned backup labels and global
emptying include them; this is an inventoried UI limitation. Bulk purge can still
fail on referential constraints; atomic rollback now preserves all records on
failure. Audit uses the existing best-effort logging policy.

No live provider network calls, browser interaction/layout, native linguistic
review, physical printing, hosted CI, build, dev server or deployment acceptance
is implied. No ledger, stored money unit, FX policy, currency flag or IRR readiness
change is made. See LOC-017 attempt/review evidence for actual commands/results.

## Owner scope for subsequent tasks

After the above changes were made, the owner directed that Stripe be preserved
unchanged from the next task onward. DEC-008, root AGENTS.md and START_HERE.md
record this accepted scope. Current changes are retained and verified. Future
integration/native/RTL tasks must not do dedicated Stripe work or treat its gaps
as blockers without explicit owner reauthorization. This does not delete or
disable the existing integration or claim live-provider acceptance.
