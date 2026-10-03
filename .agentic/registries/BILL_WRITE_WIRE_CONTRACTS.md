# Bill CRUD write contracts (MON-047)

2026-10-03, Asia/Tehran. Direct source and migrated PostgreSQL handler/SDK fixtures;
self-review only. MON-020 retains combined payable/procurement acceptance.

## Boundaries and envelopes

| REST | Registered MCP | Inputs | Success |
|---|---|---|---|
| POST /api/v1/bills | create_bill | Create header and 1..1000 lines | HTTP 201 / tool result {bill,held?} |
| PATCH /api/v1/bills/:id | update_bill | UUID / billId and optional whitelisted header/full lines | {bill} |
| DELETE /api/v1/bills/:id | delete_bill | UUID / billId | {success:true} |

All require manage:bills, including custom permission resolution, and use the
server's AuthContext organization. REST API-key organization overrides conflicting
request headers. Missing, foreign or deleted target bills return 404. Existing
registerBillTools registers every operation through tools/index; wrapTool handles
errors and safe JSON. Services use direct Drizzle DB access, never self-HTTP.

Create requires supplier contact UUID, issueDate, dueDate and lines. Optional
billNumber (trimmed), reference, notes, currencyCode, purchaseOrderIds (0..1000),
confirmDuplicate and submitForApproval retain REST semantics. Blank/null billNumber
auto-numbers; blank reference/notes become null on create. REST currency omission
resolves supplier then organization then USD; MCP retains its USD default.
Explicit currency normalizes and validates ISO 4217. Dates must be real canonical
Gregorian YYYY-MM-DD. Supplier references and notes are arbitrary text.

PATCH accepts only contactId, issueDate, dueDate, nullable reference/notes and
optional complete replacement lines (1..1000). Omitted lines remain unchanged;
supplied lines replace all previous line IDs. Currency, billNumber, status, totals,
identity and audit columns cannot be patched. Unknown properties retain Zod's
strip behavior. Empty PATCH remains valid, updating timestamp/audit. A supplier
change does not change currency or run create-only duplicate policy.

## Units, aliases and exact calculation

Each line requires a nonempty description. quantity is a numeric decimal physical
quantity, default 1, in [-21474836.48,21474836.47]; storage rounds to signed int32
hundredths. Gross uses the original decimal quantity, preserving the existing
extended-price contract even when storage quantity rounds (0.333 -> 33 hundredths).
discountPercent is integer basis points 0..10000, default 0 (1000 = 10%).

Numeric unitPrice remains decimal currency major units on BOTH transports; it is
bounded to +/-9007199254740991. unitPriceExact is an ASCII signed decimal major
string, at most 20 whole and 18 fractional digits, without exponent/whitespace/
localized digits/leading zeros. unitPriceMinor is a canonical signed int64 integer
string, then guarded to the safe workflow range. All aliases must agree: major
values match exactly; minor matches the rounded major price. Omission defaults
zero. USD 12.50, JPY/IRR 1250 and KWD 1.250 produce 1250 minor units. Historic
values are never rescaled; pure IRR scale tests do not enable production IRR.

Exact bigint decimal ratios (reusing invoice-write-wire arithmetic) interpret a
numeric client's shortest decimal spelling, including scientific notation.
They round extended quantity*price once, then discount, then exclusive tax,
with signed ties toward positive infinity, matching the intended Math.round
policy without binary multiplication drift. Stored unitPrice rounds independently.
Stored tax rates are integer basis points, nonnegative signed int32.

Every rounded price, gross, net, tax, subtotal, taxTotal, total, reverse-charge tax
sum and amountDue must fit +/-9007199254740991. Unsupported intermediates reject
even if a later discount would reduce them. Products use bigint; only validated
final integers cross the transitional numeric ORM. Exact aliases do not advertise
full-int64 business support. Header responses add subtotalMinor, taxTotalMinor,
totalMinor, amountPaidMinor and amountDueMinor, retaining all numeric fields and
currencyCode. Write responses retain header-only envelopes; detail reads supply
line aliases under MON-046. A response serialization preflight runs before commit.

