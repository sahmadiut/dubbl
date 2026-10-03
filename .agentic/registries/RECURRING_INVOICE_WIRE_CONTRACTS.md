# Recurring invoice wire contracts (MON-044)

Adopted 2026-10-03 (Asia/Tehran). Additive exact aliases coexist with safe numeric
clients; no exact-only negotiation or full-int64 business path is advertised.
MON-019 retains combined receivable acceptance. Recurring bill/expense monetary
adoption remains MON-020/MON-021; journal adoption remains MON-037.

## Operation inventory

| REST operation | Input and response | MCP operation |
|---|---|---|
| GET /api/v1/recurring-invoices | Existing pagination/status/frequency/sort filters; `{data,pagination:{total,page,limit,totalPages}}` with scoped templates/contact/lines | list_recurring_templates with type=invoice; `{templates,page,limit}` |
| POST /api/v1/recurring-invoices | Described shared create fields below; 201 `{template}` header | create_recurring_template with type=invoice |
| GET /api/v1/recurring-invoices/:id | UUID; `{template}` with contact and stored lines | get_recurring_template |
| PATCH /api/v1/recurring-invoices/:id | Whitelisted header fields; `{template}` header | update_recurring_template |
| DELETE /api/v1/recurring-invoices/:id | UUID; soft deletion; `{success:true}` | delete_recurring_invoice (invoice only) |
| GET/POST /api/v1/recurring | Invoice rows use adopted DTO; POST requires type=invoice and accepts same create fields | list/create_recurring_template |
| GET/PATCH/DELETE /api/v1/recurring/:id | Invoice targets delegate to the same service; same envelopes | get/update_recurring_template, delete_recurring_invoice |
| POST /api/v1/recurring/:id/pause | Toggles active/paused; completed rejects; resume catches up from saved nextRunDate | pause_recurring_template |
| GET /api/v1/recurring/:id/preview | count 1..12 (default 5, existing REST upper clamp); upcoming dates and gross lineTotal/lineTotalMinor | preview_recurring_invoice with templateId/count |
| Background / explicit org-wide generation | processRecurringTemplates / processRecurringDocuments / invoicing maintenance; generated document count | run_recurring_template validates target, then processes ALL due document templates in the org |

All MCP tools use AuthContext, wrapTool, direct Drizzle access and described inputs.
Existing recurring-templates registration in index.ts covers the eight tools.
Reads require authentication; writes/run require manage:recurring. Automated posting
retains the explicit template create-as-approved policy. Invoice-only services
exclude foreign-org, deleted and bill/expense/journal targets. Shared generic
bill/expense handlers and generation keep their prior ownership and behavior.

## Inputs and units

Create: name, contactId UUID, one of six documented frequencies, canonical Gregorian
startDate, optional inclusive endDate, optional positive int32 maxOccurrences,
reference/notes (nullable), currencyCode (default USD), autoSend/createAsApproved
(default false), 1..1000 lines. No template FX storage exists: rateExact,
exchangeRate and rateDirection are unsupported and supplied invoice values reject.
The MCP schemas explicitly route those fields to rejection instead of stripping them.
Other unknown REST invoice fields reject; MCP uses the SDK's ordinary schema parsing.

Line unitPrice remains a numeric decimal **major** price (USD 12.50). unitPriceExact
is its ASCII decimal major string (20 whole/18 fractional digits); unitPriceMinor
is a canonical signed integer currency-minor string. Aliases must agree exactly
at the major value, and at the rounded minor price. Quantity is a decimal physical
quantity stored as signed int32 hundredths. discountPercent is 0..10000 basis points.
Optional accountId/taxRateId must reference available organization-owned rows;
omitted price is zero. No price-list/inventory/cost-center input is introduced.

Prices use the currency scale: USD 12.50 => 1250, JPY/IRR 12.50 => 13, KWD 12.50
=> 12500. Existing stored minor integers are never rescaled. Each template stores
rounded unitPrice and rounded quantity before generation. Gross, discount and
exclusive tax round sequentially using integer ratios and ties toward positive
infinity (legacy Math.round semantics). Totals use bigint sums with safe guards.

