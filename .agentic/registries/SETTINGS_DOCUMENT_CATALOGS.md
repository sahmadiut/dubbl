# Document template settings catalogs

Current combined integration: [LOC-017 acceptance](SETTINGS_PROVIDER_DATA_ACCEPTANCE.md)
resolves the CRUD MCP gap identified below and shares template management with REST.
The extraction record below describes LOC-019's scope and original handoff.

LOC-019 extracts the document-template settings slice of LOC-017. LOC-017,
LOC-012, LOC-006 and LOC-002 retain independent combined acceptance. Persian
wording is provisional pending native review; RTL qualification remains open.

## Extracted scope

| Source | Catalog and behavior |
|---|---|
| `app/(dashboard)/settings/document-templates/page.tsx` | SettingsDocumentTemplates: create/edit and preview dialog headings, download action, success/error toasts and deletion confirmation. Cancel is supplied explicitly to the shared confirmation hook. |
| `components/settings/document-template-content.tsx` | SettingsDocumentTemplates: page/list/empty/default labels, all five type labels, form sections/fields/help/examples, variable-reference help, save states and iframe title. The production form/list/preview components are directly renderable for verification. |
| `components/settings/document-template-request.ts` | Checks failure responses through SettingsErrors and operation-specific fallbacks before success actions; preserves successful JSON/HTML/PDF response streams. Unknown server, network and parse prose is never displayed. |
| `i18n/settings-errors.ts` | Adds the exact existing `Template not found` contract to the error allowlist. No REST/MCP output is translated. |

Added 70 document keys and one shared error key in each locale, reaching 1,904
matching keys per locale. Existing English presentation is preserved. Save/delete
now check HTTP failures before reporting success; save failures retain the form
and release the saving state, and delete failures retain confirmation for retry.
List failures report a localized toast and finish loading. Preview/PDF error
envelopes and unsupported media continue to reject before display/download.

## Explicit exceptions

| Data/literal | Boundary |
|---|---|
| Template name, notes, bank/payment instructions, header/footer HTML, logo URL and accent color | Stored caller content remains verbatim. Form fields and list names use React escaping. No catalog text is saved automatically or used to rewrite a template. |
| `invoice`, `quote`, `receipt`, `payslip`, `purchase_order` | Stored type IDs remain unchanged. Display labels translate; unknown future IDs retain their original spelling, including prototype-like strings without inherited-property lookup. Type remains hidden on edit. |
| All 18 `{{variable}}` tokens | Technical placeholders retain exact ASCII spelling and braces. The sample payment instruction interpolates the literal `{{invoiceNumber}}` token into translated surrounding prose. |
| HTML sample tags, attributes, colors and CSS | Reviewed code assembles the unchanged sample markup around translated sample text. Catalogs contain plain text, never HTML. Placeholders remain textarea attributes; they are not parsed/rendered as HTML. |
| IBAN/SWIFT samples, Commerzbank and logo URL example | Technical sample identities retain spelling; bank-label and surrounding prose translate. Native financial/compliance acceptance is not implied by the preserved fee or bank examples. |
| Server-generated preview HTML/PDF and sample document copy | Preview remains an iframe receiving the unchanged server response. Server document rendering, PDF contents and iframe security/layout behavior are outside this settings-copy slice (LOC-008/009 and RTL/document qualification). |
| Endpoints, organization storage/header keys, JSON payload fields/null normalization and `sample-invoice.pdf` | Machine contracts remain unchanged, verified against pre-extraction AST fixtures. No new user operation or REST/schema/domain change. |
| Native browser controls, numeric data, symbols and blank values | Existing behavior remains unchanged. No money/date conversion or provider availability claim. |

The existing `preview_document_template` MCP tool in
`lib/mcp/tools/document-rendering.ts` retains shared HTML/PDF rendering. Inspection
found no existing document-template CRUD MCP registration; this pre-existing
coverage gap is handed to LOC-017 integration rather than represented as full
MCP parity. Localization introduces no new operation or changes to REST/MCP input.

## Verification and limits

`tests/settings-document-catalogs.test.ts` renders the actual production list,
form and iframe in both locales with the production presentation provider. It
checks empty/default/unknown-type states, fields/variables/examples, saved-content
escaping, type immutability, switches, saving/blank-name disabling, safe error
mapping, untouched successful JSON/HTML/PDF streams, unsupported PDF rejection,
bounded JSX extraction and pre-extraction request/payload fixtures.

These are rendering, request-boundary and source-contract assertions, not browser
click, live CRUD persistence, PDF visual or physical printing acceptance. No
database access was required. See [attempt](../evidence/LOC-019-attempt-1.md) and
[self-review](../evidence/LOC-019-review-1.md) for actual final checks and limits.
