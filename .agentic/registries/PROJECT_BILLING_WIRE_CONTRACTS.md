# Project billing and profitability contracts (MON-094)

2026-10-06, Asia/Tehran. Bounded MON-027 child; implementing-assistant self-review.
Shared direct-DB services: lib/api/project-billing.ts. Strict described schemas,
alias resolution and exact rational arithmetic: project-billing-wire.ts. REST
adapters: project-billing-route.ts. MCP tools: projects.ts, already registered by
tools/index.ts. Requirements: SOURCE.md database-and-currency-migration and
api-backward-compatibility; ADR-006. No schema, migration, historic rescale,
production IRR flag or deployment change.

## Operation map

Project paths below are relative to /api/v1/projects/[id]; path id maps to MCP
projectId. All POST fields are JSON body fields; DELETE itemId and report filters
are query fields. All schemas are strict. Duplicate query fields, unknown fields,
and projectId in a project route's body/query reject. POST successes return 201;
GET/DELETE return 200. Existing numeric clients require no opt-in; exact clients
send the additive string alias. Both representations coexist in responses.

| REST | MCP | Inputs | Outputs |
|---|---|---|---|
| GET /billable-items | list_project_billable_items | projectId | projectId, currency, registered, billed, candidates, registeredCount, registeredBillableTotal/Minor |
| POST /billable-items | register_project_billable_items | projectId, items | registered count, items (id, costAmount/Minor, billableAmount/Minor), currency |
| POST /billable-items, one-item adapter | register_project_billable_item (existing name) | projectId and one item's fields flattened | id, costAmount/Minor, billableAmount/Minor; batch has the same item |
| DELETE /billable-items?itemId=UUID | unregister_project_billable_item | projectId, itemId | success |
| POST /invoice | generate_project_invoice | projectId and full invoice fields below | invoice header with subtotal/Minor, taxTotal/Minor, total/Minor, amountPaid/Minor, amountDue/Minor |
| GET /progress-invoice | get_project_billing_preview | projectId | policy-specific preview below |
| POST /progress-invoice | generate_project_progress_invoice | projectId and progress fields below | same invoice envelope |
| GET /api/v1/reports/profitability?groupBy=project | get_project_profitability | optional projectId, startDate, endDate, currency; REST groupBy=project | common report envelope below |

No new multipurpose public tool or HTTP self-call. Seven REST/MCP operation pairs
plus the existing singular register adapter are exercised through actual handlers
and full SDK registration. The report's existing contact branch remains assigned
to MON-029; only project grouping is adopted here.

## Inputs, units and supported range

- Every ID is a UUID. Batch items and each selection array contain 1 through 1000
  records. Selection IDs must be distinct; duplicate batch source-type/line keys
  reject. No partial batch writes or silently ignored selections.
- An item has sourceType (bill_line default, expense_item, journal_line),
  sourceLineId, optional nonempty description, optional costAmount numeric integer
  cents and/or costAmountMinor canonical nonnegative int64 string. Omitted cost
  uses the source. Both aliases must agree exactly. Supported workflow cents are
  0 through 9007199254740991; valid larger int64 strings fail classified 422
  LEGACY_NUMERIC_RANGE before mutation. No negative zero, fractions, exponent,
  whitespace, localized digits or out-of-int64 money strings. Cost overrides are
  explicitly permitted; they never bypass source ownership/status/currency guards.
- markupBasisPoints defaults zero, range 0 through 2147483647; 1000 means 10%.
  Default invoice markup uses the same range and applies only when saved markup
  is zero. Quantity, markup, minutes, percent and counts never gain money aliases.
- Both invoice inputs have optional issueDate, dueDate, notes (string/null),
  defaultExpenseMarkupBasisPoints (default zero), includeBillableExpenses and
  requestKey. Dates are canonical Gregorian YYYY-MM-DD, years 0001 through 9999;
  issue defaults UTC today, due defaults issue plus 30 UTC days and must remain
  representable and not precede issue. Notes omission uses the legacy full-time
  project note or null for progress; explicit null remains null. requestKey is an
  optional organization-scoped UUID, shared across the two generation operations.
- Full invoice includes expenses by default and invoices every unbilled billable
  time entry. It requires hourly billing. Other policies use progress invoicing.
- Progress optionally accepts contactId, milestoneIds, timeEntryIds,
  percentageToInvoice (finite decimal Number 0..100), billableItemIds, and expenses
  default false. Milestone IDs require milestone policy, time IDs hourly policy,
  percentage fixed policy; expense IDs require inclusion. Omitted expense IDs mean
  all unbilled registered costs. Empty arrays reject. Percent means a fraction of
  original fixed price, not of the remainder. Its shortest decimal spelling is
  evaluated as an exact rational; a zero rounded allocation rejects.
