# Bill bulk contracts (MON-053)

2026-10-04, Asia/Tehran. Safe-number coexistence adoption. MON-020 retains combined
payable acceptance; settlement is MON-021 and export is MON-033. No schema or rollout change.

## Boundary inventory

| REST POST | MCP tool | Input | Successful output |
|---|---|---|---|
| /api/v1/bulk/bills/preview | preview_bill_import | {source?, rows} | {preview, validCount, totalCount} |
| /api/v1/bulk/bills/import | import_bills | {fileName, source?, rows} | 201 {job} |

Both transports share bill-bulk and bill-bulk-wire. REST uses getAuthContext;
conflicting organization headers cannot redirect API-key scope. MCP captures
AuthContext, uses wrapTool/direct Drizzle and registers distinct tools in index.ts.
Preview requires authentication; import requires manage:bills. Existing scoped
list_import_jobs/REST jobs provide history. CSV wizard and get_import_template
expose currency and every exact price/amount column.

## Inputs, units and supported ranges

Rows are 1..1000 flat CSV-mapped lines, not nested documents; fileName is 1..255
characters. source is custom (default), quickbooks, xero, freshbooks or wave.
Source changes date preprocessing, never money units. Required contactName,
issueDate, dueDate and lineDescription are nonempty. Dates retain the existing
source parser followed by valid Gregorian YYYY-MM-DD validation. Currency defaults
USD regardless of supplier/org currency, preserving legacy import behavior.
Explicit validated currency uses metadata (USD 2, JPY/IRR 0, KWD 3 minor digits);
this does not enable IRR in production.

lineUnitPrice is decimal **major** units, numeric or canonical CSV text.
lineUnitPriceExact is canonical decimal-major text; lineUnitPriceMinor is a
canonical signed int64 minor string. USD 12.50 / "12.50" / "1250" agree.
Major aliases must have equal decimal ratios; minor aliases agree with rounded
unit price. Omitted/blank price is zero without lookup. Minor-only price cannot
reconstruct a sub-minor major fraction.

lineAmount is an optional independent **extended amount override**, also major
units. Numeric zero is a real override; blank/whitespace text is absent.
lineAmountExact/lineAmountMinor add exact major/minor aliases with agreement.
Overrides need not equal quantity times price, preserving the old contract.
Stored unit price is independently derived from price aliases (or zero).
Well-formed legacy amount text supports $, EUR/GBP/JPY symbols, edge whitespace,
US comma grouping, European dot grouping with comma decimals, minus signs and
negative parentheses. Junk/malformed grouping/exponents/localized digits fail
instead of parseFloat truncation or silent zero. Exact text permits 20 whole/18
fractional ASCII digits; leading zeros reject after grouping normalization.
Parentheses retain positive-magnitude-round-then-negate behavior: USD (0.015)
is -2, while -0.015 rounds -1. Dual aliases must agree after this rounding too.

Quantity is physical decimal units, numeric or canonical CSV text (8 whole/18
fractional digits). Omission defaults one; legacy blank CSV remains zero.
Storage is signed int32 hundredths. Gross uses extended major price before
storing rounded unit price. Arithmetic uses bigint ratios and signed ties toward
positive infinity except negative parentheses. Tax/discount remain zero; no tax
lookup, inventory, PO linkage, approval routing, FX, ledger or settlement posting.

Every unit price, gross product, override, line amount and grouped sum must fit
+/-9007199254740991. An override cannot hide an unsafe gross; cancellation cannot
hide unsafe individual components. Final signed group sums are exact; negative/
zero drafts remain importable. Full-int64 business support is not advertised.
Unknown fields retain legacy schema stripping; raw numeric payloads are guarded
before echo or mutation. Both numeric and CSV quantities validate their rounded
signed-int32 storage bounds, including representable fractional boundary values.

## Grouping and outputs

Nonempty billNumber groups lines in first-seen order; omission/blank creates one
bill per line. Separate key namespaces prevent `_auto_0` merging automatic rows.
Grouped trimmed case-insensitive supplier, normalized dates and currency must
agree. billNumber is never a stored supplier number or retry/idempotency key.
Shared transactional allocation generates BILL numbers, honors existing numeric/
BILL-number forms and rejects signed-int32 exhaustion.

Preview retains one {row,data,valid,errors} record per input line and line-based
validCount/totalCount. Validated line DTOs add currencyCode, stored numeric minor
unitPrice/amount/taxAmount and unitPriceMinor/amountMinor/taxAmountMinor strings;
quantity is stored hundredths. data retains normalized source fields in original
input units. Preview checks grouped sums/headers/available references; any invalid
member marks the whole group invalid. Unsafe raw numeric echo rejects 422.
Preview writes nothing and does not promise import permissions or unlocked periods.

Job totalRows preserves **input-line** count; processedRows/errorRows count
**grouped documents**; errorDetails.row is 1-based group ordinal. Mixed success is
completed, all failures failed. Jobs contain counts/errors/timestamps, no money.
Draft reads use MON-046 header/line Minor aliases. Counts/quantities remain numeric.

## Mutation, authorization and retry

All shapes/dates/aliases/prices/products/overrides/group sums preflight before jobs.
Missing/deleted/ambiguous suppliers, missing/inactive/deleted accounts, periods
and database failures are isolated per document. Names/codes use literal equality,
not SQL LIKE wildcards. Foreign references never resolve. Blank/omitted account
remains null; supplied missing codes now fail rather than silently discarding them.

Each document locks the organization, resolves scoped references with share locks,
checks strict issue-date periods/closed fiscal years, recalculates totals and
allocates/inserts number/header/lines/create audit in one transaction. Failed line
or audit insertion leaves no header/lines/create audit/consumed number. Allocator
serializes with bill CRUD/procurement writers sharing these locks. Final import
summary audit retains best-effort logAudit. No bill quota or new multi-currency
plan check is invented in this path.

There is no durable resume, request key or whole-batch transaction. Reimport makes
new bills. Infrastructure/job-update failure can leave processing history and
already committed bills; inspect before retry. External period/configuration/
reference writers do not all share these locks; broader races remain qualification.

Malformed JSON/schema/aliases: HTTP 400; numeric range: 422 LEGACY_NUMERIC_RANGE;
invalid API key: 401; denied import: 403. Per-document business/DB failures use
201 {job}. Native MCP validation can reject shapes before service entry; wrapTool
classifies service errors. HTTP success alone does not prove import success.

## Verification and limits

Pure and migrated PostgreSQL real REST/API-key/full-SDK fixtures cover legacy/
exact/dual formats, currencies, formatted overrides, grouping, signed rounding,
safe bounds, invalid/unsafe preflight, roles/tenant isolation, literal/ambiguous/
deleted/inactive references, periods/closed years, partial jobs, repeat/concurrent
numbering, number collisions/exhaustion, injected line/audit rollback and no
ledger/stock/payment effects. See MON-053-attempt-1/review-1. No browser/session/
OAuth/live-provider/full-int64, production migration/PG16/clean-install or
independent financial qualification is claimed.
