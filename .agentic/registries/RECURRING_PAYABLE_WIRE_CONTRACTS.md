# Recurring payable wire contracts (MON-099)

2026-10-06, Asia/Tehran. Safe-number additive ADR-006 contracts. MON-028 retains
combined acceptance; full-int64, FX/history, economic workflow and IRR rollout
remain wider gates. No schema, migration or historical rescaling.

## Boundaries and envelopes

| Boundary | Corresponding MCP | Input / result |
|---|---|---|
| GET /recurring | list_recurring_templates | Type/status/frequency and pagination; REST data/total/page/limit, MCP templates/page/limit |
| POST /recurring | create_recurring_template | Bill/expense header and 1..1000 lines; template, REST 201 |
| GET /recurring/{id} | get_recurring_template | Scoped UUID; template with contact and lines |
| PATCH /recurring/{id} | update_recurring_template | Header fields only; template |
| DELETE /recurring/{id} | delete_recurring_payable | Soft-delete bill/expense; success:true |
| POST /recurring/{id}/pause | pause_recurring_template | Active/paused toggle, completed rejects; template |
| GET /recurring/{id}/preview | preview_recurring_payable | Count 1..12 default 5; template/upcoming |
| GET /recurring/summary | get_recurring_template_summary | Org-wide totalCount/activeCount/pausedCount/completedCount/totalGenerated |
| MCP run_recurring_template | Existing generator processRecurringDocuments | Active document UUID validates target, then runs all due documents in org; generated count |
| Trigger invoicingMaintenance -> processInvoicingMaintenance -> processRecurringTemplates | Same shared payable generator | Org-by-org sweep; bill/expense catch-up delegates processRecurringPayableTemplate |

Existing invoice branches delegate MON-044 services. Journal generation delegates
MON-037; default document sweep excludes journals. Dedicated invoice/journal
read/write tools do not accept payable templates. No invoice/journal evidence is
rewritten. Document summary preserves all-template counters, including journals,
using text SQL aggregates and checked bigint-to-number conversion instead of int32
casts. Counts have no money aliases. Generic REST list historically includes
journals when unfiltered; that behavior is retained, while MCP list excludes them.

Writes and manual run require manage:recurring; authenticated org reads retain
existing access. Custom permission arrays override role. REST uses the existing
API-key/session resolver; MCP uses server AuthContext and direct Drizzle. No HTTP
self-calls. Deleted/foreign roots return not-found. Contact/account/tax references
must belong to the org and be available; account/tax isActive is enforced. Creator
must remain a member for generation. No new session/OAuth/provider qualification.

## Money, controls and units

For BOTH REST and MCP, unitPrice is numeric decimal-major, unitPriceExact is
canonical ASCII exact decimal-major text (20 whole/18 fractional digits), and
unitPriceMinor is a canonical signed-int64 fixed-CENT string. Numeric major uses
its shortest decimal spelling; exact text rejects exponent, whitespace, grouping,
leading zeros and localized digits. Major aliases agree before rounding; minor
alias agrees with the rounded major. Omitted price is zero. Signed values/zero
retain existing behavior. All currencies use major x 100: 12.50 -> 1250 for
USD/JPY/KWD/IRR, and 1250 stays 1250. This deliberately preserves legacy payable
storage units, distinct from invoice currency-scale prices. It does not enable
IRR or claim currency-aware posting readiness.

Quantity is numeric physical decimal, rounded independently to signed int32
hundredths (-2147483648..2147483647 stored). Discount and tax rates are basis
points, never money. Discount 0..10000, tax 0..2147483647. Prices, extended gross,
net, tax and each aggregate are checked at +/-9007199254740991. Larger valid
int64 amounts fail 422 LEGACY_NUMERIC_RANGE before mutation; malformed/conflicting
inputs fail 400. Bigint ratios preserve Math.round signed ties toward +infinity:
1.005 major -> 101 cents; -1.005 -> -100. Gross rounds stored quantity*price/100;
bill discount then tax round at each existing boundary. Gross overflow rejects
even when a later discount would bring it into range.

Read template lines preserve unitPrice/debitAmount/creditAmount numbers and add
corresponding *Minor strings. Debit/credit are unused retained journal fields.
Scoped contact creditLimit adds its existing nullable creditLimitMinor. Preview
lineTotal/lineTotalMinor is gross before discounts/tax. Paused/completed preview
returns full template and empty upcoming, retaining the existing shape. Generated
bill totals/lines and expense totalAmount/items are preflighted and carry exact
aliases in audit snapshots; public bill/expense read APIs retain their respective
MON-046/059 contracts. Nullable unused mileageRate remains null.