Normal, blocked and other exclusive tax remains in total and amountDue. A
reverse_charge line's tax is included in taxTotal/total for reporting but excluded
from supplier amountDue. PATCH and MCP create now share REST create's rule; this
repairs their previous overstatement. Draft edits reject recorded payments or a
saved journal link, so no posted or paid history is rewritten here.

## References, state, duplicates and atomicity

contactId, accountId, taxRateId, inventoryItemId, warehouseId and projectId are
organization-owned UUIDs. New references must be available/nondeleted and active
where the schema defines isActive. Optional line UUIDs accept null to clear.
goodsReceiptLineId joins through its organization-owned, nondeleted receipt;
purchaseOrderIds are likewise organization-owned/nondeleted. References are share
locked until commit. Historical same-tenant inactive/deleted references can remain
on a header-only edit/delete; foreign/missing history rejects. Saved header/line
money is validated even before full replacement or deletion. Receipt/PO linkage
only persists dimensions here; no stock, GRNI, tolerance or ledger posting occurs.

Create uses the strict period policy. Update/delete also require the old issue
date unlocked; date changes require both old/new unlocked. Closed fiscal years
reject. Caller bypass permissions do not relax this slice's strict checks.
The shared period helper reads lock state outside the transaction; concurrent
configuration/lifecycle writers are not qualified by this slice.

Create duplicate matching remains same organization+supplier+trimmed supplied
billNumber, excluding void/deleted bills. off permits; warn returns 409 until
confirmDuplicate=true; block always returns 409; hold creates pending_approval
and held:true. REST retains duplicate{id,billNumber}, warning and hint details;
MCP returns wrapTool isError with status 409 and the conflict/hint message.
SubmitForApproval also creates pending_approval directly as before; it does not
create an approval request or post a journal in this CRUD slice. MON-048 owns
approval workflow/lifecycle integration.

Organization locks serialize these CRUD writers and first-sequence creation;
draft targets also lock their header. Auto numbering uses the greater of the
stored int32 sequence and existing numeric/BILL-numeric identifiers, skipping
arbitrary supplier text. Exhaustion rejects with validation error. Manual numbers
do not consume a sequence increment. Numbering, header, lines, PO links, soft
delete and audit commit in ONE transaction. Audit failures now roll back rather
than leaving unaudited bill mutations. Deleted bill lines are removed; PO links
remain attached to the soft-deleted header as in the existing REST behavior.

## Errors and qualification

REST: unauthenticated 401, permission denial 403, invalid inputs/references/state
400, duplicate 409, foreign/deleted/missing bill 404, period lock or unsupported
money/history 422 (money has LEGACY_NUMERIC_RANGE), unexpected DB failure 500.
MCP wrapTool reports isError; status is present for auth/duplicate/period/money,
but SDK/Zod validation and generic DB errors do not promise a numeric status.
Failures leave bill/line/link/sequence/audit/ledger/stock/allocation snapshots
unchanged; API-key last-used metadata is outside business snapshots.

Pure tests cover aliases, currency scales, signed extended rounding, defaults,
discount/tax/reverse-charge units and safe ranges. Real PostgreSQL handlers/SDK
fixtures cover both transports, API-key/custom-role/tenant isolation, foreign
references, inactive/deleted history, duplicate strategies, pending state, date
locks/closed years, unsupported saved money, concurrent numbering and duplicate
creates, int32 sequence exhaustion and DB fault rollback including audit/link
failures. Adjacent MON-046 read fixtures verify continued compatibility.

MON-048..054 retain bill lifecycle and other procurement/bulk/settings contracts;
MON-021 owns pay_bill/settlement, MON-024 inventory, MON-033 exports, MON-034 PDF,
and full-int64/accounting/security/migration/IRR readiness remain assigned gates.
No schema/migration, posted ledger, currency rollout or deployment change.
