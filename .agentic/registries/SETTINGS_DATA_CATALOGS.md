# Settings data-management catalogs

Current combined integration: [LOC-017 acceptance](SETTINGS_PROVIDER_DATA_ACCEPTANCE.md)
resolves the bulk-empty MCP, confirmation scope and selection/date export findings
below. The extraction record below describes LOC-020's scope and original handoff.

LOC-020 extracts import/export, the bulk CSV wizard, backups and trash. It is a
bounded child of LOC-017; LOC-017, LOC-012, LOC-006 and LOC-002 retain independent
integration acceptance. All Persian wording is provisional pending native
linguistic/financial review. RTL qualification remains open.

## Extracted scope

| Source | Catalog and behavior |
|---|---|
| `app/(dashboard)/settings/import-export/page.tsx` | SettingsImportExport: headings/help, source selector, import/export options, date labels, full rich bank-statement guidance, wizard title and export toasts. |
| `components/settings/import-options.ts` | SettingsImportExport: all seven entity labels, dependency notes and every target-field display label. Canonical source IDs, field keys, required flags, endpoints, export date eligibility and English matching labels remain unchanged. |
| `components/bulk-import-wizard.tsx` | BulkImport: all five state descriptions, stepper/actions, upload/map/preview/result controls, counts, alert text and row diagnostics. The production state view is directly renderable inside its Sheet context. |
| `i18n/import-presentation.ts` | Matches canonical headers and provider aliases independently of display locale; maps cell strings without numeric coercion. Exact parser issues are allowlisted for translation. Unknown row diagnostics use reviewed input-check copy; network/request failures use operation-specific catalog messages. |
| `app/(dashboard)/settings/backups/page.tsx` | SettingsBackups: headings, actions/toasts and full create/restore/delete confirmations, with original date strings and disabled states. |
| `app/(dashboard)/settings/trash/page.tsx` | SettingsTrash: headings/search/filter, action toasts and full permanent-delete/empty confirmations. Fetch rejection now reports a localized load error and finishes loading. |
| `components/settings/data-management-content.tsx` | Production import-history/backup/trash lists and destructive descriptions: empty/populated states, columns, pagination, types/statuses, titles, summaries and escaped caller data. |
| `i18n/data-presentation.ts` | Finite display labels for import types/statuses, backup types, all existing trash filter types and returned backups; translated relative-time wording and snapshot entity summaries. Unknown future identifiers remain verbatim. |

Added 248 paired keys in SettingsImportExport (86), SettingsBackups (48),
SettingsTrash (52), BulkImport (41) and SettingsDataEntities (21), reaching 2,152
matching keys per locale. No locale preference, URL routing, REST handler, MCP
registration, schema, stored money or backend validation contract changed.

## Explicit exceptions

| Data/literal | Boundary |
|---|---|
| QuickBooks, Xero, FreshBooks, Wave, Dubbl | Product/provider identities retain spelling; surrounding prose and Custom CSV translate. |
| CSV field keys, original English matching labels and provider aliases | Technical import contract, including legacy header matching. Every translated field keeps an independent `matchLabel`; translations are never silently accepted as new CSV aliases. CSV headers/cells remain caller text; exact money strings, leading zeros and quoted UTF-8 fields are not converted. |
| Source/entity/status IDs, endpoint/query/body keys, organization headers and storage keys | Stable machine identifiers. Known display values translate through finite mappings; unknown values, including prototype-like strings, remain literal and escaped. |
| CSV, ZIP, JSON, USD, SKU, true/false, OFX/QFX/QBO, CAMT, MT940, BAI2 | File formats, currency/boolean/parser identities remain spelled as their technical contracts require. Localized labels retain their original units/default descriptions without changing validation. |
| `dubbl-export.zip`, entity `.csv` names, snapshot/backup `.json` names and selected filenames | Downloads and uploaded filenames retain exact naming. File input extensions and source-specific CSV columns are unchanged. |
| User names, CSV headers/preview JSON, unknown future entity keys | Caller/technical data remains verbatim, React-escaped and never evaluated as catalog text. Server `label` is replaced only for display by the known entity-type mapping; request `entityType` is unchanged. |
| Date displays, counts, byte size `B`/`KB`/`MB`, separators, stars and dashes | Existing date/number/size formatting and thresholds are preserved. Full calendar/numeral adapters remain separate work. No money formatting or rescaling occurs. |
| Native file/select/browser validation text | Browser-owned controls retain their existing behavior; no custom browser-language guarantee. |
| Arbitrary server/network/schema diagnostic prose | Not approved translation content. Known CSV parser issues are translated from exact allowlisted messages; unknown row errors show localized input-check copy, and request failures use operation fallback. REST/MCP responses and stored job error details are not rewritten. |

## MCP and independent integration handoff

Existing tools cover generic CSV preview/import, import templates/history and
CSV/ZIP exports (`lib/mcp/tools/import-export.ts`), invoice and bill imports
(`invoice-bulk.ts`, `bill-bulk.ts`), bank imports (`bank-imports.ts`), backup
operations (`backups.ts`) and trash list/restore/single-item purge (`trash.ts`).
This extraction adds no operation or API change requiring new registration.
No `empty_trash` counterpart was found for the pre-existing bulk-empty REST
operation. LOC-017 must assess that gap alongside the existing document-template
CRUD gap recorded by LOC-019; full settings MCP parity is not claimed here.

Source inspection also found existing behavior requiring parent assessment:

- The trash confirmation interpolates the currently filtered/page item count,
  while `/api/v1/trash/empty` deletes all organization trash. Its request and copy
  semantics are preserved here; filtered-scope deletion is not promised.
- A multi-selection export uses `/export/all` and therefore exports all entity
  files, and the explicit `all` action does not classify `all` as transactional
  when applying date filters. These branches are unchanged. Tests preserve their
  request contracts and do not claim selected-only export correctness.
- The existing trash type filter omits backups although the API can return them.
  Returned `data_backup` now has a translated display label; the filter set stays
  unchanged.

## Verification and limits

`tests/settings-data-catalogs.test.ts` exercises the real production provider,
page shells, all five wizard state views, loaded/empty lists and destructive
descriptions in both locales. It covers disabled controls, counts, escaping,
known/unknown type handling, relative-time/byte thresholds, summary limits,
actual CSV parser errors, exact cell strings, every field's canonical matching
label and all applicable provider aliases. The pre-extraction fixture
`tests/fixtures/settings-data-contracts.json` records actual source/field/filter
identities plus HTTP methods, organization headers, queries, confirmation bodies,
payload fields and download filenames. A TypeScript AST audit checks extraction.

These checks do not qualify browser interaction/layout, persistence, live
destructive actions, native terminology or RTL. No database access, full build,
dev server or deployment was required. See [attempt](../evidence/LOC-020-attempt-1.md)
and [self-review](../evidence/LOC-020-review-1.md) for final results and limits.
