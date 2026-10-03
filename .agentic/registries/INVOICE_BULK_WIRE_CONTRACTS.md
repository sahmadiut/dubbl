# Invoice bulk wire contracts (MON-045)

2026-10-03, Asia/Tehran. Bounded safe-number coexistence adoption, not a full-int64,
settlement, provider or production qualification. Parent MON-019 retains combined
receivable acceptance. No schema, currency rollout flag or deployment change.

## Boundary inventory

| REST operation | MCP operation | Input and output |
|---|---|---|
| POST /api/v1/bulk/invoices/preview | preview_invoice_import | `{source?, rows}`; `{preview, validCount, totalCount}` |
| POST /api/v1/bulk/invoices/import | import_invoices | `{fileName, source?, rows}`; 201 `{job}` |
| POST /api/v1/bulk/invoices/send | bulk_mark_invoices_sent | `{ids}` (1..100); `{updated, ids}` |
| POST /api/v1/bulk/invoices/mark-paid | bulk_mark_invoices_paid | `{ids}` (1..100); `{updated}` |
| POST /api/v1/invoices/bulk, mark-as-sent | bulk_mark_invoices_sent (100-ID calls) | `{action, invoiceIds}` (1..200); `{action, results, summary}` |
| POST /api/v1/invoices/bulk, send-reminder | bulk_send_invoice_reminders | `{action, invoiceIds}` / `{invoiceIds}` (1..200); `{action, results, summary}` |

All IDs are UUIDs; batch actions deduplicate in first-seen order. Foreign, missing
and soft-deleted action targets are ignored/skipped without exposing data. No bulk
edit/delete route exists in this slice; single-document CRUD remains MON-039.
Import job listing remains the existing org-scoped REST/MCP import-history surface.
MCP invoice tools moved from bulk.ts to invoice-bulk.ts and are registered in
index.ts. All use AuthContext, wrapTool and direct Drizzle services, no self-HTTP.

## Import formats, money and ranges

Both transports use the same price units. Numeric `unitPrice` is **decimal major
units**, not cents; `unitPriceExact` is canonical decimal-major text and
`unitPriceMinor` is canonical integer currency-minor text. USD 12.50 / "12.50" /
"1250" agree. Numeric/exact major aliases must have equal decimal ratios; minor
aliases must agree with the rounded stored unit price. Minor-only inputs cannot
recover a sub-minor major price fraction. Omitted prices remain zero, without
inventory or price-list lookup. Imports default to USD, preserving the old import
contract, independently of contact/org currency. Explicit JPY/IRR uses scale 0,
USD scale 2, KWD scale 3; source/locale/magnitude never selects units or currency.
This does not enable functional IRR.

Nested rows require contactId, issueDate, dueDate and 1..1000 lines. Reference is
optional. Lines accept description, quantity (default 1), the three price fields,
discountPercent (0..10000 basis points, default 0), accountId, taxRateId,
costCenterId, projectId, inventoryItemId and warehouseId. UUID references are
nullable/optional and must be available in the organization. Unknown document/
line fields, caller totals/status/FX/price lists are rejected, not silently used.

Flat mapped CSV rows require contactId, issueDate, dueDate and lineDescription.
Optional fields: invoiceNumber (external grouping key, never the generated number),
reference, currencyCode, lineQuantity, lineUnitPrice, lineUnitPriceExact,
lineUnitPriceMinor, lineAccountId and lineTaxRateId. Numeric lineUnitPrice is major
units; a string is a strict decimal major value. LineUnitPriceExact/Minor carry
the same aliases as nested lines. CSV quantity strings allow at most two fractional
digits; numeric quantities retain the nested numeric policy. Blank/malformed money,
symbols, grouping separators, exponents and trailing junk in strings reject;
omitting an optional column permits its default. No contact-name/account-code or
lineAmount inference is performed; CSV must supply the existing Dubbl UUIDs and
prices. The UI exposes these fields and displays failed HTTP requests as errors.
The existing simple CSV splitter is not a quoted/multiline CSV parser; DATA-001
retains broader file/import qualification.

Flat lines group by a nonempty invoiceNumber, otherwise the tuple
contactId/issueDate/dueDate/reference. Group headers (including currency) must
agree. Each nested row is independent. Inputs allow 1..1000 rows; each grouped
document allows at most 1000 lines. Job totalRows/processedRows/errorRows count
**documents**, not physical CSV lines; error row indexes identify grouped documents.
An external grouping number is never an idempotency key or a requested DB number.

Source is custom (default), quickbooks, xero, freshbooks or wave. Existing source
date preprocessing is retained, followed by Gregorian YYYY-MM-DD validation;
source does not alter price units. Preview and import normalize the same formats.
MCP exposes described structured nested/flat input schemas; native SDK validation
can reject invalid shapes before reaching the service.

