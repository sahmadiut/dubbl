# Generic import and export contracts

MON-033, 2026-10-10 Asia/Tehran. Implementing-assistant self-review.
ADR-006 compatibility applies; no schema, stored-unit rescale, migration,
production IRR enablement, deployment or full-int64 business cutover.

## Operations and envelopes

All REST paths start at `/api/v1`. Direct Drizzle services use server AuthContext,
never HTTP self-calls. API-key identity determines organization despite conflicting
organization headers. Every MCP input is a full strict SDK schema; unknown controls
cannot disappear through raw-shape registration. Row objects are strict too.

| Boundary | MCP operation | Result and permission |
|---|---|---|
| POST bulk/accounts/import, bulk/contacts/import, bulk/products/import | import_csv_data (CSV text adapter) | REST 201 `{job}`; MCP `{jobId,totalRows,processedRows,errorRows,status,errors}`; manage:accounts, manage:contacts, manage:inventory respectively |
| POST bulk/accounts/preview, bulk/contacts/preview, bulk/products/preview | preview_csv_import_rows (mapped rows) | `{preview,validCount,totalCount}`; same manage permission; no writes |
| GET bulk/import-jobs | list_import_jobs | REST `{jobs}`; MCP `{jobs,total}` where total is returned page count; view:data |
| Bundled source mappings used by import wizard | get_import_template | `{source,entityType,columns:[{field,aliases}]}`; view:data |
| GET export/accounts, contacts, products, invoices, bills, entries, bank-transactions | export_csv_data | CSV attachment; MCP `{entityType,csv,rowCount}`; view:data |
| GET export/all | export_all_csv_data | ZIP attachment; MCP `{filename,encoding:"base64",data,fileCount:7}`; view:data |
| POST bulk/entries/preview and import | preview_journal_entries, import_journal_entries | Existing MON-036 domain contracts; strict MCP registration and manage:entries preserved; posting additionally requires post:entries |
| Shared wizard / dashboard CSV / saved report CSV and scheduled XLSX forwarding | Existing owning domain tools and report schedule tools | Cell values forwarded in declared units, with unsafe numeric carriers rejected; XLSX money and Minor columns use text |

The generic CSV importer supports accounts, contacts and products. Other financial
imports retain the journal, invoice, bill and bank services, organization/reference
guards, document atomicity, posting permissions and period locks from MON-018..027.
Generic templates advertise their existing domain aliases without promising a new
generic financial CSV writer. DATA-001/002 retain broader product extensions.

## Inputs, units and supported ranges

- Sources: quickbooks, xero, freshbooks, wave, custom. Canonical field names and
  exact domain aliases are available for every source; source aliases map to
  those names. Unknown sources, multiple headers mapping to one field, unknown
  mapped fields and unsupported row types fail. Wizard mappings may deliberately
  skip source columns, but may not map two columns to one target.
- REST imports require fileName (1..255 characters), optional source (custom
  default), and 1..1000 mapped rows. Preview uses the same body without fileName.
  MCP CSV text is bounded to 5 MB UTF-8 and 1000 data rows. Header/data widths
  must agree; empty/duplicate headers, malformed/unclosed quotes and trailing
  quoted-field text fail. BOM, CR/LF record separators, quoted commas/newlines
  and doubled quotes are supported. Cell edges are trimmed; CRLF is normalized
  to LF. Money cells remain text throughout parsing and mapping.
- Accounts: required code/name/type; optional subType/description/isActive.
  type is asset/liability/equity/revenue/expense after known source normalization;
  unknown values no longer silently become expense. isActive is Boolean or
  literal true/false CSV text, defaulting to the existing DB default.
- Contacts: required name, optional email/phone/taxNumber and billing address
  fields; type customer/supplier/both, default customer. Known vendor aliases
  normalize to supplier. Unknown nonblank types fail. Text is capped at 10000
  characters; name/code must remain nonempty after trimming.
- Generic products: required name; optional sku/description; unitPrice/costPrice
  remain **fixed two-decimal major prices** (12.50 = 1250 stored units), independent
  of locale, source and currency metadata. Optional unitPriceMinor/costPriceMinor
  are canonical nonnegative signed-int64 strings. Dual fields must agree exactly.
  The current business/ORM bound is 0..9007199254740991; out-of-safe-range exact
  inputs receive 422 LEGACY_NUMERIC_RANGE before jobs. Omitted prices default zero.
- Valid decimal strings preserve US grouping, grouped European decimal notation,
  leading currency symbols and the transformer's signed/parenthesized forms.
  Product prices prohibit negative results. No exponent, suffix, malformed
  grouping, localized digits or more than two fractional digits is rounded or
  guessed. Decimal Number inputs above 2^45-1 must instead use decimal strings or
  Minor aliases because JSON decoding can already lose hundredths. Parse and
  conversion use bigint arithmetic; no parseFloat or Number multiplication.