- Time rates are saved integer cents/hour, including explicit zero; physical
  minutes use the inherited int32 support. No truthiness fallback replaces zero.
  Invoice quantity stores rounded hundredths of hours, through signed int32;
  line amount is computed from original whole minutes and is authoritative.
- USD/JPY/KWD/IRR integer 1250 remains 1250 fixed cents, independent of ISO scale.
  Every source/document currency must equal the saved project label. No automatic
  FX conversion. Journal costs currently support identity rates only (legacy
  1000000 and null or exact decimal 1); nonidentity costs fail closed.
- Products, sums, net costs, percentages and variances use bigint intermediates.
  Rounding matches legacy Math.round ties toward positive infinity, including
  negative report percentages. Safe numeric amounts and scaled percentage results
  are checked before Number conversion; overflow never changes output type or
  silently rounds. Signed report amounts support +/-9007199254740991. Counts and
  minute totals also remain safe Numbers. Zero-denominator ratios are zero.

## Output map

Every listed money field retains its Number and adds a canonical `fieldMinor`
string. Aliases are explicit; no arbitrary numeric field is treated as money.

- Registered items: id, sourceType, sourceLineId, description, costAmount/Minor,
  markupBasisPoints, billableAmount/Minor. Billed items: same source metadata and
  cost, markup, billedAmount/Minor, billedInvoiceId, billedAt (UTC instant).
  Candidates: sourceType, sourceLineId, description, costAmount/Minor, billId,
  billNumber. Header adds registeredBillableTotal/Minor and saved currency.
- Every preview includes billingType, currency, billableExpenses (registered item
  DTOs) and billableExpensesTotal/Minor. Hourly adds timeEntries with stored fields,
  hourlyRate/Minor, amount/Minor, public user {id,name,email,image}, minimal task
  {id,title} or null, and totalAmount/Minor. Milestone adds saved milestone fields
  with amount/Minor, invoicedAmountCents/Minor, remaining/Minor and totalRemaining/
  Minor. Fixed adds fixedPrice/Minor, totalInvoiced/Minor, remaining/Minor and
  integer invoicedPercent. Nonbillable adds the legacy message.
- Generation returns the saved invoice header: IDs/org/contact/number, issue/due
  dates, lifecycle/reference/notes, saved currencyCode, monetary totals and aliases,
  and existing metadata. Draft line tax is zero. All generated lines carry the
  stable projectId, quantity hundredths, unitPrice cents, net amount cents and
  sortOrder. Invoice output, lines and updated allocations are validated inside
  the transaction. Preview users never expose password/authentication fields.
- Report envelope: startDate, endDate, groupBy=project, currency (filter or sole
  label, null if no projects), entries and projects (same ordered array),
  totalRevenue/Minor, totalCosts/Minor, totalCost/Minor, totalProfit/Minor,
  overallMargin. Each row includes projectId, projectName, currency, status,
  billingType, budget/Minor, fixedPrice/Minor, hourlyRate/Minor, revenue/Minor,
  costs/Minor, cost/Minor, materialCost/Minor, otherCost/Minor, laborCost/Minor,
  profit/Minor, budgetVariance/Minor; estimatedHours (historically named minutes),
  totalMinutes, actualMinutes, billableMinutes, hoursVariance, margin/marginPercent,
  budgetUsedPercent, hoursUsedPercent. Percentage ratios have two decimal digits;
  fixed invoicedPercent is a whole percent. Duplicate names alias REST/MCP legacy
  spellings for compatibility. Sorting is exact profit descending, ID tie break.

## Scope, transactions and retry behavior

Authenticated reads use repeatable-read snapshots. API keys cannot override the
organization using a request header. Every writer requires manage:projects using
existing custom permissions/roles. Projects must be live and organization-owned;
generation needs a live scoped customer. Time users must remain org members and
time tasks must belong to their project. Foreign projects and source/reference
UUIDs fail without mutation.

Bill sources must be live received/partial/paid/overdue, same-org and tagged with
this project. Expense items must belong to live approved/paid claims in the org;
their schema has no project dimension, so registration explicitly supplies it.
Expense amounts retain the saved tax-inclusive amount; there is no automatic tax
netting. Explicit cost overrides can supply the intended on-billing cost.
Journal sources must be live posted same-org expense-account lines tagged with
this project, with scoped live accounts and identity rates. Arbitrary source IDs,
draft/pending/void costs, unlike currencies and negative source net costs reject.
Saved registrations also validate source/invoice ownership and currency. Billed
registrations cannot be edited, re-registered or deleted.

