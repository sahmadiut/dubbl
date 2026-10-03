# Bill read wire contracts (MON-046)

2026-10-03, Asia/Tehran. Additive exact read aliases under ADR-006. Numeric ORM
coexistence limits remain; this does not qualify bill posting/settlement, full
int64 consumers, functional IRR, providers or production rollout.

## Operations and access

| REST | Registered MCP | Inputs | Returned envelope |
|---|---|---|---|
| `GET /api/v1/bills` | `list_bills` | Optional bill status, page and limit | REST `{data,pagination:{page,limit,total,totalPages}}`; MCP `{bills,total,page,limit}` |
| `GET /api/v1/bills/{id}` | `get_bill` (new) | Organization-owned bill UUID | `{bill,base}` with contact and lines/account/tax relations |
| `GET /api/v1/bills/counts` | `get_bill_counts` (new) | None | `{counts,total}`; counts keyed by present status |

Authentication uses existing REST API-key/session AuthContext; MCP is scoped by
AuthContext passed at server creation. All queries scope the nondeleted bill
parent to the organization. Reads preserve the existing authenticated-member
policy, including custom roles without write permissions. A conflicting
`x-organization-id` does not override the authenticated API key's organization.
No new write, posting, period-lock bypass, audit mutation or idempotency key is
introduced. API-key last-used metadata may update through existing authentication.

Bill statuses: draft, pending_approval, received, partial, paid, overdue, void.
MCP page is an integer 1..21474836, limit 1..100, defaults 1/50. REST preserves
the existing parseInt/clamp pagination behavior (including numeric prefixes),
then validates finite bounded integers with the same schema. Malformed NaN or
excessive page inputs fail 400; negative/zero pages and limits retain clamping.
Unknown nonempty status fails 400; empty status is treated as omitted. Unknown
query parameters are ignored; no extra filters are advertised. List order is
createdAt descending with id descending as a stable tie-break. List and count
are read within one repeatable-read/read-only transaction to avoid inconsistent
pagination during concurrent writes. Detail has the existing separate bill,
organization and rate queries; it is not a locked financial snapshot.

## Money and nonmoney units

| Location | Numeric minor-unit fields | Exact additive string fields |
|---|---|---|
| List/detail bill | subtotal, taxTotal, total, amountPaid, amountDue | subtotalMinor, taxTotalMinor, totalMinor, amountPaidMinor, amountDueMinor |
| Detail line | unitPrice, amount, taxAmount | unitPriceMinor, amountMinor, taxAmountMinor |
| Nested contact | nullable creditLimit | nullable creditLimitMinor |
| Base amounts | subtotal, taxTotal, total, amountPaid, amountDue (nullable) | corresponding nullable `*Minor` |
| Each status bucket | amount (sum of amountDue) | amountMinor; currencyCode identifies the summed currency |

All money retains the stored integer minor unit. USD 1250 is USD 12.50; IRR/JPY
1250 stays 1250; KWD 1250 stays 1250 (1.250 major). No magnitude or currency
rescaling occurs. Read unitPrice is **minor units**, although pending bill write
numeric unitPrice remains decimal major units. Monetary values must be signed
safe integers in -9007199254740991..9007199254740991. Canonical aliases are
integer strings, not locale-formatted major prices. Both representations are
returned together; there is no exact-only negotiation/header switch or numeric
sunset. Signed historical amounts are preserved, not normalized by these reads.

Line quantity stays hundredths of an item (150 = 1.5); discountPercent stays basis
points (1000 = 10%). Tax rates retain their existing basis-point fields. Counts,
page/limit/order, dates, references and IDs do not gain money aliases. Historical
inactive/deleted organization-owned contact/account/tax relations remain readable.
Foreign organization relations cause a classified 422 before any response is
returned; no foreign nested object is disclosed. Procurement/inventory/job-cost
IDs on lines stay IDs; their entities are not expanded by these reads.

## Status counts

Counts include **all** nondeleted statuses, including drafts, paid and void;
amount is the sum of stored amountDue, not total, amountPaid or a recomputed AP
balance. Missing statuses are omitted; empty organization returns
`{counts:{},total:0}`. total is document count, not a monetary sum.

One scoped SQL statement groups by status and selects sum/min/max(amountDue)
as text. Bigint parsing and explicit safe-number guards happen before numeric
JSON. SQL count(distinct currencyCode) must equal one per bucket; different
buckets may have different currencies because no cross-bucket amount is summed.
Even zero-valued rows of a different currency make a bucket ambiguous and reject
the whole response. Mixed-currency list pages remain valid because their amounts
are not aggregated. Unsafe bucket sums fail; min/max also reject unsafe individual
history that cancels out in the final sum. Signed zero/negative sums remain exact.

## Base display

Detail preserves the historical issue-date document-to-organization-base lookup
through getRateStatus, including freshness/effective-date metadata, future-rate
exclusion and tenant isolation. It does **not** report the bill's saved posting
FX. Base currency is organization.defaultCurrency, falling back to USD as before.

base retains baseCurrency, numeric rate in positive int32 millionths, amounts and
status; adds rateExact (decimal), rateDirection `quote_per_base`, rateBasis
`historical_lookup_millionths` and amount aliases. Missing rates produce null
numeric/string amounts and null rateExact. Same-currency identity rate passes
safe amounts unchanged. Available legacy display FX requires matching currency
scales; cross-scale conversion fails visibly rather than silently rescaling.
Nonidentity amount*rate intermediate products must fit the signed safe-number
range. Exact bigint ratio rounding preserves Math.round's signed tie toward
positive infinity (1 * 0.5 => 1; -1 * 0.5 => 0). Final amounts must also fit the
safe range. Shared document-base-wire implements the already-adopted invoice
policy; invoiceBaseDto remains an exported alias with its existing shape.

## Errors, fixtures and handoff

REST: unauthenticated 401, invalid status/page/UUID 400, foreign/deleted/missing
bill 404, unsupported money/FX or foreign nested references 422 with
`LEGACY_NUMERIC_RANGE`. MCP wrapTool supplies corresponding isError and structured
status/code for not-found/compatibility failures. SDK/schema validation failures
are isError; no HTTP status is promised for SDK validation.

Fixtures invoke actual authenticated REST handlers and registered SDK tools on a
random migrated PostgreSQL database. They cover legacy/exact consumers, above-int32
and safe-max money, negatives, units, custom read-only roles, tenant/deleted parents,
foreign contact/account/tax relations, unsafe header/line/contact history, status
filters/pagination, missing/issue-date/foreign/future FX, cross-scale/product limits,
all statuses, mixed currencies, sum overflow and cancelling unsafe int64 history.
SQL-text business snapshots remain unchanged across successful/rejected reads.

MON-047 owns CRUD write contracts; MON-048 lifecycle/stock/GRNI/approvals;
MON-021 actual settlement and pay_bill; MON-049..054 remaining procurement/bulk.
MON-020 retains combined acceptance. Export/PDF/provider/opaque/report work retains
MON-033/034/031/029; full-int64 and financial/IRR qualification remains MON-007/010
and QA gates. No schema/migration/configuration/deployment change here.