- Product quantityOnHand is 0..2147483647 whole units; omission means zero.
  Positive stock requires positive purchase price, with a safe exact opening
  value checked before jobs. The existing inventory domain creation path writes
  movement, valuation and balanced opening GL, resolving posting references and
  period locks. Nonblank source product type metadata is unsupported because it
  has no corresponding inventory field; map that source column to Skip. Optional
  currencyCode must match the locked organization's defaultCurrency, checked
  before job insertion. No unit conversion is inferred from that code.
- Import status retains completed with successes and possible errors, failed
  when every row fails. Wire/unsupported-input errors reject the whole batch
  before job insertion; domain failures such as duplicate codes or unavailable
  stock-posting references are reported per row through transactional savepoints.
  Successes, job finalization and import audit commit together; audit failures
  roll back the job and its rows. Generic imports create new records and do not
  promise deduplication/idempotent replay; replayed unique codes are row errors.
- Job limit is 1..100 (default 20), offset 0..1000000 (default 0). REST numeric
  query strings must be canonical integers. Results sort createdAt/id descending.

## Export projections

Individual CSV and ZIP files use the same projections. Each export is a read-only
repeatable-read transaction; the ZIP's seven files share one snapshot. Live parent
records are scoped to AuthContext and soft-deleted parents are excluded. Cross-org
document contacts/line accounts or journal line accounts fail visibly (422),
instead of exposing foreign labels. Bank transactions require live owned bank
accounts. No ledger, audit or import job write occurs on export.

| Entity | Legacy money and nonmoney | Added exact columns |
|---|---|---|
| accounts/contacts | Existing text, active flag and billing address columns | No monetary columns in this projection |
| products | unitPrice/costPrice fixed-two decimal strings; quantityOnHand whole units | unitPriceMinor/costPriceMinor, currencyCode from organization |
| invoices/bills | lineUnitPrice/lineAmount fixed-two decimal strings; lineQty is hundredths of physical units | lineUnitPriceMinor/lineAmountMinor, saved document currencyCode |
| entries | debit/credit fixed-two decimal strings; zero sides remain blank; signed nonzero values retained | debitAmountMinor/creditAmountMinor, saved line currencyCode; accountCode retains old MCP alias alongside lineAccountCode |
| bank-transactions | signed amount fixed-two decimal string, reference/account name/reconciled flag | amountMinor, saved transaction currencyCode or owning account fallback |

Legacy decimal columns are compatibility text in the original fixed-two units,
**not currency-scaled display promises**. For example, stored IRR 1250 still exports
12.50 plus Minor 1250 and IRR metadata. Consumers should use the Minor column and
saved currency for new workflows; no historical value is repaired/rescaled.
Invoice/bill lineAccountCode retains its existing account UUID content. Documents
without lines retain a total fallback row and empty line unit-price/quantity cells.
These generic document exports are not promised as directly reimportable financial
documents; use domain contracts to resolve required owned IDs and document fields.

REST startDate/endDate and MCP dateFrom/dateTo are strict inclusive Gregorian
YYYY-MM-DD filters for invoices/bills/entries/bank-transactions; reversed periods,
duplicate REST keys and unknown controls fail REST 400 or MCP validation errors.
Date filters on master exports
are unsupported; the settings UI sends them only for transactional selections.
ZIP startDate/endDate filter only transactional files. Ordering is stable by parent
date/ID, bank account/date/ID or master ID/code, and line ID. Row counts count records,
including quoted multiline descriptions once; empty exports count zero.

Monetary values read through the current ORM must be signed safe integers; unsafe
stored int64 returns 422 LEGACY_NUMERIC_RANGE, before any attachment is returned.
Fixed-two text formatting uses bigint quotient/remainder, including the safe endpoints
90071992547409.91/-90071992547409.91. Pure forwarding can retain full-int64 bigint
text, but that is not an ORM/domain full-int64 claim. Generic scalar CSV/spreadsheet
forwarding rejects nonfinite/unsafe Numbers and object cells. Scheduled XLSX money
and Minor fields stay text to avoid Excel's numeric precision limit; existing
currency-scaled financial statement XLSX retains its round-trip/15-digit guard.
ZIP local/central headers contain real CRC32 checksums and UTF-8 name flags.

## Verification pointers and limits

`tests/generic-import-export.test.ts` covers decimal edge lexemes, exact alias and
opening-value guards, quoted CSV/mapping ambiguity, scalar CSV/XLSX forwarding and
an independent Python ZIP reader. `tests/integration/generic-import-export.test.ts`
invokes the real authenticated REST handlers and full MCP registry on a migrated
disposable database: legacy/exact writers, stock GL, permissions/tenant controls,
per-row savepoints/replay, final audit rollback, every CSV/ZIP/filter/job boundary,
signed safe endpoints, saved foreign references and unsafe persisted int64.
Inventory-master, journal-lifecycle, custom-report and report-schedule suites retain
the deeper domain/import and real XLSX serialization checks. Independent accounting,
full-int64 business support, migration, localization, scale cutover and release
qualification remain with their assigned tasks. No screenshot gate applies (DEC-005).
