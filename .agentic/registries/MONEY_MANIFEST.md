# Money and FX boundary manifest

Inventory owner: MON-001. Refreshed 2026-10-03 (Asia/Tehran) for MON-037 against entry HEAD `6c49155`; changes remain uncommitted. MON-002 supplies the exact-money core; MON-003 widens monetary storage with a guarded safe-number compatibility adapter; MON-004 expands exact FX storage; MON-011 adds wire foundations; MON-013 adopts the currency FX slice. Rollout flags remain unchanged.

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

The [column appendix](MONEY_COLUMNS.md) has one row per actual numeric/JSON column: SQL table/column, Drizzle property, source line, type/range, units, currency source and migration owner. Refreshed for MON-035, the [machine-readable consumer index](MONEY_BOUNDARIES.json) contains 410 columns and 1,109 consumer files with line numbers, search tags, source hashes, currency context, range and owner. It scans 1,332 tracked and new nonignored source/config/documentation files and retains 21,618 lexical occurrences. All exported Drizzle numeric/JSON columns independently match the appendix, with no missing, extra or duplicate rows. The MON-003 disposition retains its historical 402-column scope.

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