Organization then project locks serialize all adopted writers. SHARE locks on
period_lock and fiscal_year protect checks from concurrent period mutations.
Invoice issue, allocated time dates and source cost dates must be unlocked;
register/unregister also check source dates. Original advisor-tier/closed-year
semantics remain. These table locks can briefly delay period changes across
organizations; high-volume performance remains a parent qualification. Number allocation, invoice/lines, billed time/costs, milestone
invoiced amounts, totalBilled, audit and returned-money preflight commit together.
Audit and returned-money fault injection proves rollback, including numbering.
Currency edits now also guard expense-only billable registrations in the master
service. This adds a missing financial reference without altering stored values.

Fixed allocation totals use stable project-tagged live nonvoid invoice lines,
including drafts, subtracting registered costs billed on those invoices. Name
renames and same-name projects do not share balances. Existing matching name-only
untagged fixed invoice history fails closed for explicit attribution; it is not
silently treated as zero. Requested base price must not exceed the remainder.
Expenses can still be invoiced after the base price is exhausted. Corrupt negative
or above-price allocation history rejects. totalBilled retains the legacy running
generation sum; this task does not redesign invoice lifecycle reversals.

MON-027 integration exports this same calculation as projectFixedInvoiced for
master fixedPrice edit validation. Prices below the already invoiced fixed
allocation reject with 409 before mutation; valid expense-excluding reductions
remain supported. See [combined contracts](PROJECT_CRM_PRICING_INTEGRATION.md).

Re-registration of unbilled sources upserts one existing item; audit records the
operation. Keyed generation replays the original live invoice without numbering,
allocation or audit writes when operation/parsed inputs match. A changed operation,
project or input using the same org key returns 409. Replay still validates current
project/customer/currency and returned money; deleted/void invoices reject. Defaults
are part of the parsed fingerprint; explicit defaults and omission may differ for
optional fields. Requests without keys cannot replay successful fixed fractions;
each is a new explicit allocation within the remaining price. Time, milestones
and costs are consumed once; an unkeyed retry of consumed sources rejects. Concurrent
keyed REST/MCP requests return one invoice; unkeyed competing sources and overlarge
fixed fractions produce one success and one failure.

## Profitability and errors

Dates default UTC January 1 through today and must be ordered. Currency filter
selects projects; multiple project currencies without a filter reject before totals.
An explicit foreign/deleted project fails 404. Revenue is net project invoice lines
on live sent/partial/paid/overdue invoices. Material cost uses live recognized bill
lines. Other direct costs are signed net posted expense journal lines, including
null/manual sources, excluding bill sources to avoid double counting. Deleted
documents/accounts and draft/pending/void states are excluded. Unlike currency
documents and nonidentity journal amounts reject; rates are not guessed. Labor
groups minutes by project/user, rounds each group's exact internal costRate product,
then sums; no cost-rate assignment/null rate means zero, as before. Removed org
members reject rather than silently disclose/cost foreign users.

Schema/JSON/query/alias conflicts use 400; missing scoped roots/references 404;
permission failures 403; stale allocations, billed edits, overbilling and conflicting
retry keys 409; periods/business/range errors 422. Numeric compatibility errors carry
LEGACY_NUMERIC_RANGE. Unexpected injected faults are sanitized 500. wrapTool supplies
matching error handling and safe serialization. All failures are transaction-safe.

## Qualification and limitations

tests/project-billing-wire.test.ts covers exact aliases, maxima, invalid spellings,
rational ties/products, schema bounds and exact client percent preview.
tests/integration/project-billing.test.ts migrates a random disposable PostgreSQL
database and runs actual API-key handlers and full SDK tools. It covers every
operation/adapter, numeric/exact clients, all four saved labels, scopes/roles,
public projections, three source kinds, batch rollback, unsafe sums/returned money,
period locks, zero/max rates, keyed/unkeyed races, fixed histories and signed costs.
The MON-093 fixture is also rerun for the adjacent master reference guard.

Progress UI uses bigint sums and exact percent products, and displays preview load
errors. UI permits at most nine decimal places in percent text; API percent Number
retains its documented decimal range. Fixed-cents UI display remains legacy.
Browser screenshots, full builds/dev server, Docker, provider calls and deployment
are not required or run. High-volume query performance, full-int64/currency-scale/
FX costing, historical remediation, invoice reversal allocation policy and independent
financial/production IRR qualification remain parent/later gates. No compliance or
current FX market fact is claimed.
