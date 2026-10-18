# Tax rate and navigation catalogs

LOC-061 covers two complete source files:

- `app/(dashboard)/tax/page.tsx`: title/description/document title, summary labels,
  applicability badges, default badge, quick country-profile setup, country
  interpolation, setup result counts, all seven treatment labels/help messages,
  compound-part editor, create/edit sheets, busy states and operation errors.
- `app/(dashboard)/tax/layout.tsx`: base and country-specific filing tab labels.

`TaxRates` (64) and `TaxNavigation` (7) add 71 paired messages, bringing each
catalog to 3,033 keys. Persian financial wording is provisional pending native
review. Key parity is not linguistic, RTL or statutory compliance approval.

## Explicit exceptions and preserved contracts

Tax rates and component rates remain integer **basis points**, not cents or
monetary minor units: 1,250 means 12.50%, recovery 5,000 means 50%. Existing
percent parsing, rounding, clamping, input step/min/max and formatting stay
unchanged. Numeric placeholders `0.00`, `10.00`, `100` and the `%` symbol are
technical syntax; dedicated localized number/input adapters remain separate.
Summary counts and navigation badges retain their existing numeric rendering;
setup result messages now use ICU plural/interpolation instead of English suffix
concatenation. No money/FX algorithm, persisted value, schema or rollout flag
changes here.

Caller/service tax names, component names and country names remain data and are
React-escaped, never translation keys. Unknown applicability values remain
escaped verbatim; known sales/purchase/both values receive translated labels.
`standard`, `partial_block`, `blocked`, `reverse_charge`, `exempt`, `no_vat`,
`sales_tax_us`, sales/purchase/both, country codes, EU country membership and
filing eligibility remain canonical. BAS, Schedule C, GST, PST, VAT and ledger
identifiers are retained as statutory/technical names within translated prose;
this extraction does not requalify their legal meaning or applicability.

Request paths, methods, JSON field names, organization headers, account/resource
IDs, null handling, blank component filtering, defaults and retry/reset behavior
stay unchanged. Create/edit/setup failures use complete translated messages.
Tax list reads now reject unsuccessful HTTP responses and malformed list
envelopes and report a translated failure, retaining previously loaded rows.
Edit and remove-part icon buttons now have localized accessible names. Layout,
CSS, required fields and navigation URLs remain intact. No build, dev server,
application database or live provider work is needed for this UI extraction.

## Existing MCP coverage and remaining scope

`lib/mcp/tools/tax-rates.ts` supplies list/get/create/update/delete operations;
`lib/mcp/tools/tax-profiles.ts` supplies list/apply-country-profile operations.
These use direct DB services with AuthContext, wrapTool and strict, described
basis-point schemas shared with REST. Their input/output contracts are unchanged.
No user operation or REST route was added or changed by this task.

LOC-062 owns currencies; LOC-063 owns period pages and settlement preview;
LOC-064 owns VAT filing; LOC-065 owns BAS/sales-tax/Schedule C page bodies.
LOC-028/007/002 retain independent combined acceptance. Native Persian, full RTL,
localized number/date/input adapters, browser layout and statutory/production
qualification remain separate. Stripe is unchanged under DEC-008.

## Verification boundaries

`tests/tax-rate-catalogs.test.ts` runs real production templates with React,
next-intl and PresentationProvider in both locales. Hooks/navigation are
controlled and sheet/select portals are inline for SSR inspection. Actual
shared fields, account picker, brand loader and tab layout are exercised. This
is not a mounted-browser or visual-layout qualification.

Tests cover loading/empty/populated lists, all applicability labels, escaped
caller data, create/edit and setup busy states, all seven treatment options,
recovery visibility, compound inputs/accounts, every current EU/GB/AU/US filing
eligibility branch, canonical links and badges. Actual production callback
bodies run with controlled IO to check payloads, integer basis points, recovery
clamping/hidden defaults, account nulls, country defaults, organization scope,
success resets, retry preservation, HTTP/network/parser/envelope failures and
busy cleanup. A source audit checks extraction and Persian script. No live
REST/MCP/SQL integration or hosted CI result is claimed for this UI-only change.
