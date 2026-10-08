# MON-121 custom and saved report wire contracts

Verified 2026-10-08 in D:/Projects/dubbl. Implementation: `lib/reports/custom.ts`,
`custom-wire.ts`, four REST files and registered `lib/mcp/tools/custom-reports.ts`.
Evidence: `../evidence/MON-121-attempt-1.md`. Self-review only.

## Boundary map

| REST boundary | MCP tool | Inputs and output |
|---|---|---|
| POST /api/v1/reports/run | run_custom_report | Config below; `{data,total}` |
| GET /api/v1/reports/saved | list_saved_reports | No inputs; `{reports}` ordered by updatedAt/id |
| POST /api/v1/reports/saved | create_saved_report | name, optional nullable description, config; 201 `{report}` |
| GET /api/v1/reports/saved/:id | get_saved_report | Live owned UUID; `{report}` |
| PATCH /api/v1/reports/saved/:id | update_saved_report | UUID and at least one name/description/config field; `{report}` |
| DELETE /api/v1/reports/saved/:id | delete_saved_report | Live owned UUID; `{success:true}`, soft deletion and existing audit behavior |
| GET /api/v1/reports/saved/:id/export | export_saved_report | Live owned UUID; CSV attachment, or MCP base64 `{filename,mimeType,encoding,content}` |

All services require `view:data`. Payroll execution/export additionally requires
`view:payroll-reports`, preventing custom reports from bypassing payroll access.
AuthContext fixes the tenant; spoofed organization headers cannot override API-key
ownership. Every root is scoped before projection, including payroll run/employee,
bank account/import and invoice contact. Deleted roots/related labels are excluded.
Cross-org invoice contacts become `-`; invalid payroll and bank import joins are
excluded. Foreign/missing/deleted saved report IDs return 404 without reading their
configs. Invalid auth returns 401; permission failures return 403.

## Configuration and persistence

Strict object: dataSource, columns, optional filters/groupBy/dateRange/chartType.
Supported sources are invoices, contacts, inventory, transactions, expenses and
payroll. Columns are unique, allowlisted and number 1-40; arbitrary property names
(including constructor and __proto__) cannot become projections. Filters default
to [], number 0-50, and combine with AND. Each strict filter has field/operator/value;
operators are equals/contains/gt/lt/gte/lte. Contains is case-insensitive text only.
Ordered comparisons require a declared monetary/count/quantity field. Null values
do not match filters. Zero, false and empty text retain their literal values.

Money filters, including exact Minor aliases, take canonical signed ASCII integer
strings in unchanged stored units, within +/-9007199254740991. No whitespace,
leading zeros, negative zero, plus signs, decimal fractions, exponents, localized
digits or implicit scale conversion. Ordered money comparison uses bigint. Ordered
count/quantity comparisons accept safe finite decimal literals in their existing
units. Other equality/text values are literal strings, up to 4096 characters;
they are not JSON-decoded or converted to money/FX. Unknown config fields reject.

groupBy defaults to [] and must remain empty: the previous implementations did
not implement grouping. Nonempty requests now fail explicitly instead of silently
returning ungrouped rows. chartType table/bar/line/pie is a preserved presentation
hint, with no grouping or totals. Configs have no general opaque numeric/object
payload: arbitrary or unsafe JSON fields cannot be persisted as report controls.

dateRange uses inclusive real Gregorian YYYY-MM-DD, years 0001-9999, from <= to.
It filters invoice issueDate, bank date, expense submittedAt (UTC date) or payroll
payPeriodStart. Null submittedAt excludes an expense when a range is supplied.
Contacts/inventory do not support ranges. Run and export use identical configs,
filtering, source projections and column ordering. Expenses/payroll previously
had CSV-only dispatch; they now use the same runner for both transports.

Names are nonempty strings up to 200 characters; descriptions allow null or
up to 4096 characters. PATCH replaces the entire supplied config. Configuration
and complete returned row are validated before transactional commit. PATCH/delete
lock and validate existing rows first. All saved reads/export revalidate persisted
configs and SQL timestamp finiteness. Unsupported stored config/timestamp returns
422 without rewriting it; explicit remediation is separate work. Metadata and
ownership are never accepted as client fields. No schema migration is required.

## Projections, units and exact output

| Source | Allowlisted ordinary columns | Money columns | Currency and date policy |
|---|---|---|---|
| invoices | id, invoiceNumber, contactName, status, issueDate, dueDate, currencyCode | subtotal, taxTotal, total, amountPaid, amountDue | Saved invoice currency; issueDate |
| contacts | id, name, email, type, phone, paymentTermsDays, currencyCode | creditLimit (nullable) | Saved contact currency; no range |
| inventory | id, code, name, category, quantityOnHand, reorderPoint, isActive, currencyCode | purchasePrice, salePrice | Organization default currency; no range |
| transactions | id, date, description, status, payee, currencyCode | amount | Owned bank currency; explicit transaction currency must agree; date |
| expenses | id, title, status, currencyCode, submittedAt, approvedAt | totalAmount | Saved expense currency; submittedAt UTC |
| payroll | id, employeeName, payPeriodStart, payPeriodEnd, type, currencyCode | grossAmount, taxAmount, deductions, netAmount | Saved payroll item currency, never guessed from organization/run; payPeriodStart |

Each money field can be selected/filtered as `<field>Minor`. Selecting its numeric
field appends the matching Minor sibling unless explicitly requested already.
Selecting only Minor returns only the exact string. Null creditLimit yields null
creditLimitMinor. Numeric legacy fields retain safe integers, and Minor strings
retain the very same integer units. No division by 100, implicit FX, guessed IRR
rescaling, summed mixed currencies or generated monetary totals. Currency codes
must be supported; physical inventory units and paymentTermsDays remain ordinary
numbers with no monetary aliases. Timestamp outputs use ISO UTC strings.

The transitional ORM money decoder rejects unsafe stored int64 values before
projection/filtering; both numeric and exact-only clients share the supported
safe range. Failures are 422 `LEGACY_NUMERIC_RANGE`, rather than rounded values,
JSON bigint crashes or an advertised full-int64 path. All documented source
fields are guarded even if later filters would exclude the row. Invalid source
dates/timestamps/currencies likewise reject. No output alias repairs historical
unsafe numbers. Supported USD/IRR/JPY/KWD examples preserve integer 1250/-1250.

CSV exports selected columns plus additive aliases in the same order as the
runner. Empty output retains headers. Money is literal integer units, including
exact decimal digit strings, without spreadsheet numeric-cell conversion.
Null becomes an empty CSV cell; commas/quotes/CR/LF are quoted and quotes doubled.
Text is preserved literally. CSV does not define spreadsheet formula evaluation
or display formatting. Filenames sanitize report names to ASCII underscores.

## Verification and remaining ownership

`tests/custom-report-wire.test.ts` covers canonical money filters, allowlists,
range/group controls and CSV escaping. The disposable migrated PostgreSQL fixture
in `tests/integration/custom-reports*.ts` invokes real REST routes, API keys and
SDK tools (including full registration), both invoice price writer adapters,
all sources, CRUD, filters/dates, exports, tenant/role failures, stored corruption,
timestamps, safe signed endpoints and unsafe int64 rejection. Failed operations
and reads compare financial/config/audit snapshots for no mutation.

MON-122 owns schedules/delivery and MON-105 retains combined integration;
MON-029 and full-range/history/production qualification remain separate. No
application migration, provider call, deployment or IRR enablement is claimed.