Required name/contact/type/frequency/startDate, optional inclusive endDate,
maxOccurrences 1..2147483647 or null, reference/notes and currencyCode (default
USD) are strict. Update changes header only, including currency and invoice-only
flags; does not rescale saved prices. autoSend/createAsApproved are retained
booleans with no effect on payables, as before. Supplied FX fields and unknown
money/line fields reject rather than silently disappear. Gregorian dates use
0001..9999, valid days and end >= start. Existing UTC month-overflow dates remain;
no month-end clamping. Preview advances at most 12 occurrences. Catch-up supports
at most 1000 due occurrences per template; larger catch-up rejects entirely.

## Generation, audit and retries

Organization then template locks serialize create/edit/pause/delete and generator
runs, including initial bill numbering. Reference SHARE locks protect validated
joins. Live stored metadata, lines, currency, totals and output are checked on
read and before mutation; create also reloads persisted lines before commit.

Generator preflights all occurrence dates and due dates. Period/advisor/fiscal-year
checks run inside the transaction under SHARE table locks (including absence of
legacy lock/year rows); background work applies the strict staff lock policy.
A locked date leaves the entire catch-up pending. Supplier paymentTermsDays,
bounded nonnegative int32, determines bill due dates; null uses 30, zero is valid.
Expense generation has no supplier due date. It preserves gross-only expense
amounts, ignoring template discount/tax rather than introducing new accounting.
Bills preserve discount/tax totals, including legacy reverse-charge treatment;
this slice does not change that economic policy or automatically post/pay drafts.

Number sequence, all caught-up headers/lines/items, schedule/status and one
transactional generate audit snapshot per occurrence commit together. Create,
update, pause and delete also audit within their mutation transaction. Unsafe
saved output, audit/storage failures or a later-occurrence failure roll everything
back. Completed/paused/deleted/future candidates selected before locks are
rechecked. Concurrent generators produce one document per occurrence; retries
observe the committed schedule and return zero for already-generated dates.
Deadlock/storage errors remain visible and can be retried after rollback.

Creates intentionally create separate templates. Pause is a toggle; PATCH status
is the repeatable state-setting operation. Org-wide manual/job runs commit per
template, not as a transaction over every org template. Earlier successful
templates survive a later template's failure and retries do not regenerate them.
The MCP run's legacy extra best-effort run audit remains separate; generated
payable financial/audit/schedule writes use the atomic per-template audit above.

## Auxiliary configuration ownership audit

Source inspection and MONEY_COLUMNS/MONEY_BOUNDARIES classify the remaining
configuration writers rather than assuming every numeric control is money:

| Actual configuration / output | Money / owner |
|---|---|
| Organization mileage and billApprovalThreshold | MON-070 organization-wire/settings; nullable exact aliases. Threshold has no public writer; no new writer introduced |
| Tax rate/profile, interest and recovery controls | MON-071; numeric basis points; MON-072 owns tax-period monetary output |
| Approval conditions, bank rules/splits | MON-073 and MON-068; existing monetary JSON contracts remain their domains |
| Payroll settings, employee tax, brackets and allowances | MON-080; exact cents/percentage policy; employee/deduction masters MON-079 |
| Procurement tolerances | MON-054; dimensionless basis-point controls, no monetary alias |
| Asset categories/life/salvage and loan settings | MON-086/090; domain-owned money and physical units |
| Project/CRM/pricing configuration | MON-091..094 and MON-027 combined acceptance |
| Consolidation group/member/elimination rule config/report | MON-095/096; no extra independent monetary config writer found |
| Accrual/revenue schedules | MON-097/098, separate fixed-cent recognition/posting histories |
| Reminder/reminder-rule, SMTP, Stripe connection settings and site setting updates | Text, enabled flags, trigger/grace days and recipient metadata; no monetary writer. Monetary email/template rendering remains MON-008/034 |
| Site-admin organization/subscription read forwarding; saved report config, report filters, audit/history/backup | Already assigned opaque/public/rendering MON-034, report MON-029 and backup/import MON-032/033; not claimed qualified here |

No additional independent monetary configuration writer outside these owned
slices was found. This is source/lexical ownership coverage, not financial or
whole-product qualification. Refreshed generated inventory covers newly added
services and their actual source hashes/lines. No new legacy money bridge is added.
