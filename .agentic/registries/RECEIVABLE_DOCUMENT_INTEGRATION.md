# Receivable document integration (MON-019)

2026-10-08, Asia/Tehran. Combined acceptance for MON-038 through MON-045 under
ADR-006 safe-number coexistence. These inventories document every adopted REST
route/MCP tool, inputs, outputs, aliases, units, ranges, permissions, defaults,
errors and atomicity. Historical child evidence remains unchanged.

| Slice | Complete contract inventory | Parent integration |
|---|---|---|
| Invoice reads/summary | [Reads](INVOICE_READ_WIRE_CONTRACTS.md) | Generated/converted/credited/settled invoices read through both transports; summary parity |
| Invoice CRUD | [Writes](INVOICE_WRITE_WIRE_CONTRACTS.md) | Conflicting/unsafe aliases, explicit minor units in USD/IRR/JPY/KWD, safe maximum/unsafe history |
| Invoice lifecycle | [Lifecycle](INVOICE_LIFECYCLE_WIRE_CONTRACTS.md) | Converted invoice posting, settled invoice void rejection, bulk posting |
| Quotes | [Quotes](QUOTE_WIRE_CONTRACTS.md) | REST legacy price/send, MCP accept, REST partial and MCP remaining conversion |
| Credit notes/customer credits | [Credits](CREDIT_WIRE_CONTRACTS.md) | REST note create, MCP posting, REST offset, MCP reversal; customer cash/deposit application to converted invoice |
| Sales receipts | [Receipts](SALES_RECEIPT_WIRE_CONTRACTS.md) | REST legacy price, MCP cash posting, REST saved reversal |
| Recurring invoices | [Recurring](RECURRING_INVOICE_WIRE_CONTRACTS.md) | REST template, actual generator twice/one occurrence, bulk posting and reads |
| Invoice bulk/import | [Bulk](INVOICE_BULK_WIRE_CONTRACTS.md) | REST posting of generated/converted drafts, MCP repeat returns zero, unsafe import rejects before jobs |

## Units and compatibility

Money output retains safe integer currency-minor Numbers and canonical matching
`*Minor` strings. Existing integer 1250 stays 1250 in every currency. Monetary
operands/results must fit +/-9007199254740991 while numeric coexistence is
mandatory; positive applications require at least 1. Canonical int64 syntax does
not activate full-int64 processing. Unsafe persisted money and out-of-safe-range
int64 inputs fail with 422 `LEGACY_NUMERIC_RANGE` before committed mutation.

| Workflow | REST numeric unitPrice | MCP numeric unitPrice |
|---|---|---|
| Invoice create/update | Currency major units | Currency major units |
| Quote/credit-note create/update | Currency major units | Currency minor units |
| Receipts, recurring invoices, invoice imports | Currency major units | Currency major units |

`unitPriceExact` is decimal-major text; `unitPriceMinor` is integer-minor text.
Aliases must agree under the documented rounding policy. REST invoice create and
quote creation retain price-first rounding; invoice MCP/update, credit, receipt,
recurring and import retain extended-price rounding. Currency scales affect major
conversion only. Defaults, price lookup, tax and envelope differences remain
documented per slice. Stored quantities are hundredths; percentages are basis
points. Date-only values are Gregorian; saved FX/reversal retains per-slice bounds.

## Strict registered inputs and protections

The 59 adopted tools enumerated in the parent worker use `server.registerTool`
with full `z.strictObject` schemas, including zero-input reads, CRUD, lifecycle,
quotes, credits, receipts, invoice-template operations and bulk tools. SDK
validation rejects unknown top-level controls before callbacks/mutation and
advertises `additionalProperties: false`. Nested strict schemas are retained.
Raw shapes previously stripped unknown fields. Undocumented money-mode/FX/header
controls must not be silently accepted as an exact-only request. SDK schema errors
may be plain text; service errors retain `wrapTool`'s classified envelope.

Shared recurring document tools also serve bills/expenses: declared fields,
defaults and callbacks are preserved. Invoice payment/signature/public/PDF/email
and payable-specific recurring tools remain separately owned. No endpoint, schema,
representation negotiation or deprecation date is introduced.

API-key organization scope wins over conflicting headers. Parent fixtures cover
custom-role denial, foreign IDs/references, alias/range/history rejection and
snapshots of documents, lines, journals, payments/allocations, schedules, numbering,
jobs and audits. Eight child suites retain detailed period-lock, corruption,
FX/stock, concurrency, rollback, approval, import/reminder and operation coverage.

## Verification and qualification limits

`tests/integration/receivable-document-integration.test.ts`/worker invokes actual
authenticated REST handlers, full registered MCP SDK clients and the background
generator on committed migrations in disposable PostgreSQL. Unknown controls on
all 59 tools reject with unchanged data. Cross-workflow aliases agree; each journal
balances. Independent final account assertions check AR 1875, cash 625, deposits 0
and revenue credit 2500 minor units after note/receipt reversal and cash settlement.

Bulk mark-paid remains an external-settlement status annotation without a cash
payment/settlement journal; MON-021 retains full settlement/reversal/annotation
coordination. Full-int64/domain, external-writer/configuration races, inventory,
durable delivery, CSV parser breadth, browser/session/OAuth, localization/PDF,
high-volume and independent accounting/migration/IRR/production gates remain open.
Contract completion does not change flags, deploy or claim those qualifications.
