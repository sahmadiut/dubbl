# Money and FX boundary manifest

## MON-101 financial report integration

[FINANCIAL_REPORT_INTEGRATION](FINANCIAL_REPORT_INTEGRATION.md) consolidates all
eleven MON-106..110 REST/MCP report pairs and exports. Actual legacy/exact journal
writers feed shared report assertions for period/cumulative income, ledger/cash,
pack/tracking/ratios, four currency contexts and XLSX scales. Full strict cumulative
MCP schemas now reject unknown fields instead of stripping them. Numeric/fixed
decimal legacy units, additive Minor aliases and safe/Excel limits remain. No
schema/history/IRR flag change; trial-balance and cash/ratio accounting limits and
MON-029 broader acceptance remain separate.

## MON-122 report schedules and delivery

[REPORT_SCHEDULE_WIRE_CONTRACTS](REPORT_SCHEDULE_WIRE_CONTRACTS.md) maps schedule
CRUD/manual trigger, six MCP tools and the existing Trigger consumer. Shared
strict schemas, scoped saved-report/SMTP references, real runner attachments,
transactional preflight and row locks prevent unsupported writes, tenant leaks
and overlapping successful due occurrences. PDF/CSV retain literal integer units;
XLSX money uses text cells to preserve every safe digit with Minor aliases.
Actual REST/API-key/MCP/PostgreSQL/recorded SMTP fixtures cover legacy/exact
writers, signed ranges, formats, stored corruption and unchanged failures.
Local calendar timing respects timezone/DST. External SMTP retry/partial delivery
cannot be transactional; no exactly-once network claim. MON-105 retains combined
integration; no schema/rescale/full-int64/IRR rollout change.

## MON-121 custom and saved report adoption

[CUSTOM_REPORT_WIRE_CONTRACTS](CUSTOM_REPORT_WIRE_CONTRACTS.md) maps the shared
custom runner, saved-report CRUD and CSV export to seven registered MCP tools.
Strict scoped configs, monetary bigint filter comparisons, safe numeric/Minor
projections and pre-commit saved-row guards prevent silent loss and unsafe writes.
Run/export now share filters, dates, columns and all six data sources. Related
tenant ownership and payroll report permission are enforced. Actual migrated
REST/API-key/MCP fixtures cover compatibility, signed ranges, unsupported stored
configs/timestamps and unchanged failed-operation snapshots. Grouping explicitly
rejects because it was previously ignored. No schema/rescale/full-int64/IRR change;
MON-122 retains delivery and MON-105 retains combined integration acceptance.

## MON-120 dashboard layout adoption

[DASHBOARD_LAYOUT_WIRE_CONTRACTS](DASHBOARD_LAYOUT_WIRE_CONTRACTS.md) maps five
REST/MCP CRUD pairs. Shared user/organization scoped transactions validate opaque
JSON inputs, stored layouts and output before commit, with safe numeric ranges
and bounded complexity. Existing numeric grid/config values and arbitrary exact
strings round-trip without invented money aliases, unit conversion or precision
coercion. Row locks and output preflight prevent mutation of corrupt layouts and
roll back unsupported merged PATCH results. Finite SQL timestamp checks protect
against adapter misparsing. Actual disposable PostgreSQL fixtures exercise SDK
registration, CRUD parity, authorization, both ownership boundaries and rejected
writes. MON-105 retains integration; no schema/rescale/full-int64 financial/IRR
rollout change.

## MON-115 expense and KPI analytics adoption

[KPI_ANALYTICS_WIRE_CONTRACTS](KPI_ANALYTICS_WIRE_CONTRACTS.md) maps four REST/MCP
report pairs and executive PDF/XLSX exports. Shared read-only snapshots use scoped
SQL-text/bigint ledger and document math, safe numeric/Minor aliases, exact rounded
shares/averages, UTC calendar windows and explicit document/base currency rules.
Existing project profitability reuses MON-094. Report pages use exact currency
formatting, show failures and offer contact document currency filtering. Actual
REST/MCP fixtures cover permissions, tenant references, legacy/exact writers,
exports, signed edges, overflow/cancellation and read-only financial/audit state.
MON-104/MON-029 retain integration; no schema/full-int64/rescale/IRR flag change.

## MON-102 combined receivable/payable report acceptance

[RECEIVABLE_PAYABLE_INTEGRATION](RECEIVABLE_PAYABLE_INTEGRATION.md) maps all aging,
statement/activity/print/email and payment-performance REST/MCP boundaries plus
aging exports. Combined fixtures reconcile actual legacy/exact document writers
and cash settlements across reports, preserve timing/cutoff selection differences,
verify numeric/Minor aliases, currency scales, scope/permissions and delivery
preflight. Contact/financial-export MCP schemas retain strict objects so unknown
fields reject before reads or delivery. MON-029 and independent full-range,
accounting, historical/performance and production gates remain separate; no
schema/history rescale or IRR enablement.

## MON-113 payment-performance adoption

[PAYMENT_PERFORMANCE_WIRE_CONTRACTS](PAYMENT_PERFORMANCE_WIRE_CONTRACTS.md)
documents the REST reader and new payment_performance MCP tool. One scoped
read-only snapshot uses SQL-text money and bigint sums, numeric/Minor aliases,
single document currency and exact calendar-day/count/percentage rounding.
Existing count-weighted rounded contact-day summaries remain compatible.
Permissions, owned contact labels, invalid saved dates, unsafe totals and mixed
currencies are guarded. Dashboard money display and CSV consume exact strings;
currency filtering and report errors are visible. Actual REST/MCP fixtures cover
timing, compatibility, isolation and unchanged financial/audit snapshots.
MON-102/MON-029 retain integration acceptance; no schema/rescale/full-int64/IRR change.

## MON-119 dashboard data adoption

[DASHBOARD_DATA_WIRE_CONTRACTS](DASHBOARD_DATA_WIRE_CONTRACTS.md) maps five
widget operations and action alerts across two REST routes and six MCP tools.
Shared scoped read-only snapshots use text source projections and bigint sums,
safe numeric/Minor aliases and explicit document currency filters. Document
totals retain fixed cents; per-account balances retain bank currency minor units.
Selection/status/date rules, operational counts and narrow field projections are
explicit. Actual REST and registered MCP fixtures verify roles, tenant isolation,
legacy/exact consumers, cancellation, overflow and unchanged domain/audit state.
MON-120..123 and MON-105 retain layout/report/delivery/budget integration; no
schema/full-int64/rescale/IRR rollout change is claimed.

## MON-099 recurring payable adoption

[RECURRING_PAYABLE_WIRE_CONTRACTS](RECURRING_PAYABLE_WIRE_CONTRACTS.md) records
bill/expense REST/MCP CRUD, preview, summary, manual run and job delegation.
Numeric/exact major prices and Minor aliases preserve fixed cents across all
currencies. Bigint products/sums, tenant/reference/creator guards, period checks,
organization/template locks and atomic whole-template catch-up protect financial
writes, numbering, schedule and audit. UI submits exact major text. Added payable
preview/delete and summary tools; existing invoice/journal paths retain their
services. Auxiliary configuration ownership is mapped to existing domain/opaque
owners without claiming uncompleted parent/report/public qualification. Draft
and expense gross-only policies remain explicit. No schema/rescale/IRR/full-int64
change; MON-028 retains combined acceptance.

## MON-098 revenue schedule and recognition adoption

[REVENUE_WIRE_CONTRACTS](REVENUE_WIRE_CONTRACTS.md) maps five shared REST/MCP
pairs. REST major/MCP cents units retain explicit exact aliases; bigint monthly
floor allocations and recognized sums conserve safe-range totals. Scoped live
invoice/line/accounts, saved account UUIDs/history validation, issued/base-currency
posting guards, period locks, keyed/targeted retries and atomic journals/status/
audit/output protect recognition. Dashboard input/display and loaded sums are
exact. Legacy inclusive calendar months and UTC overflow policy remain explicit.
Non-two-decimal/FX posting fails without inventing absent snapshots; no invoice
multi-schedule cap or original-deferral policy is introduced. No schema/migration/
IRR/full-int64/deployment enablement; MON-028 retains combined qualification.

## MON-097 accrual schedule and posting adoption

[ACCRUAL_WIRE_CONTRACTS](ACCRUAL_WIRE_CONTRACTS.md) maps five shared REST/MCP
pairs. REST decimal-major/MCP integer-cents totals retain distinct units with
exact aliases; bigint floor allocation conserves totals through last-period
remainders and UTC monthly overflow dates. Scoped source/accounts, saved history
checks, period locks, targeted/keyed retries and atomic journal/status/audit/output
validation protect posting. Dashboard input/display and loaded sums are exact.
No currency snapshot exists; unqualified non-two-decimal posting rejects without
rescaling. No schema/migration/IRR/full-int64/deployment enablement; MON-028 retains
combined integration qualification.

## MON-096 consolidation report adoption

