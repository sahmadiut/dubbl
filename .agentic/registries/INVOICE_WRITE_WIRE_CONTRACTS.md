# Invoice CRUD write contracts (MON-039)

2026-10-03, Asia/Tehran. Shared direct-DB `lib/api/invoice-writes.ts` and
`invoice-write-wire.ts`; additive exact aliases with mandatory safe numeric
coexistence. No schema migration, full-int64 client mode or production IRR enablement.

## Operations

| REST | MCP | Result |
|---|---|---|
| POST `/api/v1/invoices` | `create_invoice` | REST 201; `{invoice,creditLimitWarning}` on both |
| PATCH `/api/v1/invoices/:id` | New `update_invoice` | `{invoice}`; draft only |
| DELETE `/api/v1/invoices/:id` | New `delete_invoice` | `{success:true}`; draft only; soft-delete header and remove lines |

All require `manage:invoices` via AuthContext. API-key organization wins over a
conflicting header; foreign/deleted invoices return 404. New references must be
available in the organization: contact, account, tax rate, cost center, project,
inventory item, warehouse, document/line price lists. Applicable active flags are
required except price lists, whose inactive/date-window fallback is preserved.
Retained history may reference inactive/deleted rows but never foreign rows.
Reference rows are share locked until commit. Delete/metadata edits preflight
historical header/line money and saved JSON serialization too.

## Inputs, units and supported ranges

| Field | Contract |
|---|---|
| `contactId`, REST path ID / MCP `invoiceId`, dimensions | UUID; organization-owned |
| `issueDate`, `dueDate` | Valid canonical Gregorian YYYY-MM-DD; issue date required on create |
| `currencyCode` | Valid normalized currency; explicit > REST contact/org/USD; MCP omission retains USD |
| `unitPrice` | Optional finite legacy decimal **major** Number, not cents; shortest decimal spelling interpreted exactly |
| `unitPriceExact` | Additive ASCII decimal **major** string, 20 whole / 18 fractional digits; no plus, leading zero, exponent, whitespace or localized digits |
| `unitPriceMinor` | Additive canonical signed int64 integer **minor** string; safe numeric business range only |
| `quantity` | Decimal physical Number, defaults 1; -21474836.48 through 21474836.47, rounded into signed int32 hundredths |
| `discountPercent`, `depositPercent` | Integer basis points 0..10000; discount defaults 0; nullable deposit metadata |
| `lines` | 1..1000; required on create, optional complete replacement on update |
| `reference`, `notes` | Optional nullable text; null/empty clears; omission on update retains |
| `invoiceType` | standard/deposit/retainer; defaults standard; normal AR semantics retained |
| `priceListId` | Optional document or line UUID; lookup is create-only |
| `enforceCreditLimit`, `submitForApproval` | Optional booleans; soft warning/draft are defaults |

Major aliases must agree as exact decimal ratios. When major and minor aliases
coexist, the minor alias must match the rounded major price. A minor-only price is
already rounded, so it cannot preserve a sub-minor major-price fraction; send
`unitPriceExact` when that fraction matters. USD `12.50` = 1250; JPY/IRR `1250` =
1250; KWD `1.250` = 1250. Minor strings never rescale by magnitude or locale.
Number exponent spellings are expanded internally; exact string exponents fail.

All stored monetary operands/results, gross amounts, tax amounts, header sums,
amountDue differences and credit subtotals/results support +/-9007199254740991.
Oversized inputs/history/results return 422 `LEGACY_NUMERIC_RANGE`, including
full-int64 strings outside safe range. Ratios/products are bigint intermediates;
rounding and final guards happen before any monetary Number bridge. No binary
float multiplication, SQL int32 narrowing or monetary Number sum occurs here.
Large gross values cannot be masked by a later 100% discount. Opposite-signed
history cannot hide an individually unsafe row. Non-money quantity units stay intact.

## Verified compatibility and defaults