Price/quantity ratios, gross, discounts, exclusive tax and sums use bigint.
Import retains its original extended-major-price rounding before storing the
rounded unit price, distinct from REST single-invoice create's price-first policy.
Signed ties round toward positive infinity. Quantity storage remains int32
hundredths (-2147483648..2147483647); tax is nonnegative int32 basis points.
Exact major strings allow 20 whole/18 fractional ASCII digits. Minor strings
validate signed int64 syntax but every price/component/product/header sum must
fit +/-9007199254740991 for the current ORM/domain bridge. Individually unsafe
values reject even if discounts or cancellation would hide them. Negative/zero
draft amounts remain importable; sending has the existing positive/nonnegative
recognition requirements.

Preview preserves `row`, `data`, `valid`, `errors` and counts. Valid documents add
currencyCode, numeric subtotal/taxTotal/total and canonical subtotalMinor/
taxTotalMinor/totalMinor. `data` contains normalized input prices in their input
units, not stored line minor prices. Nested invalid rows are reported invalid;
malformed flat/group headers reject the request. Unsupported raw Numbers reject
before echo rather than returning rounded JSON. Preview checks references/totals,
but does not promise import authorization, unlocked periods or plan capacity.
Job responses contain counts/errors, no monetary fields. Created invoices are
read through MON-038's header/line Minor aliases. Counts and quantities never
become monetary strings. JSON helpers and wrapTool guard nested response values.

## Mutation, authorization and repeat policy

Import requires manage:invoices. All rows/aliases/gross/header sums preflight
before job creation; scoped valid tax rates and tax-inclusive sums also preflight
before jobs. Unsafe saved tax/ORM values reject the request. Foreign/deleted/
inactive reference, issue-date lock and plan errors are per-document failures.
References, dates, totals and limits are rechecked on each write. Organization
locks and shared invoice numbering serialize number allocation. Number, draft
header and all lines commit together or roll back together. A failed document
does not leave a header or consume its sequence number; other qualified documents
still commit. A mixed-success job is completed with errorRows; all failures produce
failed. Existing best-effort audit records job summaries and successful creates.
An infrastructure failure after job creation may leave processing history and
already committed documents; no durable resume/recovery or request key exists.
Reimporting creates new invoices. Inspect the job/documents before manual retry.

Both bulk send routes and MCP require approve:invoices and call the MON-040
recognition transaction. The former status-only path now posts revenue/tax/COGS,
stock effects, snapshots and saved historical exact FX. No email is sent. All
selected owned documents undergo money/date/reference preflight; eligible drafts
are sent in one accounting transaction. A missing account, period lock, FX failure,
invalid document or database failure rolls back **all** eligible sends, including
numbers/journals/stock/status/snapshots. Ignored IDs retain the normal envelope;
invalid batches return a top-level error rather than partial sent results.
Concurrent/repeated successful calls update each draft once; later calls return
zero/skip. Audit follows commit under the existing best-effort policy.

Bulk mark-paid deliberately preserves the documented **status annotation** for
externally settled invoices. It is not payment accounting: no payment, allocation,
bank balance, carrying FX or settlement journal is created. Requires manage:invoices.
Only sent/partial/overdue documents qualify; draft/pending-approval/void/written-off/
paid documents are ignored. All selected saved money/references preflight;
eligible positive header/line/balance sums must agree and issue dates must be
unlocked. Organization/invoice locks and one transaction guard the entire update.
Sets amountPaid=total, amountDue=0, paid/paidAt/updatedAt. Repetition updates zero.
Audit explicitly records annotationOnly. **MON-021 must coordinate this existing
annotation with real payment/settlement/reversal/bank/report contracts**; these
fixtures do not qualify its ledger/report effect as a financial settlement.

Reminders require manage:recurring and verified org SMTP configuration. Preflight
all selected money/date/tenant references before any email, reminder log or dunning
mutation. Only sent/partial/overdue documents with amountDue>0 and a customer email
qualify. Display uses exact minor-to-major strings and bigint Intl parts, preserving
every unit even at the safe limit. External delivery is best effort per item;
successful log and dunning increment share a DB transaction after email. Delivery
can succeed before persistence fails; no outbox or delivery idempotency exists.
Failure logging itself can fail and abort the remaining batch. Repeating can send
another reminder. Snapshot preflight does not lock financial/configuration writers
across provider calls; durable delivery and external races remain qualification work.

Malformed JSON/schema/aliases: HTTP 400 / MCP validation error; safe-range/unsafe
history: 422 LEGACY_NUMERIC_RANGE; missing FX/locked periods: 422; denied permission:
403; invalid API key: 401. Per-document import business failures use the 201 job
envelope; infrastructure/action errors use shared REST/MCP error handling.

## Verification and limits

See MON-045 attempt/review evidence, tests/invoice-bulk-wire.test.ts and actual
REST/SDK migrated PostgreSQL worker. Fixtures cover legacy/exact/dual clients,
four currencies, grouping, scoped references/roles/API keys, unsafe input/history,
partial jobs, sequence/header/line rollback, batch posting rollback, repeat and
concurrent send, locked dates, missing/saved FX, annotation balances and failed
reminder delivery without provider traffic. No browser/session/OAuth, successful
SMTP/provider, financial-report/full-int64 or production/IRR qualification is
claimed. External payment/lock/configuration/stock writers remain their assigned
gates; this task does not modify them or immutable completed-task evidence.