PATCH allows name, frequency, status, endDate, maxOccurrences, reference, notes,
currencyCode, autoSend and createAsApproved. It does not replace contact, lines,
startDate, nextRunDate or occurrence count. Currency changes retain existing minor
integers; changes across minor-unit scales reject and require a new explicit-price
template. End date cannot precede start. Pausing does not reset nextRunDate.
UTC date advancement preserves the existing month overflow: January 31 monthly
advances into March, rather than silently introducing end-of-month clamping.

## Outputs and supported ranges

Stored line unitPrice remains a Number in minor units and gains unitPriceMinor
string. Contact creditLimit gains creditLimitMinor (nullable). Preview adds
currencyCode and lineTotalMinor; its lineTotal retains the existing **gross**, before
discount/tax, definition. Inactive previews retain `{upcoming:[],template}`.
Generated invoices use the adopted invoice header/line contracts and saved posting
FX on journal lines. Counts, dates, quantities, discounts and tax basis points are
not money aliases. Envelopes and legacy numeric values remain intact.

Every price, gross, amount, tax component and subtotal/tax/header sum is bounded
by +/-9007199254740991 for the Number ORM coexistence path, even if discounts
would cancel an oversized product. Int64 strings above that boundary reject;
no lossy cast, magnitude-based string fallback or float ledger arithmetic occurs.
Quantities, occurrence caps/counters and numbering retain signed int32 storage
bounds. Invalid syntax, conflicting aliases, dates and references fail with 400;
permissions with 403; missing targets with 404; money range/scale/FX coexistence
failures with 422 (LEGACY_NUMERIC_RANGE where classified). Locked dates and
missing posting FX are 422 through REST/MCP adapters. Failed DB writes roll back.

## Atomic schedule generation and auto-send

CRUD, pause/delete and invoice generation acquire the organization lock before
the template row lock, matching invoice numbering/posting lock order. Generation
rereads current scoped status, validates saved lines/header/refs and all catch-up
dates, and writes invoice numbers, headers, lines, recognition journals, snapshots
and schedule advancement in one transaction per template. Overlapping runs create
one document per scheduled occurrence. Paused/deleted/future targets generate zero.
A failure at the second catch-up occurrence rolls back the first occurrence too.

Locked dates, corrupt/unsafe history and automated recognition failures leave the
whole catch-up pending. This deliberately corrects the previous partially committed
or silently downgraded-draft behavior. Resolve the lock/rate/configuration and retry,
or disable automation explicitly to generate drafts. Draft invoices can retain
signed/zero lines; recognition requires positive consistent totals and active
revenue/AR/tax accounts. Creator membership is checked for automated posting.

Generation resolves historical quote-per-base FX per occurrence and the reused
invoice posting service saves exact FX, millionths and base-currency snapshots.
It never rewrites posted documents when rates later change. Whole catch-up atomicity
is per template, not the whole org-wide batch. Other writers' period-lock/base/FX
coordination and full-int64/domain cutover retain their assigned qualification gates.

For autoSend, external email is attempted only AFTER committed posting. Delivery
failure retains posted invoices and is recorded by the existing email sender when
it reaches that sender. Rerunning the schedule does not duplicate the document or
email. An external-success/commit crash or process exit after DB commit is not a
transactional delivery guarantee: durable email outbox/recovery remains separate.
Audit retains the existing awaited best-effort policy. No PDF attachment is added.

## Evidence and limits

Four pure contract groups and actual authenticated REST handlers/registered SDK
tools on migrated disposable PostgreSQL cover old/exact/dual prices, 0/2/3 scales,
range and reference rejection, role/tenant/type/deletion isolation, preview/header
edits/pause, concurrent catch-up, zero payment terms, exact saved FX, missing FX,
locked periods, forced template/line/journal/schedule failures and failed email.
See MON-044 attempt/review evidence. No browser/session/OAuth, successful provider
email, production accounting approval or IRR enablement is claimed. IRR remains
production-disabled; a template price test does not enable functional IRR.