All rounding ties go toward positive infinity (signed Math.round policy) through
integer ratios. REST create rounds unit price to minor units, then rounds quantity
times that price. PATCH and MCP create round the extended major price instead.
For USD `0.005` x 3: REST create = 3, PATCH/MCP create = 2; stored unitPrice = 1.
Discount and tax each round after the gross/net calculation. Shortest decimal
numeric inputs now avoid incidental binary float errors (e.g. price 0.29 = 29).
Quantity is calculated at supplied precision then separately stored in hundredths,
matching the existing independent quantity rounding; no new two-place rejection.

REST missing inventory-item prices use line/document list, highest qualifying
quantity tier, then item sale price; inactive/out-of-window/no-tier lists fall
back. Explicit aliases always win. Price lists must match document currency.
Inventory fallback has no currency snapshot and requires organization base
currency; no silent foreign-unit relabeling. Zero quantity retains the resolver's
existing `quantity || 1` tier lookup. MCP missing prices retain zero unless caller
opts into lookup with a document/line price list. PATCH missing prices remain zero
and supplied price-list lookup is rejected. Dimensions persist on all line writes.

Due-date defaults retain contact terms, else parseInt organization terms, else
30 days; zero still falls through to 30. Invalid/noncanonical dates fail before
numbering. No newly imposed issue/due ordering. Create checks monthly/multicurrency
plans, including existing unlimited self-hosted mode. Update cannot change currency,
contact, invoiceType or approval state through this contract.

Credit limits compare nonvoid/nondeleted invoice due amounts less unapplied
nonvoid/nondeleted credits plus the new invoice. Text SQL/bigint arithmetic guards
each row and separate totals. Contact/document/all included currencies must agree;
mixed currency fails 422 instead of inventing FX. Null limit skips comparison.
Soft warning has numeric and `*Minor` aliases for creditLimit/currentOutstanding/
projectedOutstanding/exceededBy. `enforceCreditLimit` returns 403 before numbering:
REST preserves warning payload; MCP wrapper returns classified 403 error text.
MCP now exposes credit/approval/create-price-list parity; update retains original
absence of a new credit-limit decision for drafts.

Submit-for-approval resolves creating member and matching active invoice workflow.
With steps, header is pending_approval and approval request is created in the same
transaction. Without a matching workflow/steps, draft fallback is retained.
Conditions use the existing approval evaluator; no new workflow semantics.

## Atomicity, outputs and limits

Organization row locks serialize this service's invoice CRUD and first-sequence
creation. Numbering, header, lines and create approval request commit together;
replacement/deletion rolls back wholly on downstream failure. Existing invoice
is locked/rechecked as draft. Old issue date and replacement issue date must be
unlocked; strict staff lock treatment is retained (no newly enabled bypass).
Fiscal closure uses existing assertNotLocked. Audit is awaited after success via
existing best-effort logAudit, which logs failures rather than rolling back business
writes. No audit is emitted on validation/transaction failure.

Returned invoice headers preserve numeric stored minor fields with subtotalMinor,
taxTotalMinor,totalMinor,amountPaidMinor,amountDueMinor. Lines are retrieved via
existing exact detail reads; create/update responses do not newly embed lines.
Validation conflicts/malformed references/dates/ranges are 400, roles/plans/hard
credit limits 403, foreign/deleted IDs 404, unsafe money/unit ambiguity/locks 422.
Unexpected DB failures remain 500 with atomic rollback.

MCP uses wrapTool and registration in existing invoices.ts/tools/index.ts; every
input field has .describe(). No HTTP self-calls. SDK-level schema errors can be
plain MCP text; wrapTool validation errors use its existing JSON shape.

No request-level idempotency key is added: repeated successful creates still
create documents. Concurrency with separate lifecycle/import/recurring writers,
concurrent lock/workflow/plan changes and database phantom references/credit
updates remain MON-040/044/045, MON-007 and QA qualification. No HTTP/session/OAuth,
browser, saved posting FX, full posting/inventory/approval lifecycle, financial
qualification or production deployment approval is claimed by these fixtures.