[CONSOLIDATION_REPORT_CONTRACTS](CONSOLIDATION_REPORT_CONTRACTS.md) maps actual
REST/MCP read and recalculation boundaries, fixed presentation cents with safe
numeric/*Minor aliases, entity maps, exact quote-per-base rates and explicit
ranges/rounding. Transactional authorized member/config loading, text SQL sums,
bigint translation/CTA/caps, parent locks, period checks, atomic replacement,
storage preflight and audit are shared. Persisted recalculation now has MCP
parity; stale period entries are cleared and cancelling CTAs retain entity
adjustments. Symmetric cap/prefix/custom-rule accounting limitations remain
explicit. No schema/rescale/IRR/full-int64 enablement. MON-028 retains integration
acceptance; other report families remain their assigned tasks.

## MON-095 consolidation configuration adoption

[CONSOLIDATION_CONFIG_CONTRACTS](CONSOLIDATION_CONFIG_CONTRACTS.md) maps eleven
shared REST/MCP configuration pairs. Groups/members/elimination rules have no
money/FX inputs or exact aliases; currency labels and counts retain explicit
units. Strict scoped services use public organization projections, current child
membership, parent locks, duplicate/history guards and atomic audit/output
preflight. Group CRUD MCP and member/rule REST parity gaps are closed. MON-096
retains report/rate/elimination money and legacy report-writer concurrency;
MON-097/098/099 retain accrual, revenue and recurring payables; MON-028 retains
combined acceptance. No schema/rescale/IRR/full-int64 change.

## MON-091 price-list adoption

[PRICING_WIRE_CONTRACTS](PRICING_WIRE_CONTRACTS.md) records ten REST/MCP operation
pairs, additive unitPriceMinor cents aliases, safe numeric ranges and whole int32
quantity tiers. Shared scoped services guard metadata/history, tenant joins and
concurrent unique writes with atomic audit and response preflight. The missing
REST resolver and MCP item list now have parity; invoice/quote lookup shares saved
value guards. Currency changes retain v1 saved integer prices without FX/rescale.
No schema, IRR or full-int64 rollout changes. MON-027 retains combined project/CRM/
pricing acceptance through MON-092..094.

## MON-078 inventory assembly adoption

[INVENTORY_ASSEMBLY_WIRE_CONTRACTS](INVENTORY_ASSEMBLY_WIRE_CONTRACTS.md) records
six REST route files/fifteen operations and fifteen tools. Shared scoped services
retain minor money and physical quantity units with exact aliases; recipe ratios,
whole-unit consumption, cost rollup and journals use exact intermediates. Atomic
completion preserves full component/conversion carrying value in finished stock
and FIFO layers, including residuals when rounded unitCost times quantity differs.
Permissions, nested ownership, stock/account/method checks, date locks, repeat
protection and transactional audit/response preflight apply. BOM estimates/UI
share exact purchase-price estimates including wastage. Existing goods-receipt
writer remains compatible; no schema changes or history rescale. MON-024 retains
combined inventory acceptance, with full-int64/migration/IRR/release gates separate.

## MON-077 inventory valuation/landed cost adoption

[INVENTORY_VALUATION_WIRE_CONTRACTS](INVENTORY_VALUATION_WIRE_CONTRACTS.md)
records five REST route files/eight operations and eight tools, supported safe money ranges,
legacy two-decimal major component inputs and exact Minor aliases. Shared
transactional services conserve every component via largest-remainder allocation,
post balanced base-currency inventory/clearing GL with audit, enforce scoped source
references/permissions/period locks and prevent repeat capitalization. Nullable
bigint layer carrying/consumption values preserve FIFO residuals without rewriting
historical unit costs; generated migration 0008 has no backfill or rescale.
Report retains legacy price projections and adds exact saved carrying values;
UI/CSV use exact display and correct API field names. Standard/service/weight/manual
and unqualified foreign-currency/history allocation fail explicitly. Parent MON-024
and MON-078 retain combined/assembly acceptance; no IRR/full-int64 enablement.

## MON-076 inventory movement/warehouse adoption

[INVENTORY_MOVEMENT_WIRE_CONTRACTS](INVENTORY_MOVEMENT_WIRE_CONTRACTS.md) records
seventeen REST route files, twenty-two movement tools and six warehouse tools.
Stock/value adjustments retain cents semantics and add exact Minor aliases;
physical quantities stay whole int32, with safe SQL chart sums beyond int32.
Scoped atomic stock/GL/audit services fix warehouse/global count comparison,
zero-discrepancy recounts and partial/repeated transfers. Exact carrying-value
exhaustion and receipt ratios preserve rounding residuals; ordered item locks
coordinate master/bulk and MON-052 receipt writers, stale engine pre-reads reject.
FIFO/standard value-only adjustment explicitly rejects pending layer qualification.
Serial/lot endpoints retain allocation metadata without receiving stock or GL;
historical owned locations remain readable, foreign saved joins fail closed.
REST target/MCP signed-delta revaluation and their distinct offset accounts remain
documented compatibility contracts. No schema/full-int64/IRR change. MON-077/078
and parent MON-024 retain valuation/assembly/combined inventory qualification.

## MON-075 inventory master/import adoption

[INVENTORY_MASTER_WIRE_CONTRACTS](INVENTORY_MASTER_WIRE_CONTRACTS.md) records
item/category CRUD, opening stock, CSV import, reorder and five bulk operations.
Integer cents prices add canonical Minor aliases; item cost/book/product DTOs and
SQL summaries guard safe bounds. Physical quantities remain whole int32 units;
CSV legacy prices stay two-decimal major units, with explicit Minor columns.
Shared org-scoped services preserve opening DR Inventory / CR Opening Equity,
FIFO bulk costs, period/reference barriers and atomic audit. CSV rows commit
independently with ledger/value/audit together, replayed codes update master only.
Sixteen strict MCP tools use these services. Editors and local CSV export use
exact conversions/display. MON-076 retains other stock writers and can reuse this
bulk adoption; MON-077/078 valuation/assembly; MON-033 generic exports/imports;
MON-024 combined acceptance. No schema/units/full-int64/IRR rollout change.

## MON-074 inventory catalog adoption

Variant and supplier-link REST/MCP operations share described strict schemas and
direct-DB scoped services. Existing integer cents prices add matching Minor string
aliases, retaining 0..9007199254740991 safe numeric support and nullable historical
outputs; no implied currency conversion or value rescale. Physical variant quantity
and supplier lead days retain int32 units. Shared transaction locks, safe preflight
and audit prevent partial catalog writes; contact joins/references enforce tenant
ownership. Editors consume actual response envelopes and use exact price conversion
and display. Registry: INVENTORY_CATALOG_WIRE_CONTRACTS.md. Parent MON-024 retains
combined costing/stock acceptance after MON-074 through MON-078; no schema/IRR flag
change or full-int64 claim.

## MON-073 approval condition adoption

Approval JSON thresholds now retain legacy string value and add canonical
valueMinor for document-currency minor units. Exact bigint operators accept
full-int64 thresholds without Number coercion; actual document ORM/business
amounts remain safe numeric. Shared scoped direct-DB workflow/request services
validate payloads, members and nested relations; generic actions and workflow
writes have atomic audit/rollback, with bill/invoice lifecycle delegation retained.
Registry: APPROVAL_WIRE_CONTRACTS.md. Internal invoice workflow selection now
uses its document transaction. No schema/balance/currency flag change; generic
opaque/historical qualification MON-034/033 and combined MON-022 remain separate.


## MON-072 tax period adoption

[Tax period contracts](TAX_PERIOD_WIRE_CONTRACTS.md) cover CRUD, both filing names
and linked/standalone settlements. Numeric base minor units add Minor strings;
text SQL sums and bigint math guard boxes and posting sides. Foreign EC units
reject. Org/period locks, frozen figures, journal/identity FX and audit commit
together. SDK/API-key/custom-role/PostgreSQL fixtures verify races, rollback,
scope and range. Reports MON-029, approvals MON-073 and combined MON-022 remain;
full-range/history/global fiscal concurrency/independent financial/IRR gates are
separate. No schema, statutory policy or production flag change.

## MON-071 bounded tax rate/profile adoption

[Tax configuration contracts](TAX_RATE_PROFILE_WIRE_CONTRACTS.md) record all rate
CRUD/components, country profile and cached jurisdiction REST/MCP boundaries.
Dimensionless rates stay numeric int32 basis points; recovery stays 0..10000.
No money/FX aliases or scale conversion. Strict schemas and saved DTO guards
reject unsupported values; shared org-locked direct DB services preserve partial
patches/defaults and scoped live component accounts. Required audits commit with
writes. Profile batches and nullable jurisdiction key upserts resist concurrent
duplication; new detail/delete/lookup/write tools close MCP parity gaps. Real SDK,
API-key/custom-role and PostgreSQL fixtures prove isolation and rollback.
MON-072 retains tax-period money/filing/settlement; MON-029 keeps reports/1099,
MON-073 approval JSON and MON-022 combined configuration acceptance.

## MON-070 organization settings adoption

[Organization contracts](ORGANIZATION_WIRE_CONTRACTS.md) document member-scoped
organization and mileage REST/MCP, session list/provisioning response aliases,
nonnegative safe minor-unit inputs, nullable exact aliases, basis-point/control
distinctions and unchanged units/fallback. Shared direct DB services serialize
partial settings and currency changes, preflight response compatibility and
audit atomically. Strict schemas reject unsupported fields; existing UI PEPPOL
fields now persist. Journal-history and IRR gates remain; onboarding chart/tax
seeding retains existing post-commit behavior. Actual REST/SDK/SQL fixtures use
four currency scales and fixture session/email boundaries. MON-022 retains
combined acceptance after MON-070 through MON-073; full range, tax/approval,
global administrative/opaque and historical currency policy stay separately
assigned. No schema or production flag changes.

## MON-069 bank rule adoption

[Bank rule contracts](BANK_RULE_WIRE_CONTRACTS.md) document CRUD/suggestions/
application/automatic cash matching REST/MCP and scheduled/import consumers.
Signed conditions and opaque fixed JSON amounts validate canonical minor units;
amountMinor aliases preserve safe numeric compatibility without rescaling.
Bigint sequential split allocation retains fixed precedence/caps/remainder and
decimal-percentage half-up rounding. Shared exact bank services post one split
journal, qualify tax/FX/locks, retain contact and support audited undo. REST/MCP
apply share atomic transactions and scoped references; import suggestions remain
unreconciled. Automatic matching ranks only exact signed same-bank cash, skips
ties, qualifies saved manual/payment history and maintains existing payment links
without resettlement. Awaited audits and organization locks guard rollback and
races. The editor labels bank minor units explicitly. Actual REST/SDK fixtures,
four pure groups and banking/payment regressions qualify the bounded safe-range
slice. MON-021 retains combined acceptance; no schema/production/IRR flag change.

Inventory owner: MON-001. Refreshed 2026-10-04 (Asia/Tehran) for MON-058 against entry HEAD `0a52937`; changes remain uncommitted. MON-002 supplies the exact-money core; MON-003 widens monetary storage with a guarded safe-number compatibility adapter; MON-004 expands exact FX storage; MON-011 adds wire foundations; MON-013 adopts the currency FX slice. Rollout flags remain unchanged.

## MON-058 payment batch adoption (MON-021 child)

[Payment batch contracts](PAYMENT_BATCH_WIRE_CONTRACTS.md) cover immediate
multi-document cash, stored batch CRUD/submission and remittance REST/MCP.
Immediate numeric allocations retain decimal major inputs with amountExact/
amountMinor aliases, currency-scale bigint rounding and sums. Stored numeric
items remain minor units with amountMinor. All outputs retain numeric money and
add explicit *Minor strings. The shared exact settlement service runs inside
the batch transaction: all items, cash/GL/history/balances/numbering/status/audit
commit together or the draft remains unchanged. Scoped snapshot reads validate
nested references and safe totals. Remittances require live linked settlement
provenance, format exact values and escape text before sending. New MCP stored
batch operations complete REST parity. Legacy batches without qualified linkage
fail export; no history is guessed/repaired. Pure and migrated PostgreSQL fixtures
qualify the bounded slice; MON-021 retains combined criteria and remaining gates.

## MON-057 payment reversal adoption (MON-021 child)

[Payment reversal contracts](PAYMENT_REVERSAL_WIRE_CONTRACTS.md) cover DELETE and
delete_payment with one direct-DB service, unchanged success envelope and original
minor units. Safe exact balance arithmetic, active allocation checks, paired note/
prepayment restoration, saved-FX journal reversal, organization/period/reference
checks, atomic audit and concurrent deletion qualify the bounded history slice.
Note voids ignore retained soft-deleted carriers. Bank/provider-linked payments
require unmatch/refund first. Actual migrated PostgreSQL handler/SDK fixtures and
pure tests cover success/rejection/rollback; generalized residual carrying after
out-of-order rounded reversal remains unsupported by the settlement guard until
remaining applications are unwound. No schema/rollout change; MON-021 retains
combined acceptance and remaining payment/expense/banking child gates.

## MON-056 payment settlement adoption (MON-021 child)

[Payment settlement contracts](PAYMENT_SETTLEMENT_WIRE_CONTRACTS.md) cover
standalone creation and invoice/bill pay REST/MCP with positive numeric minor
units and additive amountMinor aliases. Shared transactional services qualify
recognition, cumulative saved control carrying, exact payment FX/scale conversion,
bank linkage, locks, document balances, mandatory audit, organization-wide optional
retry keys and concurrent settlement. Existing credit/debit-note and prepayment
carriers remain separate from new cash with explicit historical qualification.
MCP document pay now creates real settlement records using manage:payments.
Pure and actual migrated PostgreSQL handler/registered SDK fixtures qualify the
bounded safe-number contract. No schema or rollout flag changed; reversal, batch,
scheduled, expense/banking and MON-021 combined acceptance remain assigned work.

## MON-055 payment read adoption (MON-021 child)

[Payment read contracts](PAYMENT_READ_WIRE_CONTRACTS.md) cover REST/MCP list
and detail with numeric minor-unit compatibility and exact payment/allocation,
contact and bank aliases. Shared repeatable-read services guard tenant relations,
polymorphic allocation documents, scalar journal/statement links, saved ranges,
UUIDs and pagination. Signed/zero history and noncash paired allocations retain
their values without FX or cash aggregation. Pure and real handler/API-key/custom
role/registered SDK fixtures qualify supported reads and unchanged business
snapshots. MON-021 retains combined acceptance after MON-055 through MON-069;
settlement/reversal/expense/banking and full-int64/IRR gates remain pending.

## MON-054 procurement settings adoption (MON-020 child)

[Procurement setting contracts](PROCUREMENT_SETTING_WIRE_CONTRACTS.md) cover
GET/PATCH, compatible PUT and the existing read/update MCP operations. Bounded
numeric basis points and booleans keep identical units for legacy/exact clients;
no monetary aliases or rescaling apply. Shared schemas/services validate inputs,
saved controls and matching consumers. Atomic partial upsert/audit prevents
concurrent first-save loss and auditless mutations. Actual REST/API-key/custom-role
and registered SDK fixtures verify units/ranges, defaults, roles/isolation,
history/rollback/repeat/concurrency and matching controls. MON-020 retains combined
procurement acceptance; other financial/IRR qualification remains unchanged.

## MON-053 bill bulk adoption (MON-020 child)

[Bill bulk contracts](BILL_BULK_WIRE_CONTRACTS.md) cover REST/MCP flat CSV preview
and import with decimal-major prices/extended overrides and exact major/minor
aliases. Bigint ratios preserve extended-price and formatted amount rounding,
currency scales and grouped sums. All monetary input preflights before jobs;
literal scoped references and strict periods qualify each document. Organization/
sequence locks commit draft/number/lines/create audit together, with isolated
business failures and explicit mixed line/document count units. Preview retains
line envelopes and adds stored money aliases; wizard/templates expose aliases.
Real handler/SDK/PostgreSQL fixtures prove supported ranges, roles/isolation,
partial/repeat/concurrent imports and rollback. No ledger/stock/payment posting,
full-int64, durable retry or production/IRR qualification is inferred.

## MON-052 goods receipt adoption (MON-020 child)

[Goods receipt contracts](GOODS_RECEIPT_WIRE_CONTRACTS.md) cover receipt list,
detail, receive and create-bill in shared REST/MCP services. Exact physical
quantity aliases preserve hundredths/whole-stock units; saved PO minor costs,
nested money and draft bill balances add named Minor strings. Receipt FX/base
snapshot, exact GL/stock/FIFO/warehouse values, numbering, PO tallies and audit
commit together. Atomic create-bill rejects active receipt-linked bill reuse.
Nonstock recognition/void uses expense/AP and receipt tallies. Full unchanged-cost
foreign receipt clearing qualifies only at identical saved FX, with linked audit/
accrual/base proof; differing/partial FX remains explicitly unsupported. Tracked
stock and unrepresentable FIFO/residual/range/history fail safely. Real handler/
SDK/PostgreSQL fixtures establish supported boundaries. MON-020 and MON-024 retain
combined procurement and other inventory writers; rollout flags remain unchanged.

## MON-051 supplier debit-note adoption (MON-020 child)

[Debit-note contracts](DEBIT_NOTE_WIRE_CONTRACTS.md) inventory REST/MCP CRUD,
send, apply and void. Decimal-major REST/integer-minor MCP prices accept exact
major/minor aliases; safe numeric header/line amounts add *Minor strings. Shared
transactions protect numbering, references, journal/stock, paired carrier/bill
balances and audit. Recognition saves FX; linked complete non-GRNI stock returns
mirror original receipt/GL values and FIFO layers. Void restores saved history
and allocations; bill void refuses active linked notes. Differing AP carrying FX,
partial/GRNI/tracked stock, specialized expense tax and unqualified legacy history
fail safely with explicit qualification limits. Email follows commit with a 502
sent-state response on failure. Actual handler/SDK fixtures qualify supported
boundaries, not full-range/production/IRR or parent procurement acceptance.

## MON-050 purchase requisition adoption (MON-020 child)

[Purchase requisition contracts](PURCHASE_REQUISITION_WIRE_CONTRACTS.md) cover
CRUD, submission, approve/reject and PO conversion in shared REST/MCP services.
Exact major/minor price aliases preserve extended-price rounding and zero-tax
policy. Numeric header/line/contact money adds *Minor strings; safe bounds,
tenant references, dates, saved balances and state/link checks precede writes.
Number/header/lines/status/link/audit commit atomically; PO conversion copies
saved amounts and uses the existing locked PO allocator. The UI submission now
reaches the server; distinct MCP edit/delete/submit tools complete parity.
Real migrated PostgreSQL fixtures cover legacy/exact clients, roles/isolation,
range/date/history, injected rollback and concurrent numbering/decision/conversion.
MON-020 retains combined qualification; all full-range/production/IRR gates remain.

## MON-049 purchase order adoption (MON-020 child)

[Purchase order contracts](PURCHASE_ORDER_WIRE_CONTRACTS.md) cover all PO reads,
CRUD, counts, send and partial/full bill conversion in shared REST/MCP services.
Decimal-major/exact-major/minor price aliases preserve extended rounding and
existing PATCH no-tax semantics. Headers/lines/contact limits add exact aliases;
counts reject unsafe constituents/sums and mixed currencies. Scoped transactions
commit numbering/header/lines/links/tallies/audit with preflight and strict dates.
Conversion allocates saved net/tax exactly, including discounts and residuals after
void, and links GRN slices without reuse. Reservation history prevents recognition
from double-counting and releases tallies on void; converted bill edits reject.
Real migrated PostgreSQL handlers/SDK verify legacy/exact/dual clients, tenant/
role/date/range/failure/concurrency/GRNI/email-failure behavior. MON-020 retains
combined procurement qualification and all full-range/production/IRR gates.

## MON-048 bill lifecycle adoption (MON-020 child)

[Bill lifecycle contracts](BILL_LIFECYCLE_WIRE_CONTRACTS.md) cover receive, approve,
reject, void and generic bill approval actions in REST/MCP. Safe numeric header
money adds exact *Minor strings; exact ratio tax/FX/stock/GRNI math, saved FX and
value reversal, tenant/period checks and atomic posting/status/approval/audit
replace divergent partial/status-only writers. New receive_bill/reject_bill tools
complete transport parity. Legacy/FIFO/foreign-GRNI qualification failures reject
without committed effects. Settlement receives common recognition/range barriers,
but MON-021 retains payment aliases, ledger, allocation, locking and carrying FX.
Real migrated PostgreSQL handler/SDK fixtures verify legacy/exact clients, stock/
FX/tax/GRNI, workflow, concurrency, authorization and failure rollback. MON-020
retains combined acceptance; full-range/production/IRR gates remain separate.

## MON-047 bill CRUD adoption (MON-020 child)

[Bill write contracts](BILL_WRITE_WIRE_CONTRACTS.md) cover create, draft edit and
delete in REST and corresponding MCP, including new update_bill/delete_bill.
Both transports retain decimal-major numeric prices, explicit exact major/minor
aliases, decimal quantities and basis-point discounts/taxes. Bigint ratios/sums
guard every money component and safe numeric coexistence output. Shared scoped
transactions serialize numbering and duplicate policy, enforce old/new period
locks, validate references/history, and commit headers/lines/PO links/audit
together. PATCH/MCP create now exclude reverse-charge VAT from supplier due,
matching REST create. Actual migrated PostgreSQL handler/SDK fixtures cover
compatibility, tenants/roles, duplicate/approval states, concurrency and injected
DB rollback. Parent MON-020 retains combined acceptance; lifecycle/settlement,
full-int64 and financial/IRR qualification remain separate. No schema change.

## MON-046 bill read adoption (MON-020 child)

[Bill read contracts](BILL_READ_WIRE_CONTRACTS.md) inventory three REST and three
registered MCP reads: list, detail/base display and status counts. Safe numeric
header/line/contact money adds named exact aliases; shared issue-date display FX
adds decimal rate/direction/basis and guarded amount aliases. Status totals use
SQL text sum/min/max and bigint guards, rejecting mixed currencies per status
and unsafe individuals even when they cancel. Actual migrated PostgreSQL fixtures
cover API-key/custom read-only roles, tenants, legacy/exact consumers, above-int32/
safe-max/signed history, missing/historical FX and no business mutation. MON-020
retains combined acceptance after MON-046..054; MON-021 owns settlement and MON-024
inventory. Full-int64 and financial/IRR rollout remain separate gates.

## MON-045 bulk invoice adoption (MON-019 child)

[Bulk invoice contracts](INVOICE_BULK_WIRE_CONTRACTS.md) cover preview/import,
two batch actions, combined send/reminder REST and five registered MCP tools.
Decimal-major prices/exact aliases and explicit currency scales preserve import
units; grouped CSV and nested documents use exact ratios/sums. Unsupported money
rejects before jobs. Per-document atomic number/header/line import and whole-batch
lifecycle posting replace unsafe arithmetic and status-only send. Mark-paid stays
an explicitly guarded externally-settled annotation; MON-021 retains settlement
coordination. Reminder displays preserve every minor unit. Actual REST/SDK migrated
PostgreSQL fixtures cover roles/tenants/ranges, partial jobs, repeat/concurrent send
and rollback. Full-int64, broader CSV/parser, durable delivery and financial/provider
qualification remain assigned gates. No schema or production IRR change.

## MON-044 recurring invoice adoption (MON-019 child)

[Recurring invoice contracts](RECURRING_INVOICE_WIRE_CONTRACTS.md) inventory the
invoice-only and generic REST surfaces, eight MCP operations and background
pipeline. Decimal-major legacy/exact prices and minor aliases preserve stored
currency units; exact integer ratios guard every product/component/sum. Scoped
services serialize edits and whole catch-up generation with invoice numbering,
headers/lines/recognition/saved FX and schedule in one transaction per template.
Failed recognition or locked dates retain pending schedules. Email is best effort
after commit. Actual handler/SDK migrated PostgreSQL fixtures cover compatibility,
tenants/roles, concurrency, rollback and failed delivery. Recurring bill/expense
writers, full-int64/financial qualification and durable delivery remain separate
gates. No schema or production IRR rollout change.

## MON-043 sales receipt adoption (MON-019 child)

The [receipt contracts](SALES_RECEIPT_WIRE_CONTRACTS.md) cover seven REST and seven
registered MCP operations, including new draft edit/delete parity. Both receipt
transports retain decimal-major numeric prices, explicit exact major/minor
aliases and extended-price/discount/exclusive-tax rounding. Bigint ratios/sums
guard safe-number coexistence. Shared services lock organizations/documents and
atomically persist numbering, headers/lines, bank links, revenue/tax recognition,
average/FIFO stock/warehouse costs and saved-FX/COGS reversals. Missing revenue,
foreign references, invalid saved balances, unsupported unlinked stock, cost/COGS
mismatch and duplicate lifecycle requests reject. Actual authenticated REST and
SDK fixtures on disposable migrated PostgreSQL qualify roles, tenants, locks,
ranges, concurrency and rollback. Full-int64 domain, external inventory/config
writers, base-currency history policy, frontend/PDF/provider and combined financial
qualification remain assigned gates. No schema or IRR rollout change.

## MON-042 receivable credit adoption (MON-019 child)

The [credit contracts](CREDIT_WIRE_CONTRACTS.md) cover fourteen REST and fourteen
registered MCP operations. Credit-note REST decimal-major/MCP integer-minor
prices and customer-credit/application minor amounts gain exact aliases with
explicit agreement. Bigint rounding/products/sums/FX preflight safe coexistence.
Scoped atomic services cover whitelisted draft CRUD, recognition, carrier
application and saved-history reversal, with org/document/invoice/stock locks.
New stock returns retain quantities/costs for exact void after price/line changes;
invalid references, unsafe balances, mixed summaries and concurrent overdrawing
reject. Actual authenticated REST/SDK fixtures on migrated disposable PostgreSQL
verify roles, tenants, locks, legacy/exact/dual clients, FX/stock and rollback.
MON-021 retains payment-domain/carrying-FX coordination; PDF/email/provider,
external writers and full financial qualification remain assigned gates. No schema
or functional-IRR flag change.

## MON-041 quote adoption (MON-019 child)

The [quote contracts](QUOTE_WIRE_CONTRACTS.md) cover nine REST and nine registered
MCP operations. Decimal-major REST and integer-minor MCP numeric prices retain
their units with explicit major/minor aliases. Exact ratios/sums preflight safe
coexistence; whitelisted draft edits prevent arbitrary tenant/status/total writes.
Atomic scoped CRUD/status/conversion with organization/quote locks preserves
numbering and history. Percentage/milestone billing retain rounding policy; final
remaining billing allocates the exact residual and never forgives a minor unit.
Actual PostgreSQL authenticated REST/SDK fixtures cover units, four currencies,
references, roles, locks, unsafe history, races, rollback and rejected snapshots.
Email follows committed send state; PDF/provider/public/external-writer and full
financial/migration qualification remain separate gates. No schema/IRR change.

## MON-040 invoice lifecycle adoption (MON-019 child)

The [lifecycle contracts](INVOICE_LIFECYCLE_WIRE_CONTRACTS.md) cover eight REST
invoice operations, nine registered MCP tools and generic invoice approval-request
parity. Interest decimal-major and recovery integer-minor aliases retain distinct
units; bigint interest/FX/stock ratios and sums protect safe numeric coexistence.
Posting/status/stock/FIFO/number/approval effects are atomic, saved FX is preserved,
new stock reverses original cost and duplicate send/void serializes. Actual
PostgreSQL REST/SDK fixtures qualify scope/permissions/locks/ranges and rollback.
Legacy unlinked stock/FX, external writer/configuration races, email/PDF/provider,
settlement/full-domain and financial release qualification retain assigned gates.
No schema, configured DB, IRR flag or deployment change.

## MON-039 invoice CRUD write adoption (MON-019 child)

The [invoice write contracts](INVOICE_WRITE_WIRE_CONTRACTS.md) record create/patch/
delete REST and create/new-update/new-delete MCP direct-DB parity. Decimal-major
and integer-minor aliases agree explicitly, with bigint ratios/sums and safe
numeric coexistence. Existing create/edit rounding order and transport defaults
are preserved. Scoped references, price currency, credit totals, locks and output
serialization are preflighted. Numbering/header/lines/create approval requests
are transactional; organization/invoice locks serialize service CRUD. SDK/REST
PostgreSQL fixtures qualify successful and rejected operations plus fault rollback.
Best-effort audit policy and external-writer/lock/workflow races retain later gates.
No schema, configured DB, rollout flag or deployment change.

## MON-038 invoice read adoption (MON-019 child)

MON-038 adopts [invoice read contracts](INVOICE_READ_WIRE_CONTRACTS.md): three
REST and three MCP operations retain numeric envelopes with header/line/contact/
allocation/base/summary exact aliases. Historical references are tenant checked.
Summary uses a read-only snapshot, SQL text and bigint sums, rejects mixed
currencies/unsafe buckets and removes int32 casts. Base display declares historical
lookup millionths, guards products/scales and never claims saved invoice FX.
MON-019 retains integration after MON-038 reads, MON-039 writes, MON-040 lifecycle,
MON-041 quotes, MON-042 credits, MON-043 receipts, MON-044 recurring and MON-045 bulk.
No schema, migration, invoice write or rollout change is implied.

## MON-037 recurring journal adoption (MON-018 child)

The [recurring inventory](RECURRING_JOURNAL_WIRE_CONTRACTS.md) records every
recurring-journals REST operation, eight corresponding MCP tools and journal
materialization/maintenance. Minor aliases preserve safe numeric stored values;
bigint sums and strict dimensions/dates guard all writes. Templates store currency
but no configurable FX: fixed identity aliases explicitly declare existing verbatim
posting; unsupported rates fail instead of being discarded. Partial edits retain
currency. Header/legs and every template's full catch-up/schedule are transactional;
parent locks serialize edits/toggles/runs, with real concurrent/rollback fixtures.
Locked/closed dates retain skip/consume behavior. Unsafe or malformed history does
not consume the affected schedule. Runs commit per template; full currency-aware
posting and cross-template concurrency still require MON-007/QA qualification.
No schema, migration, configured database or rollout flag changes.

## MON-035 journal CRUD adoption (MON-018 child)

MON-036 also adopts [lifecycle/import contracts](JOURNAL_LIFECYCLE_WIRE_CONTRACTS.md):
five REST boundaries and six MCP operations, including new preview parity.
Scoped locked services preserve exact saved FX/raw amounts in atomic reversals,
enforce posting/scheduling/recode locks and validate target dimensions. Imports
retain REST decimal versus MCP cents, accept exact aliases, preflight sums before
job creation and atomically write each independent group. Actual PostgreSQL/SDK
fixtures verify scopes/ranges, partial jobs, rollback and duplicate-void safety.
Schema, configured databases and rollout flags are unchanged.

The [journal CRUD inventory](JOURNAL_WIRE_CONTRACTS.md) documents REST list/create/
detail/full-replace/delete and five corresponding MCP operations. Amount/rate
aliases retain stored units, REST fixed-two-decimal strings and MCP safe minor
numbers. Raw sums and existing REST FX products are preflighted with bigint;
saved FX is selected as SQL text to avoid numeric JSON decoding. Tenant-owned
dimensions, roles, locks, atomic header/leg mutation and delete parity are qualified
with actual migrated PostgreSQL/SDK fixtures. Automated base amounts are never
converted twice on reads; invalid legacy FX remains null with review metadata.

MON-018 retains combined acceptance after MON-035 CRUD, MON-036 lifecycle/import
and MON-037 recurring/generation. Existing REST-create versus MCP/create/edit
balance policy differences are documented for MON-007 rather than silently
harmonized. No full-int64 domain support, migration or IRR enablement is claimed.

## MON-030 public payment-link and portal JSON adoption (MON-016 child)

The [public operation inventory](PUBLIC_PORTAL_WIRE_CONTRACTS.md) records eight
REST handlers and seven strict, org-scoped MCP tools. Outputs retain safe numeric
fields and add *Minor strings. Statement prefixes/totals use bigint and reject
unsafe ranges/mixed currencies. View activity follows preflight; sent/expiry/
deletion-scoped quote acceptance and activity share a locked transaction. Real
public REST and MCP SDK fixtures qualify aliases, token/contact/tenant/permission
isolation and rollback.

MON-016 was split into MON-030 token JSON, MON-031 provider/webhooks, MON-032
backup/restore, MON-033 generic import/export and MON-034 opaque/rendering work,
retaining integration criteria. Public frontend/PDF arithmetic remains MON-008;
token administration/security remains PAR-007. Schema, migration, immutable history
and flags are unchanged; aliases do not imply full int64 or production IRR support.

## MON-032 backup snapshot and restore adoption (MON-016 child)

[BACKUP_WIRE_CONTRACTS](BACKUP_WIRE_CONTRACTS.md) documents the version 1/2
snapshot catalog, six REST route files and eight MCP tools. New snapshots add
stored-unit Minor strings without currency rescaling; original uploaded and
downloaded files remain immutable. Shared money/FX, schema, reference and ownership
preflight rejects malformed/unsafe input before storage or destructive restore.
Supported root/document-line restoration is atomic with audit and rolls back
on insertion failure. Locked periods, cyclic/unsupported references and existing
omitted dependent graphs reject before a safety backup instead of silently
performing a partial recovery. Actual PostgreSQL/API-key/MCP/S3-command fixtures
cover both formats, permissions/isolation, bounds, original bytes and rollback.
QA-005 retains complete recovery rehearsal and MON-016 retains integration;
no full-int64, schema migration, live S3 or production IRR claim.

## MON-100 budget comparison report adoption (MON-029 child)

[BUDGET_REPORT_WIRE_CONTRACTS](BUDGET_REPORT_WIRE_CONTRACTS.md) covers the budget-vs-actual REST/MCP pair. A shared scoped read-only repeatable-read service computes SQL text/bigint aggregates, natural signs, exact percentage/projection ratios and signed rounding. Every monetary output retains safe numeric fixed cents with a Minor string alias; current organization currency is explicit without reinterpreting document tags or rescaling USD/IRR/JPY/KWD. Newest non-deleted fallback, scoped nested references, canonical UTC dates, unsupported output/history checks and actual API-key/MCP fixtures preserve compatibility. Budgets lack currency snapshots; full-range/history/performance and MON-029 combined acceptance remain separate. MON-029 retains its criteria after MON-100 through MON-105 domain children. No schema, production migration or IRR flag change.

## MON-023 budget CRUD adoption (MON-015 child)

The [budget operation inventory](BUDGET_WIRE_CONTRACTS.md) covers five REST and
five MCP CRUD operations, signed cents aliases, exact sums/distribution, actual
safe-number ranges/date/period bounds and explicit report exclusions. REST/MCP
share direct-DB preflight/transaction/audit services and scoped nested reads.
All line/reference validation precedes writes; storage failures roll back headers,
lines and periods. Calendar generation now uses stable UTC Gregorian days.

MON-015 retains integration after MON-023 budgets, MON-024 inventory, MON-025
payroll, MON-026 assets/loans, MON-027 projects/CRM/pricing, MON-028 consolidation/
configuration and MON-029 reports/dashboards. No parent criterion is removed.
Budget-vs-actual and frontend amount arithmetic remain assigned work; CRUD alias
support is not full-range reporting/IRR enablement. Schema, migrations and flags
remain unchanged. Real disposable PostgreSQL operation fixtures qualify the slice.

## MON-017 contact adoption (MON-014 child)

The [contact operation inventory](CONTACT_WIRE_CONTRACTS.md) records all six
REST and six MCP operations, exact nullable `creditLimitMinor` aliases, supported
safe-number ranges, pre-write rejection and unchanged stored units. REST list
balance aliases derive from PostgreSQL text sums and bigint addition, replacing
int32 casts/Number sums; unsafe totals and incompatible document currencies fail
with 422. Numeric fields and existing response envelopes remain. Both transports
scope merge child references through bank accounts, payment batches and tags;
MCP also transfers contact people. No ledger/history value is rescaled.

MON-014 was split into MON-017 contacts, MON-018 journals, MON-019 receivables,
MON-020 payables/procurement, MON-021 payments/expenses/banking and MON-022
organization/tax configuration. Original parent acceptance remains unchanged.
Real REST/API-key/custom-permission/registered-MCP PostgreSQL fixtures qualify
this slice; statements/bulk/export/nested enclosing-domain boundaries and full
business/ORM cutover remain assigned work. No production IRR, client sunset,
schema/migration or deployment change is made.

## MON-013 currency FX adoption (MON-012 child)

The [FX operation inventory](FX_WIRE_CONTRACTS.md) records each adopted REST/MCP
contract, units, aliases, envelopes, organization/role/audit checks and explicit
unsupported ranges. Exchange-rate REST POST/PUT and MCP set_exchange_rate accept
exact `rateExact` strings or agreeing numeric aliases. REST millionths and MCP
decimal-number inputs retain their distinct units. Valid exact rates that cannot
coexist losslessly with int32 millionths return classified 422 before rate/audit
writes; malformed/conflicting inputs fail validation. DTOs preserve numeric
fields and normalized exact metadata without promoting quarantined rows.

Both v1 rate route files now use the guarded JSON adapter. ID-based mutations
include organization predicates, manual edits clear old provider metadata,
and updates/deletions use the existing audit helper. Historical lookup returns
explicit null exact aliases for missing quotes and documents six-place numeric
versus 18-place exact inverse rounding. Legacy MCP conversion preview rejects
unsafe products and differing currency scales; full-range exact amounts and
mixed-scale domain conversion remain MON-007/008.

Unit and actual PostgreSQL REST/API-key/registered-MCP handler fixtures cover the
slice; HTTP OAuth/session/frontend qualification is not claimed. MON-012 was
split into MON-013 currency FX, MON-014 core accounting, MON-015 auxiliary/report
and MON-016 public/opaque boundaries. MON-012/006 retain all original integration
criteria. No complete global boundary adoption or full-range posting is inferred
from this child. Existing databases, schema and application flags are unchanged.

## MON-011 wire foundation (MON-006 child)

`lib/money/wire.ts` supplies canonical signed int64-string money aliases, exact
decimal rate DTO/inputs, conflict rejection and explicit legacy/exact JSON.
Shared REST response helpers and all `wrapTool` results preserve safe legacy
numeric JSON; unsafe/nonfinite numbers or incompatible bigint return classified
422 `LEGACY_NUMERIC_RANGE` errors. The transitional ORM now emits the same error
for unsafe number reads/writes, without changing its safe-number data type.
Exact mode is selected only by an explicit server contract, never by magnitude.

No public client switch or endpoint-wide string contract is claimed. Direct
NextResponse responses, real domain input/DTO adoption and synchronized tool
descriptions outside the FX slice remain MON-012's other children; MON-006
retains final integration acceptance. Exact
business consumers, raw SQL, opaque/public/provider envelopes and full-range ORM
cutover retain MON-007/008/010 qualification. See [ADR-006](../docs/ADR-006-EXACT-WIRE-COMPATIBILITY.md).
Deprecation is proposed through qualification and an owner-approved client
window; no sunset date, contraction or IRR enablement is set.

## MON-005 provider/history policy

Migration `0007_steady_scarlet_witch` adds six nullable provider metadata fields without changing original quotes. Exact provider decimal lexemes, bounded date/source validation, explicit bigint half-up cross/reciprocal arithmetic and a per-tenant 20% movement guard precede writes. Legacy int32/six-place sync remains, with a one basis point rounding-error cap; incompatible extreme/tiny quotes are rejected and counted. Provider/source observation/import timestamps and original/cross quotes are traceable, while `rateExact` remains the actual stored quote. Manual overrides clear old provider metadata and survive concurrent refreshes. Existing REST/MCP numeric contracts remain; MCP descriptions and shared validators are updated and overrides use the existing audit helper.

Historical resolvers capture one tenant, key request/effective caches by organization/base/quote/date, reject quarantines and preserve saved journal FX. Public provider feeds are shared only within one sync invocation. Actual invoice journal creation before/after refresh is tested, but monetary consumer cutover remains MON-007/008 and full-range public contracts MON-006. See [ADR-005](../docs/ADR-005-HISTORICAL-FX-PROVIDER-POLICY.md) and [evidence](../evidence/MON-005-attempt-1.md). Configured application/production databases are not migrated; functional IRR stays disabled.

## MON-004 FX expansion checkpoint

Migration `0006_new_susan_delgado` adds four string/numeric exact fields and four numeric format-version fields, alongside direction/provenance/status. Existing FX types and values remain intact. Positive scaled rates backfill by exact SQL old_rate/1000000. Payroll backfills the persisted binary32 value by bit decoding only when it fits the 20 whole/18 fractional digit policy; other positive floats and malformed history retain legacy values and null exact fields with explicit review/invalid status. No intended rate is guessed. The [FX runbook](../../lib/db/FX_MIGRATION.md) and [ADR-004](../docs/ADR-004-EXACT-FX-EXPANSION.md) record capacity, provenance, coexistence, maintenance and future cutover limits.

Triggers synchronize legacy writes and reject unsafe exact pairs, including explicitly supplied unchanged conflicting values. REST rejects int32 overflow before storage; MCP rejects unrepresentable numeric decimals rather than rounding. Returned rows include additive exact/format/provenance/status metadata; original numeric contracts remain. At this checkpoint, provider/history work was assigned to MON-005 (now covered above); full-range contracts, historical currency snapshots and quarantined payroll remediation remain MON-006/007/008 qualification. Schema/migrations are expanded; the configured local DB and production were not migrated. Functional IRR stays disabled.

## MON-003 storage expansion

All 194 money columns and the method-dependent landed-cost basis now declare PostgreSQL bigint through `moneyInteger()`. The [migration disposition](MONEY_BIGINT_MIGRATION.json) covers all 402 inventory columns with explicit before/after types and retained exclusions. Migration `0005_clear_senator_kelly` groups 195 identity casts into 88 table rewrites; values, defaults, nullability and units stay unchanged. The [migration runbook](../../lib/db/MONEY_MIGRATION.md) records locking, size, backup/recovery and compatibility limits. Schema declarations and committed migrations are updated; the configured local DB and production have not been migrated.

The adapter retains exact number values for existing callers within the safe integer range and rejects unsafe reads/writes rather than rounding. Full bigint domain adoption, raw SQL/aggregate safety, wire strings and user-facing arithmetic remain MON-006/007/008 work. This is not IRR production qualification.

## MON-002 primitive implementation

`lib/money/exact.ts` supplies currency-tagged bigint amounts with signed int64 final bounds, strict decimal parsing, exact decimal output, addition/subtraction/sums, rational multiplication, decimal-percent tax and largest-remainder allocation. Parsing/tax/multiplication require an explicit rounding mode, including rejection of fractional minor units. Allocation conserves signed totals, with input-order remainder ties and mirrored refunds. Frozen scales in `lib/money/scales.ts` decouple arithmetic from runtime ICU upgrades. See [core contract](../../lib/money/README.md) and [attempt evidence](../evidence/MON-002-attempt-1.md).

Deprecated `lib/money.ts` functions preserve their behavior for existing consumers. ESLint enforces imported-binding reference ceilings from `scripts/legacy-money-baseline.json`, blocking new imports/uses; static analysis limits are documented in the core contract. Safe-number bridges explicitly reject precision loss. This is not application-wide adoption: the remaining Number-based ledger/FX/public/UI paths retain their assigned MON-004/006/007/008 work, and IRR production readiness remains disabled.

The [column appendix](MONEY_COLUMNS.md) has one row per actual numeric/JSON column: SQL table/column, Drizzle property, source line, type/range, units, currency source and migration owner. Refreshed for MON-058, the [machine-readable consumer index](MONEY_BOUNDARIES.json) contains 410 columns and 1,206 consumer files with line numbers, search tags, source hashes, currency context, range and owner. It scans 1,462 tracked and new nonignored source/config/documentation files and retains 23,334 lexical occurrences. All exported Drizzle numeric/JSON columns independently match the appendix, with no missing, extra or duplicate rows. The MON-003 disposition retains its historical 402-column scope.

`python .agentic/scripts/money_inventory.py` checks source reproducibility; `--write` refreshes after reviewed changes. `node --import tsx .agentic/scripts/verify_money_inventory.mjs` checks actual Drizzle exports, column lines, consumer hashes and occurrence lines. Neither reads environment credentials or connects to DB. These are mutable registries; completed task evidence remains immutable.

## Units, ranges and owners

- 194 monetary columns and one method-dependent landed-cost basis now declare PostgreSQL signed bigint: -9223372036854775808 through 9223372036854775807. Existing minor-unit values are unchanged by the migration; the transitional ORM supports only exact safe-number reads/writes. Legacy REST/MCP descriptions generally say cents; currency-aware display does not establish correct input scaling. USD 1250 remains 1250.
- JS integer precision is limited to +/-9007199254740991. Products and sums can lose correctness before a write. `.int()` alone does not impose the DB bound. SQL sum(integer) can exceed individual row range; downstream Number coercion and explicit `::int` need independent review. Appendix ranges are physical limits, not promises that every endpoint validates them.
- `exchangeRate.rate`, `journalLine.exchangeRate` and `consolidationRate.rate` retain int32 millionths. Maximum positive multiplier: 2147.483647; legacy inverse math can still round tiny reciprocals to zero. `payrollItem.fxRate` retains approximate PostgreSQL real (binary32), an **unscaled** local-to-base multiplier. Each now has `rateExact` with format/provenance/status; null means pending, invalid or review-required, never 1:1. Consumer cutover is still required.
- MON-002 owns exact primitives/rounding; MON-003 monetary storage; MON-004 exact FX storage/backfill; MON-005 providers/history; MON-006 REST/MCP/JSON compatibility; MON-007 core posting/banking/documents; MON-008 auxiliary/UI/public/PDF/jobs; MON-009 currency metadata/regimes; MON-010 qualification. LOC-003 owns localized exact input/presentation; DATA-001/002 extend safe imports/exports.
- Target: bigint domain/storage amounts, exact decimal FX and versioned integer/decimal string contracts. Precision, signed rounding and compatibility window are later decisions. Widening must not rescale valid history or change percentage/quantity units.

## Domain and currency map

The appendix enumerates every actual column; this table supplies domain context. Child inheritance is explicit; currency-less configurations are policy gaps rather than evidence that today's organization currency proves historical interpretation.

| Domain | Storage / currency source | Consumers and owner |
|---|---|---|
| Journals / aggregates | journalLine debit/credit: automated posting writes org-base amounts; currencyCode tags original document and exchangeRate its document-to-base rate | journal-automation, convert-entry, entries REST/MCP, reports, auto-reverse, period-close; MON-003/004/007. Manual-entry semantics and mixed-currency reads need review. Do not convert base amounts twice because they carry a document tag. |
| Invoices / quotes / customer credit notes / receipts | Header subtotal/tax/total/paid/due/applied/remaining/billed; line unitPrice/taxAmount/amount inherits header.currencyCode | Corresponding REST/MCP, dashboard forms, pay/sign/portal/PDF; MON-003/006/007/008 |
| Customer credits | originalAmount/amountRemaining have customerCredit.currencyCode | Customer-credit REST and MCP credit-notes workflows; MON-003/006/007, PAR-004; currency agreement needed for allocation |
| Bills / POs / debit notes / requisitions | Header/line currencyCode inheritance; receipt unitCost inherits goodsReceipt -> PO; landed-cost components/allocatedAmount inherit allocation.currencyCode | Bills/procurement REST/MCP, `_procurement.ts`, procurement helper; MON-003/006/007/008. Debit notes are the existing vendor-credit surface. |
| Payments / allocations / scheduled / batches | payment.amount and allocations inherit payment.currencyCode with document agreement; scheduledPayment/paymentBatch/paymentBatchItem have explicit currencyCode | Journal automation, remittance/supplier statements, payments/batches REST/MCP; MON-003/006/007/008 |
| Expenses / mileage | Claim total in claim.currencyCode; item amount/mileageRate inherits claim; org mileageRate is currency-less config | expense-claims, expense REST/MCP/UI/OCR, approvals and reimbursements; MON-003/006/007/008 |
| Inventory / BOM | Item prices/average/standard cost/totalValue, movement value/unitCost, variants/suppliers, layers/consumption, stock-take adjustments and BOM labor/overhead have no local currency snapshot; org context implicit | inventory-valuation, inventory/warehouses/BOM/assembly/procurement REST/MCP; MON-003/008. Qualify foreign procurement costs into base inventory. |
| Payroll / contractors / compensation | Employee/item/contractor/payment/band currencies; runs use payrollSettings.defaultCurrency; deductions/taxes/overtime/payslip inherit employee/item. Jurisdiction configs and compensation budgets have no currency snapshot. Salary/gross/net/tax/bonus/YTD/threshold/bracket/allowance columns all enumerated. | payroll REST/MCP, payroll-posting/tax/withholding, lib/payroll, payslip/tax-form/export; MON-003/004/006/008. Mixed-currency run totals need explicit policy. Existing statutory examples do not establish Iranian compliance. |
| Assets / CWIP / depreciation / revaluation | Purchase/residual/book/depreciation/disposal/carrying/surplus/impairment amounts inherit org via asset; category defaultResidualValue is org context; no asset currency snapshot | Assets/categories/depreciation/CWIP/revaluation REST/MCP and maintenance; MON-003/008 |
| Loans / budgets | Principal/payment/schedule interest/balance, budget line total and period amount lack currency snapshots; org context implicit; loan also references bank | amortization, budget-alerts, loans/budgets REST/MCP/UI; MON-003/008. Resolve bank-vs-org currency rather than assuming agreement. |
| Recurring / accrual / revenue | Template unitPrice/debit/credit inherits template.currencyCode; accrual totals/entries use org; revenue totals/entries inherit invoice and require conversion at posting | recurring-generate/journal-automation/bookkeeping-maintenance, Trigger scheduled/recurring-journals; MON-003/007/008 |
| Banking / statements / rules | Account balances/threshold use account.currencyCode; transaction currencyCode nullable with account fallback; statement opening/closing uses statementCurrency/account; reconciliation inherits bank | importer/matcher/bank-ledger/auto-reconcile/rules/alerts and REST/MCP; MON-003/006/007/008. Existing bank-vs-GL balance defect remains DATA-004/MON-007. |
| Tax / thresholds / contacts | Tax-return amount in org/report context; contact creditLimit in contact.currencyCode; billApprovalThreshold has no currency snapshot | Tax reports/returns, approval evaluator, contacts/org REST/MCP; MON-003/006/007/008. Foreign-document threshold comparisons need explicit conversion. |
| Pricing / projects / CRM | priceListItem.unitPrice inherits priceList.currencyCode; project money/member/hourly/time/milestone costs inherit project.currency; deal.valueCents uses deal.currency | pricing helper, projects/time/CRM REST/MCP/UI; MON-003/006/008 |
| Consolidation | Rate from member currencyCode to group presentationCurrency; elimination amount/variance in entry.currencyCode | consolidation-translate/report and REST/MCP; MON-003/004/006/008 |

## Consumer boundaries and observed hazards

The index lists fixed /100 and *100, basis /10000, scaled FX, cents/minor-unit helpers, parseFloat/parseInt/Number, rounding/toFixed, SQL sums/casts, monetary names and JSON/Zod responses. Per-file table references supply unit/currency profiles and migration ownership. This is conservative lexical coverage, not precise AST dataflow; comments, docs, examples and harmless counters remain candidates. Generic forwarders inherit the domain/wire contracts below even when no arithmetic appears locally.

| Boundary | Source finding | Owner |
|---|---|---|
| lib/money.ts | decimalToCents uses parseFloat/Math.round, default exponent 2, invalid input becomes 0. Currency-aware helpers still delegate to Number math. parseMoney strips unknown characters and defaults to 2 decimals; formatMoney defaults USD/en-US. | MON-002/008; LOC-003 |
| Forms / REST / MCP | Fixed-cents input and Number JSON/Zod; numeric totals/tax/discount/payment/refund/allocation calculations. MCP writes scoped direct DB independently, so API-only changes leave unsafe boundaries. | MON-006/007/008 |
| converter / triangulate / rate-status / base-amount / convert-entry | Number products, inverses and millionths; balance residual allocation and settlement/revaluation must remain exact | MON-002/004/005/007 |
| rate-provider / rate-sync | Provider RateFeed contains exact decimal strings and validated source/date metadata. Per-invocation public-feed reuse and exact triangulation precede guarded six-place storage. Manual rates win; posted journals keep saved rates. Tenant lookup caches remain request/batch scoped. Live provider availability is unverified. | MON-004/005 |
| Payroll FX | REST runs and MCP payroll divide integer rate by 1000000 then persist real fxRate; corrections reuse it and posting applies it once. Fallback paths need negative qualification. | MON-004/008 |
| Reports / dashboards / consolidation | Number aggregate coercions, signed sums, SQL integer casts, fallback currency, unrealized FX products and chart ratios | MON-006/007/008. Trial-balance sign defect remains PAR-008/QA-001. |
| Bank / CSV / Stripe CSV | lib/banking/importer localized amount parser uses decimalToCents without currency; BAI2 raw integer semantics differ from decimal formats. Stripe csv-parser uses parseFloat *100. Preserve raw units by file format. | MON-008; LOC-003; DATA-001/002 |
| Stripe / payment gateway | lib/integrations/stripe and API pay checkout/webhook pass provider minor units; sync notifications use /100. Provider limits and raw payloads are distinct from ledger range. | MON-006/008 |
| Public pay/sign/portal | app/pay/[token], app/sign/[token], portal payments/quotes/statements have independent fixed /100 formatters. Public checkout/read/receipt paths need separate contract and token/org checks. | MON-006/008 |
| PDF / HTML / print / email | pdf-renderer money formatter divides by 100; pdf-generator mixes shared money helpers with independent quantity formatting. document-sender/template-engine/reminders carry formatted totals and attachments. | MON-008; LOC-003; L10N-010/011 |
| Jobs / retries | Trigger delegates to recurring journals, auto-reverse, FX sync and maintenance/report/notification/webhook processors. Copies/accrual splits/depreciation/interest/payroll need exact residuals and idempotency. | MON-007/008/010 |
| JSON / exports / restore | response/MCP formatResult, webhook/audit, backup-snapshot/storage, CSV/Excel/report schedules, taxForm.formData and payslip.deductionsBreakdown propagate amounts without visible arithmetic. Bigint cannot pass JSON.stringify unchanged. Twelve monetary envelopes include rule conditions/splits and saved filters; raw immutable history must retain its contract. | MON-006/008; DATA-001/002; QA-005 |
| Currency metadata | ICU-derived ISO table has a fixed fallback missing IRR; locale/currency/calendar/timezone remain independent. Currency-aware helpers do not prove stored units. Functional IRR gate stays false. | MON-009; LOC-003; MON-010 |

## Non-money classification: preserve units

The appendix explicitly retains all other numeric/JSON columns, including counters/order/dates/file sizes/ports/auth expiry/subscription limits/physical quantities/labor and leave hours.

| Candidate | Actual meaning |
|---|---|
| Document/template quantity /100 | Hundredths of an item, independent of money. PO received/billed and receipt quantity are x100 too. Inventory stock/movement/layer quantities are whole units; BOM quantity is numeric decimal. |
| discountPercent /100 displayed with %, /10000 in arithmetic | Basis points, 1000 = 10%. Same basis applies to tax components/jurisdictions, recoverable/disallowed percentages, deposits, loan/org interest, depreciationRateBp, payroll tax rates and procurement tolerances. |
| Deduction percent /100; shift premium /100 | Plain percent, 100 = 100%. BOM wastage, budget variance, CRM probability, compensation adjustment and project progress are plain percent. |
| calculateTax /100 versus calcTax /10000 | Different input contracts (plain percent vs basis points), not currency display scales. Money products still need exact rounding. |
| distanceMiles /100 | Hundredths of miles multiplied by money-per-mile; preserve distance scale. |
| Time / multiplier | project.totalHours/estimatedHours actually store minutes. Payroll/leave store real hours; overtime factor is dimensionless. |
| landedCostLineAllocation.allocationBasis | by_value: monetary; by_quantity/by_weight: physical quantity/weight. Do not classify uniformly as money or non-money. |
| Number date parts/counts; *100 chart ratio | Non-money parsing/time/ratios; retain. A monetary chart aggregate still needs an exact-to-display boundary. |

## Legacy IRR investigation

Identify suspect cohorts by **provenance**, never magnitude: IRR documents entered through default decimalToCents/parseMoney or *100 forms; bank imports with default two-decimal parsing; public/PDF output via /100; employee/provider units inconsistent with org-base interpretation; FX that rounded to zero, overflow-rejected or came from approximate real. These source risks also affect other non-two-decimal currencies.

Read-only counts against the owner-authorized local test DB covered 31 direct currency-bearing tables (including draft/deleted/history rows) and IRR exchange-rate pairs. [Sanitized counts](../evidence/MON-001-irr-cohorts.json) show **zero IRR-tagged records and zero IRR FX pairs** at audit time. No credentials, IDs, customer details or stored amounts were saved; no data changed. This does not prove production cleanliness or absence of wrongly tagged/currency-less data.

Migration qualification must join children to parents and examine original files/provider payloads, request/import versions, dates, immutable GL, stored historical rates and audit records in a private org-scoped audit. Compare counts and exact signed sums/debit-credit invariants by org/currency/provenance before and after widening. Unit disagreement is a separate evidence-backed remediation decision. Missing provenance means preserve and flag. Never divide IRR by 100 or infer toman from size; widening leaves valid values unchanged.

The disabled functional-selection gate does not freeze all writes to preexisting IRR orgs or foreign-IRR documents. MON-010/QA-005 must qualify actual cohorts/migration/restore before enablement. Baseline accounting defects remain open.

## Verification limits

This inventory is source coverage plus local read-only cohort counts, not successful runtime qualification of every workflow. Mixed-unit profiles, inheritance and currency-policy gaps are findings assigned to migration owners. A lexical match is not automatically a bug, and absence of one is not transitive dataflow proof. Generic forwarding/opaque JSON/external contracts need MON-006/008/010 integration coverage. The inventory alone asserts no live provider capability, official currency rule, new statutory compliance or production approval. Implemented reference-rate rounding is recorded separately in ADR-005. No build/dev server/schema generation/deployment/migration is needed for these audit-only changes.

## MON-059 scheduled payment adoption

Scheduled CRUD/read/process REST and six described MCP tools share direct-DB
services; see [scheduled contracts](SCHEDULED_PAYMENT_WIRE_CONTRACTS.md). Numeric
amount remains positive minor units with amountMinor aliases; nested bill/contact
responses add exact aliases and guard saved money/tenant ownership. Schedule/form
input retains currency scales with exact parsing/prefill. Atomic per-item settlement
includes status/completion/numbering/ledger/bill/audit, retains saved date/currency
and carrying/FX, and prevents duplicate concurrent/retry cash. Failed attempts
remain pending with classified response failures; legacy failed/processing is not
automatically retried. No schema/unit/IRR changes; broader MON-021 gates remain.

## MON-060 expense CRUD adoption

Expense REST list/detail/counts/CRUD and six strict MCP tools share exact scoped
services; see [expense contracts](EXPENSE_CRUD_WIRE_CONTRACTS.md). REST numeric
decimal major and documented MCP integer-minor inputs remain explicit, correcting
MCP's former second conversion. Exact major/minor aliases agree; bigint rounding
and sums guard safe coexistence. Atomic header/line/audit writes enforce dates,
roles, state and owned references. Reads add *Minor aliases, sanitize users and
validate saved lines; status totals use SQL text and reject mixed currency/range.
Editor IDs retain omitted metadata and exact amounts; summary display preserves
fractions and currency. Historical values/schema/IRR flags are unchanged; lifecycle,
old create-drawer math, generic writers and MON-021 qualification remain separate.


## MON-061 expense lifecycle adoption

Submit/recall/approve/reject/pay/reverse REST and six strict MCP tools share
atomic organization/claim services; see [lifecycle contracts](EXPENSE_LIFECYCLE_WIRE_CONTRACTS.md).
Header totalAmountMinor preserves numeric saved units. Exact tax-inclusive,
recoverability and reverse-charge ratios plus currency-scale FX qualify approval.
Full reimbursement clears saved carrying value and posts realised FX separately;
reversal mirrors amounts/rates/dimensions, preserving history. Posting-specific
atomic audit supplies base/history provenance; unqualified/ambiguous legacy,
compound tax, unsafe money and changed base currency fail without committed effects.
State locks prevent duplicate posting and serialize adopted CRUD. No migration,
stored-unit or IRR changes; generic writers and MON-021/financial gates remain.

## MON-062 bank account adoption

Bank account CRUD, statement validation and low-balance settings share direct DB
REST/MCP services; see [bank account contracts](BANK_ACCOUNT_WIRE_CONTRACTS.md).
Signed balance/threshold numeric values retain saved units with canonical *Minor
aliases and safe coexistence guards. SQL text sums and bigint diagnostics reject
unsafe operands/sums/differences and foreign/mixed-currency references. Atomic
bank/GL-link/audit writes serialize creation/claims; owned active matching GL
links and history guards prevent currency/relinking of prior statement/payment/
opening GL history. Statement balance edits do not post opening GL. Scheduled
alert messages use text-only exact int64 currency-scale formatting. No migration,
historical rescaling or IRR flag change; other bank writers and MON-021 gates remain.

## MON-063 bank transaction read adoption

Transaction/activity/account and match suggestions/import metadata/duplicate
REST and MCP reads share scoped read-only snapshots. See
[bank transaction read contracts](BANK_TRANSACTION_READ_WIRE_CONTRACTS.md).
Signed numeric money retains saved minor units with nullable exact aliases and
safe coexistence checks, including nested imports/documents/payment metadata.
SQL duplicate/count text and bigint net journal/threshold math avoid range loss;
ownership, currency and stable pagination guards reject unsupported reads.
Opaque history keeps its own units; activity adds aliases only to known money
and allocation items. No ledger/write/schema/unit/IRR change. Import and other
bank writers remain MON-064..069; MON-021 retains combined financial gates.

## MON-064 bank import adoption

Statement preview/commit, mapped bulk preview/commit, import detail and parser
profiles share direct-DB REST/MCP services; see [import contracts](BANK_IMPORT_WIRE_CONTRACTS.md).
Decimal text conversion uses explicit bank currency scales; BAI2 stays integer
minor units. Canonical major/minor aliases agree; statement money adds Minor
strings and bulk preview keeps existing major-unit amount semantics. Bigint sums
and balances plus safe numeric guards reject unsupported values before commit.
Atomic rows/history/jobs/audit/balance and org/bank locks protect rollback and
row-deduplicated retries; repeated requests can add history. Profiles use the
existing table; native sign/date/currency guards prevent guessing. Import rules
suggest coding without unposted reconciliation. Other writers, broader parser/
resumable import behavior, stored-unit repair and full-int64/IRR/financial gates
remain MON-065..069, DATA-001, MON-033 and MON-021. No schema or rollout change.

## MON-065 bank categorization adoption

Four existing REST writers and five MCP operations (including new bank-expense
creation tool) share direct-DB bank-categorization services and strict schemas.
BANK_CATEGORIZATION_WIRE_CONTRACTS documents units, aliases, supported ranges,
per-item bulk behavior and corrected claim/FX/tax semantics. Split amounts retain
numeric minor units plus amountMinor; REST expense lines retain numeric major units,
while the new MCP tool uses numeric minor units; both have amountExact/amountMinor. Bigint split/tax/base totals, currency-scale FX,
owned references and period locks guard atomic journal/bank/expense/audit writes.
Corrections reuse saved rates; split/bulk/expense retries cannot double-post.
Claims created from outgoing movements are paid and journal-linked; generic undo
coordination stays MON-068/MON-021. No schema, historical repair or IRR enablement.

## MON-066 bank document matching adoption

Match, match-invoice and split REST writers plus six matching/read MCP tools
share scoped direct-DB services. BANK_DOCUMENT_MATCH_WIRE_CONTRACTS inventories
units/aliases/ranges/envelopes/history and compatibility corrections. Positive
numeric minor amounts add amountMinor with agreement; bigint sums and safe
coexistence guards protect payments/allocations/cash/carrying/FX/GL totals.
The existing exact settlement engine retains recognition and credit/debit/
prepayment classifications and reverse-charge outstanding payable. Atomic
numbering/document/posting/link/audit writes share organization/bank/movement
locks. Existing cash uses saved history without lookup/reposting; direct journals
require identity base FX and exact bank net. Full statement coverage, one contact,
owned references and locks reject unexplained partial or ambiguous history.
Other bank writers/undo, full-range/provider/production/IRR and MON-021 combined
financial qualification remain separate. No schema or stored-unit change.

## MON-067 bank transfer adoption

Standalone and match-transfer REST/MCP use shared organization-scoped atomic
services. BANK_TRANSFER_WIRE_CONTRACTS records decimal-major REST vs integer-minor
MCP numeric inputs and agreeing amountExact/amountMinor. Bigint amount conversion,
paired signs and historical FX preserve currency scales and safe numeric totals.
One journal debits the receiver and credits the sender; both linked movements
and audit/GL self-linking/numbering roll back together. Active same-currency banks,
exclusive live owned GL, open source/counter dates, unlinked statement/payment/
expense/import history and safe bounds are enforced before commit. Cached bank
and existing running balances remain imported statement snapshots. Concurrent
matching allows one successful pair; standalone calls remain new economic events.
UI target choices now reflect the same-currency policy. MON-068 owns undo/session;
MON-069 other bank operations; MON-021 combined integration. No schema, historical
unit, migration-file, full-int64 or production IRR change.

## MON-068 bank reconciliation adoption

[BANK_RECONCILIATION_WIRE_CONTRACTS](BANK_RECONCILIATION_WIRE_CONTRACTS.md)
records session/list/proof/complete/adjustment/mark/undo/exclude REST and eight
strict MCP tools. Signed numeric bank minor units add canonical exact aliases;
SQL text and bigint sums/differences guard safe coexistence. Foreign proof names
bank/base units and returns an unavailable comparison; foreign completion/
adjustment fails explicitly. Atomic organization-scoped writes validate full
saved money/FX/history, GL/tenant/session/date and cash/noncash identity. Existing
payments/journals detach without accounting changes; bank-created cash reuses
MON-057 exact reversal, category/expense/transfer reversals copy saved FX and
dimensions. Both transfer legs unwind; only audit-proven synthetic rows delete.
Completed affected sessions reopen with audit. Cached/provider balances and
retained allocations remain history. UI balances/display/sums are scale-aware
and exact; sessions prevent bank currency/link reinterpretation. MON-069 and
MON-021 retain remaining/combined qualification; no schema/full-int64/IRR rollout.

## MON-079 payroll master adoption

[PAYROLL_MASTER_WIRE_CONTRACTS](PAYROLL_MASTER_WIRE_CONTRACTS.md) documents employee/contractor root REST and ten MCP operations. Annual salary/per-hour cents add salaryMinor/hourlyRateMinor strings; nested contractor payment reads add amountMinor. Safe numeric coexistence, nullable history, explicit basis points/dates, scoped credential-free member joins and atomic preflight/audit preserve existing data. Root editors parse exact cents and contractor creation uses the actual hourly-rate field. MON-080 through MON-085 and parent MON-025 retain remaining/integrated payroll, calculations/FX and output qualification; no schema or production rollout change.

## MON-080 payroll configuration adoption

[PAYROLL_CONFIG_WIRE_CONTRACTS](PAYROLL_CONFIG_WIRE_CONTRACTS.md) records 23 REST/MCP pairs for settings, deduction types/assignments, tax elections, brackets and the existing allowance table. Nonnegative safe integer cents gain matching Minor strings; annual/per-period units, basis points, decimal binary32 percent, hours and int32 counts remain explicit. Tenant/employee/type/account scope, strict input, saved-output preflight, org/employee locks and atomic audit protect writes. Lazy defaults and allowance uniqueness serialize concurrent requests; soft-deleted tax configurations stay out of withholding reads. Dashboard editors use actual fields/envelopes and exact cents. MON-082 retains run arithmetic/jurisdiction and other unadopted writers; parent MON-025 retains integrated/full-range/financial gates. No schema, migration, rescale or production IRR change.

## MON-081 payroll time/leave adoption

[PAYROLL_TIME_WIRE_CONTRACTS](PAYROLL_TIME_WIRE_CONTRACTS.md) documents 32 actual REST/MCP operation pairs. No root money or FX: hours/decimal premiums retain numeric binary32 units; no Minor aliases, cents/minutes or percent/basis-point coercion. Exact bigint-scaled sums and saved DTOs reject storage rounding/unsafe history before commit. Nested employee/project cents add safe Minor strings while project minutes remain minutes; self-service does not return project financial objects. Org/employee locking, scoped references/membership, draft-only entry deletion and pending-only year-specific leave deduction/audit are atomic. Parent MON-025 and MON-082 retain combined run/accrual/FX/output qualification; no schema/history rescaling or IRR enablement.

## MON-082 payroll run/lifecycle adoption

[PAYROLL_RUN_WIRE_CONTRACTS](PAYROLL_RUN_WIRE_CONTRACTS.md) documents all 16 REST/MCP pairs, cents aliases and safe numeric coexistence, exact salary/hour/overtime/tax/deduction/FX arithmetic and signed per-employee corrections. Shared organization-scoped atomic services enforce approval, historical snapshots, period locks, balanced journal, preflight and audit; one-time deductions and termination/PTO effects finalize with processing. New run/item FX provenance is authoritative decimal while the numeric real field is explicitly approximate. Generated migration 0009 adds nullable snapshots and a payroll-only FX consumer trigger without rewriting historical rows or rescaling money. Dashboard special runs collect actual inputs and bonus amounts use exact cents. MON-083..085 and parent MON-025 retain remaining and combined qualification; no full-int64 or production IRR enablement.


## MON-083 contractor and tax payment adoption

[PAYROLL_PAYMENT_WIRE_CONTRACTS](PAYROLL_PAYMENT_WIRE_CONTRACTS.md) documents eight REST operations and nine MCP tools, including preserved legacy remittance fields and new pending-payment read/delete parity. Shared org-scoped services accept positive safe cents and matching Minor strings, exact allocation sums and contractor payment-to-base FX with bounded lossless int32-millionths ledger coexistence. Organization/contractor locks, account and sibling scope, immutable paid/void history, period locks, saved-response preflight and atomic journal/audit protect mutations. Paid process retries return saved snapshots; optional remittance keys normalize allocations and prevent duplicate journals. Generated migration 0010 adds four nullable contractor snapshots with no historical rewrite/rescale. Nested MON-079 detail and payment editors adopt the same DTO/exact cents. MON-025/084/085 retain combined/compensation/output/full-range gates; production IRR stays disabled.


## MON-084 compensation and forecasting adoption

[PAYROLL_COMPENSATION_WIRE_CONTRACTS](PAYROLL_COMPENSATION_WIRE_CONTRACTS.md) documents all 15 REST/MCP pairs. Annual band/review/entry amounts and forecasting totals retain safe numeric cents with matching Minor strings. Shared org-scoped services validate merged salary ranges, scoped review/employee joins and currencies, exact sums/ratios, terminal review states and atomic audit; concurrent entry writes serialize duplicate decisions. Forecasts explicitly require base-currency salary/hourly staff, use per-employee flat tax estimates and exact proportional termination/hire calculations. Migration 0011 adds a nullable review currency snapshot without rewriting legacy values. Dashboard inputs/display/totals use exact scale-aware money and server totals. MON-085 and parent MON-025 retain output/integrated/full-int64/financial qualification; no production migration or IRR enablement.


## MON-085 payroll outputs

[PAYROLL_OUTPUT_WIRE_CONTRACTS](PAYROLL_OUTPUT_WIRE_CONTRACTS.md) maps all 16 REST/MCP pairs: payroll reports/export, payslips, tax forms and self-service. Shared scoped transactional services use bigint sums/ratios, safe numeric cents with Minor aliases and saved currencies. Payslip YTD excludes prior years/deleted runs; concurrent generation fills missing snapshots once. Tax batches preflight actual withholding/deductions and USD payment thresholds, prefer saved payment dates and snapshot currency in JSON. Scoped detail/view/profile writes and awaited audits roll back together; malformed or unsupported opaque/history/range values fail. Exact dashboard/CSV cents and authenticated file requests preserve existing payroll units; real PDF/general scale/performance/financial/full-range qualification stays with MON-034/025. No schema, history, production migration or IRR flag change.
## MON-086 asset and category masters

[ASSET_MASTER_WIRE_CONTRACTS](ASSET_MASTER_WIRE_CONTRACTS.md) documents all ten root REST/MCP pairs. Shared organization-scoped services expose safe integer cents plus explicit Minor strings, validate category/account joins and merged residual/life/units/date settings, preserve copied defaults and child history, and preflight/audit in the mutation transaction. Exact master input/display and bigint loaded-row totals replace floating cents arithmetic. MON-087 through MON-090 and parent MON-026 retain lifecycle/loan calculations, period locks, idempotency, cross-writer concurrency and implicit currency-history qualification; no schema, migration, production/IRR or full-int64 promise.

## MON-087 asset depreciation

[ASSET_DEPRECIATION_WIRE_CONTRACTS](ASSET_DEPRECIATION_WIRE_CONTRACTS.md) maps the three REST/MCP pairs, including additive batch MCP parity. Shared scoped transactions preserve numeric cents and explicit Minor aliases, use bigint rational method/convention calculations, close final residuals and expense full-at-purchase. Organization/asset locks coordinate masters and stale legacy lifecycle snapshots; transactional period checks, one-charge-per-month guards, scoped audit replay keys and exact original-line reversals prevent duplicate or partial posting. Saved unsafe/inconsistent/revaluation history fails closed pending MON-088 policy. No schema/migration, currency-history rewrite or IRR/full-int64 enablement.

## MON-088 asset valuation and disposal

[ASSET_VALUATION_WIRE_CONTRACTS](ASSET_VALUATION_WIRE_CONTRACTS.md) maps all three REST/MCP pairs. Shared scoped transactions add safe cents/Minor aliases and exact signed surplus/P&L splits, validate carrying/history/journal/account/date/currency consistency, apply period locks and serialize lifecycle writers. Disposal removes valuation-adjusted gross cost, uses current carrying gain/loss, transfers surplus and books at most one unbooked month. Cross-transport audit-key replay and transactional output/audit checks prevent duplicate or partial posting. Legacy positive MCP impairment history fails closed; no historical rewrite. Post-valuation depreciation schedules and implicit currency history remain parent MON-026. No schema/migration, full-int64 or production/IRR enablement.


## MON-089 asset CWIP

[ASSET_CWIP_WIRE_CONTRACTS](ASSET_CWIP_WIRE_CONTRACTS.md) documents three shared REST/MCP operations, including cost read/add parity. Positive safe integer cents add canonical Minor strings; bigint accumulation retains opening CWIP basis and rejects derived overflow. Scoped base-currency accounts/categories/history, organization-first lifecycle locks, transactional period checks, exact GL/audit/output preflight and retry snapshots prevent partial/duplicate posting. Nonzero balances retain their holding account, including master edits; opening funding is a precondition, not guessed/rebuilt. No schema/migration, history rewrite, IRR or full-int64 enablement; MON-026 retains combined and independent qualification.

## MON-090 loan schedule and payment adoption

[LOAN_WIRE_CONTRACTS](LOAN_WIRE_CONTRACTS.md) documents six REST/MCP pairs, including delete parity. REST decimal-major/MCP integer-cents principal inputs retain distinct units and add explicit exact aliases; outputs preserve numeric cents with Minor strings. Rational bigint PMT/interest, conserved final principal, bounded schedules/aggregate totals and UTC legacy month-overflow dates replace floating money math. Shared scoped transactions enforce typed same-base-currency accounts, schedule/journal consistency, period tiers, org/loan locks, targeted/keyed retries and atomic audit/output validation. Loan funding and repayment GL retain their existing meaning without inventing generic settlement allocations or bank statement balances. Exact dashboard input/display/loaded-list totals and payment targets protect client retries. Tables lack currency snapshots; historical policy, full-int64/performance and integrated MON-026/MON-021 financial qualification remain separate. No schema/migration or production IRR flag change.

## MON-092 CRM adoption

[CRM_WIRE_CONTRACTS](CRM_WIRE_CONTRACTS.md) maps sixteen shared REST/MCP operations, including pipeline mutation, deal delete and analytics parity. Numeric fixed cents retain valueCentsMinor aliases; bigint sums/averages and explicit single-currency filters guard safe aggregate bounds. Probability remains nullable integer percent. Scoped contacts and credential-free current-member joins reject unsupported historical references; organization locks serialize lifecycle/default/delete writes, same-state close retries preserve timestamps, and audit/output validation commits atomically. CRM input/display/weighted values are exact fixed cents. No schema/migration or IRR/full-int64 enablement; historical remediation, high-volume and integrated MON-027 qualification remain separate.


## MON-093 project master/time adoption

[PROJECT_MASTER_WIRE_CONTRACTS](PROJECT_MASTER_WIRE_CONTRACTS.md) maps 48 shared REST/MCP operations. Existing safe numeric fixed cents add explicit Minor aliases; minutes/seconds/percent retain physical units. Scoped public joins, child references and organization/project locks guard atomic rows/time totals/audit/output validation; strict inputs and billed/paid/reference guards reject unsupported history. Exact editors, rational time valuations and bigint loaded-row display preserve cents. No schema/migration, conversion or IRR gate change; MON-094 and MON-027 retain billing, full-range and integrated financial qualification.


## MON-094 project billing and profitability adoption

[PROJECT_BILLING_WIRE_CONTRACTS](PROJECT_BILLING_WIRE_CONTRACTS.md) maps seven shared REST/MCP operation pairs plus the existing single-cost adapter. Safe numeric fixed cents coexist with explicit Minor strings; bigint rational markup, time, fixed percentages and report sums/variances preserve exact values. Scoped posted/approved sources, saved currency agreement, public user projections, stable project-ID history, period/reference guards and organization/project locks protect atomic invoice numbering, source allocation, totalBilled, audit and output checks. Keyed retries replay one invoice; unkeyed consumed sources and fixed overbilling reject. Project currency edits now guard expense-only registrations. The UI uses exact preview totals/percent products. No schema, history rewrite or IRR/full-int64/FX-costing enablement; MON-027 retains integration and independent financial gates.

## MON-027 combined project, CRM and pricing adoption

[PROJECT_CRM_PRICING_INTEGRATION](PROJECT_CRM_PRICING_INTEGRATION.md) consolidates the four child maps (81 REST/MCP pairs plus the singular cost adapter) and qualifies actual cross-transport saved rates, time/milestone allocations, tiered document snapshots, currency isolation, audit rollback and cross-writer races. Fixed project-price edits now use the billing history calculation under the same locks, rejecting prices below invoiced fixed allocations while excluding recharged costs. Safe fixed cents, exact aliases and physical/percent units remain unchanged. Full-int64, historical remediation, FX/migration, performance and independent accounting/production IRR/release gates remain separate.


## MON-106 cumulative statements (MON-101 child)

[CUMULATIVE_STATEMENT_WIRE_CONTRACTS](CUMULATIVE_STATEMENT_WIRE_CONTRACTS.md) maps the trial-balance and balance-sheet REST/MCP pairs, exact fixed-decimal/Minor aliases, safe outputs and currency-scaled export compatibility. A shared scoped read-only snapshot service and SQL-text/bigint GL functions preserve exact sums and earnings; legacy numeric GL adapters and XLSX cells fail visibly on unsupported precision. Actual auth/MCP/disposable PostgreSQL fixtures verify natural signs, comparison dates, isolation, exact cancellation, output limits and read-only state. Trial-balance presentation defect remains PAR-008/QA-001; MON-107..110 and MON-101/MON-029 retain the other report and combined acceptance. No schema, historical rescale or IRR flag change.


## MON-111 aged receivables and payables

[AGING_REPORT_WIRE_CONTRACTS](AGING_REPORT_WIRE_CONTRACTS.md) maps both REST/MCP aging reports and JSON/PDF/XLSX export paths. Shared scoped read-only snapshot services preserve live versus explicit historical selection, use bigint allocation/sum math and expose numeric cents with amountDueMinor/totalMinor/grandTotalMinor strings. Saved single-currency values and filters prevent mixed/foreign settlement totals; scoped contact projections cannot leak another organization. Actual API-key/MCP/disposable PostgreSQL fixtures verify exact writer inputs, signed/range/currency edges, permission denial, historical carriers and exports. MON-102 retains MON-112 contact statements/delivery, MON-113 payment-performance and integration acceptance; MON-029 and full-range/financial/performance/production IRR gates remain separate. No schema/history rescale or production rollout.


## MON-103 tax and regulatory reports

[TAX_REPORT_WIRE_CONTRACTS](TAX_REPORT_WIRE_CONTRACTS.md) maps all seven REST/MCP pairs. Shared read-only snapshots, SQL-text/bigint aggregates, exact flat-rate rounding and numeric cents with additive Minor strings preserve legacy report units and existing jurisdiction heuristics. Strict dates/threshold aliases, supported currency guards, scoped metadata/ledger joins and final safe-range validation prevent silent loss or tenant leakage. Live VAT drill-down versus reverse-charge/flat-rate differences remain explicit. No schema/history/IRR gate change; MON-029 retains independent integration acceptance.

## MON-114 spend and sales analytics

[DOCUMENT_ANALYTICS_WIRE_CONTRACTS](DOCUMENT_ANALYTICS_WIRE_CONTRACTS.md) maps vendor-spend, sales-by-customer and sales-by-item REST/MCP pairs and existing sales PDF/XLSX. Shared scoped read-only snapshots use SQL-text/bigint source sums, averages and percentages; numeric fixed cents coexist with explicit Minor strings. Strict dates, currency filters, scoped labels, safe source/result bounds and existing export precision guards reject unsupported values. Actual fixtures verify both writer contracts, tenant/permission isolation, distinct counts, top-five trends, signed cancellation and currency/export units. MON-104 retains independent integration after MON-115..118; no schema, history rescale or IRR rollout change.


## MON-107 period financial statements

[PERIOD_STATEMENT_WIRE_CONTRACTS](PERIOD_STATEMENT_WIRE_CONTRACTS.md) maps profit-and-loss, income-statement and pnl-comparison REST/MCP pairs and P&L PDF/XLSX/MCP export. Shared scoped read-only snapshots and exact GL/bigint sums preserve legacy numeric cents or fixed-decimal strings with explicit Minor aliases. Strict inclusive periods, UTC calendar comparison windows, owned dimension filters and safe final totals/changes guard unsupported inputs and outputs. Income-statement range/status/tenant leakage from its former outer join is corrected while retaining empty accounts. Exports retain currency scaling and existing PDF/XLSX precision guards. MON-108..110 and MON-101/MON-029 retain remaining and combined report acceptance; no schema/history rescale or IRR gate change.

## MON-112 contact statements and delivery

[CONTACT_STATEMENT_WIRE_CONTRACTS](CONTACT_STATEMENT_WIRE_CONTRACTS.md) maps five REST/MCP pairs for general/supplier statements, activity, print and email. Scoped read-only snapshots and bigint sums retain numeric integer currency minor units with matching Minor strings and guard single-currency totals. Opening balances now use original totals less dated cash movements, preventing today's amountDue and historical payments from double counting. Existing AP signs, carrier exclusions, printable HTML/email layouts and supplier MCP envelope remain. Strict dates/filters/pagination, role/tenant guards, exact currency formatting and HTML escaping preflight before delivery. Actual REST/API-key/MCP/disposable PostgreSQL fixtures assert writers, boundaries, safe/stored/result limits and recorded SMTP delivery without a provider call. MON-102 retains integration, public portal retains its existing owner; full-range/performance/accounting/IRR gates remain separate. No schema/history rescale or rollout.


## MON-108 ledger detail reports

[LEDGER_DETAIL_WIRE_CONTRACTS](LEDGER_DETAIL_WIRE_CONTRACTS.md) maps general-ledger/account-transactions REST/MCP pairs and complete PDF/XLSX exports. Shared scoped read-only snapshots use SQL numeric/text sums/windows and bigint projection for exact opening, movement, deterministic paginated running and closing balances. Legacy period-only numeric cents retain additive Minor aliases; separate ledgerBalance/closingLedgerBalance include opening history. Strict inputs, owned dimensions/accounts, scoped entry joins and final safe-range/export precision guards reject unsupported queries and outputs. Actual API-key/MCP fixtures verify aliases, tenant/auth failures, stable pages, caps/full exports, historical int64 cancellation and read-only state. MON-101/MON-029 retain combined acceptance; no schema/history/IRR gate change.


## MON-109 cash-flow reports

[CASH_FLOW_WIRE_CONTRACTS](CASH_FLOW_WIRE_CONTRACTS.md) maps the cash-flow REST/MCP report and PDF/XLSX exports. One scoped read-only snapshot uses SQL-text/bigint calculations and final guarded numeric cents with exact Minor strings, including flat rows and reconciliation. Strict dates/method/basis/query validation, account/entry organization guards, supported currency and Excel precision checks prevent silent loss. Existing indirect/direct classifications and their reconciliation limits are documented and characterized; independent accounting and MON-101/MON-029 combined acceptance remain open. No schema/history/IRR flag change.

## MON-110 compound financial reports

[COMPOUND_REPORT_WIRE_CONTRACTS](COMPOUND_REPORT_WIRE_CONTRACTS.md) maps tracking-category, report-pack and financial-ratios REST/MCP pairs and PDF/XLSX/workbook exports. Shared scoped read-only snapshots reuse exact GL, income-period, cumulative earnings and cash-balance calculations; final safe numeric cents retain scalar/array Minor aliases, and ratios have matching exact decimals. Pack cumulative earnings/full trial balance/cash subtype and ratio cutoff/outer-join leakage are corrected. Strict controls, dimension/document currency ownership, final amount/ratio/Excel guards and actual migrated REST/MCP fixtures cover read-only failures. Existing ratio/cash-basis and standalone trial-balance accounting limits remain explicit; MON-101/MON-029 retain combined acceptance. No schema/history/IRR flag change.


## MON-116 cash forecast and unrealized FX reports

[FORECAST_FX_WIRE_CONTRACTS](FORECAST_FX_WIRE_CONTRACTS.md) maps two actual REST/MCP pairs. Shared scoped read-only repeatable-read snapshots project SQL-text/bigint money into safe numeric integers and matching Minor strings. Forecasts reject mixed currencies without a filter, project the full recurring horizon, and align UTC Sunday buckets with the inclusive period. FX estimates use exact saved quotes, preserve gain/loss signs and nullable missing-rate behavior, and reject lossy legacy or inverse aliases. Strict queries, scoped contact joins, supported currencies, source/result guards and actual PostgreSQL/API-key/MCP fixtures prevent precision/unit/tenant loss. Both pages format exact currency amounts and expose errors; no schema/history/IRR rollout. MON-104/MON-029 retain combined and independent qualification.


## MON-117 bank analytics reports

[BANK_ANALYTICS_WIRE_CONTRACTS](BANK_ANALYTICS_WIRE_CONTRACTS.md) maps both REST/MCP
pairs. Shared scoped read-only snapshots project SQL numeric/text aggregates with
bigint sums/subtraction into safe numeric currency minor units and matching Minor
strings. Strict UTC dates/groups/account/currency queries, owned live bank IDs,
independently scoped imports and explicit single-currency cash-flow selection
prevent precision/unit/tenant loss. Pages expose errors, format exact currencies,
export explicit currency columns and keep reconciliation totals per currency.
Actual API-key/MCP/disposable PostgreSQL fixtures cover legacy/exact bank writers,
limits, calendars, isolation and unchanged financial snapshots. No schema/history/
IRR gate change; MON-104/MON-029 retain combined acceptance.

## MON-118 recurring, calendar and duplicate reports

[OPERATIONAL_REPORT_WIRE_CONTRACTS](OPERATIONAL_REPORT_WIRE_CONTRACTS.md) maps all
three REST/MCP pairs. Shared scoped read-only snapshots project SQL-text money and
bigint averages/products into safe numeric integers and matching Minor strings.
Strict inputs, live bank ownership, independently scoped contacts and separate
currency groups/events prevent precision, unit and tenant loss. Calendar projects
the full bounded horizon with saved UTC scheduling and occurrence limits. Pages
show errors and currency-aware exact formatting. Actual API-key/MCP/PostgreSQL
fixtures cover legacy/exact writers, signed/source/derived limits and unchanged
financial state. No schema/history/IRR rollout; MON-104/MON-029 retain combined
and independent acceptance.

## MON-123 budget notification adoption

[BUDGET_ALERT_WIRE_CONTRACTS](BUDGET_ALERT_WIRE_CONTRACTS.md) maps the scoped
REST/MCP check operation, threshold configuration, internal scheduled consumer and
notification delivery. SQL-text/bigint absolute net actuals and exact rounded
threshold products retain numeric compatibility plus agreeing Minor aliases.
Organization/period/reference guards and full-slice preflight protect atomic
recipient writes; a shared transaction lock prevents concurrent duplicates.
Bodies use organization currency scales without rescaling saved amounts. Optional
email/digest delivery follows commit and is best effort. No schema/history/IRR
rollout; MON-105/MON-029 retain combined and independent qualification.


## MON-031 payment providers and outgoing webhooks

[PROVIDER_WEBHOOK_WIRE_CONTRACTS](PROVIDER_WEBHOOK_WIRE_CONTRACTS.md) inventories
public/MCP invoice and subscription checkouts, native signed webhook objects,
Stripe CSV/sync/retry/reconciliation and outgoing delivery. Exact CSV decimals
and Minor columns preserve currency units; native provider payloads stay native.
Shared scoped posting transactions and numbering roll back invalid provider
amounts/fees and referenced entities; settlement verifies paid totals and saved
invoice balances with concurrent replay protection. Local reconciliation/mapping
DTOs carry numeric/Minor money plus currency, while outgoing opaque JSON uses
safe canonical signed bytes for initial/retry delivery. Qualified same-scale
currencies, conservative checkout limits and explicit no-FX policy are recorded.
Actual REST/MCP/PostgreSQL fixtures mock all external provider/delivery calls.
No schema/history/IRR rollout; MON-016 retains combined qualification.
