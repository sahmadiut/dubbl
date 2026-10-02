# Money and FX boundary manifest

Inventory owner: MON-001. Refreshed 2026-10-02 (Asia/Tehran) for MON-003 against entry HEAD `cd124c7`. MON-002 supplies the exact-money core; MON-003 widens monetary storage with a guarded safe-number compatibility adapter. Rollout flags remain unchanged.

## MON-003 storage expansion

All 194 money columns and the method-dependent landed-cost basis now declare PostgreSQL bigint through `moneyInteger()`. The [migration disposition](MONEY_BIGINT_MIGRATION.json) covers all 402 inventory columns with explicit before/after types and retained exclusions. Migration `0005_clear_senator_kelly` groups 195 identity casts into 88 table rewrites; values, defaults, nullability and units stay unchanged. The [migration runbook](../../lib/db/MONEY_MIGRATION.md) records locking, size, backup/recovery and compatibility limits. Schema declarations and committed migrations are updated; the configured local DB and production have not been migrated.

The adapter retains exact number values for existing callers within the safe integer range and rejects unsafe reads/writes rather than rounding. Full bigint domain adoption, raw SQL/aggregate safety, wire strings and user-facing arithmetic remain MON-006/007/008 work. This is not IRR production qualification.

## MON-002 primitive implementation

`lib/money/exact.ts` supplies currency-tagged bigint amounts with signed int64 final bounds, strict decimal parsing, exact decimal output, addition/subtraction/sums, rational multiplication, decimal-percent tax and largest-remainder allocation. Parsing/tax/multiplication require an explicit rounding mode, including rejection of fractional minor units. Allocation conserves signed totals, with input-order remainder ties and mirrored refunds. Frozen scales in `lib/money/scales.ts` decouple arithmetic from runtime ICU upgrades. See [core contract](../../lib/money/README.md) and [attempt evidence](../evidence/MON-002-attempt-1.md).

Deprecated `lib/money.ts` functions preserve their behavior for existing consumers. ESLint enforces imported-binding reference ceilings from `scripts/legacy-money-baseline.json`, blocking new imports/uses; static analysis limits are documented in the core contract. Safe-number bridges explicitly reject precision loss. This is not application-wide adoption: the remaining Number-based ledger/FX/public/UI paths retain their assigned MON-004/006/007/008 work, and IRR production readiness remains disabled.

The [column appendix](MONEY_COLUMNS.md) has one row per actual numeric/JSON column: SQL table/column, Drizzle property, source line, type/range, units, currency source and migration owner. Refreshed for MON-003, the [machine-readable consumer index](MONEY_BOUNDARIES.json) contains those 402 columns and 1,078 consumer files with line numbers, search tags, source hashes, currency context, range and owner. It scans 1,293 tracked and new nonignored source/config/documentation files and retains 20,687 lexical occurrences. All exported Drizzle numeric/JSON columns independently match the appendix, with no missing, extra or duplicate rows.

`python .agentic/scripts/money_inventory.py` checks source reproducibility; `--write` refreshes after reviewed changes. `node --import tsx .agentic/scripts/verify_money_inventory.mjs` checks actual Drizzle exports, column lines, consumer hashes and occurrence lines. Neither reads environment credentials or connects to DB. These are mutable registries; completed task evidence remains immutable.

## Units, ranges and owners

- 194 monetary columns and one method-dependent landed-cost basis now declare PostgreSQL signed bigint: -9223372036854775808 through 9223372036854775807. Existing minor-unit values are unchanged by the migration; the transitional ORM supports only exact safe-number reads/writes. Legacy REST/MCP descriptions generally say cents; currency-aware display does not establish correct input scaling. USD 1250 remains 1250.
- JS integer precision is limited to +/-9007199254740991. Products and sums can lose correctness before a write. `.int()` alone does not impose the DB bound. SQL sum(integer) can exceed individual row range; downstream Number coercion and explicit `::int` need independent review. Appendix ranges are physical limits, not promises that every endpoint validates them.
- `exchangeRate.rate`, `journalLine.exchangeRate` and `consolidationRate.rate` are int32 millionths. Maximum positive multiplier: 2147.483647; tiny reciprocals can round to zero. `payrollItem.fxRate` is approximate PostgreSQL real (binary32), an **unscaled** local-to-base multiplier. All four need MON-004 backfill, each from its actual representation.
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
| rate-provider / rate-sync | Provider RateFeed contains unscaled JS numbers; per-run cache and triangulation to org base precede millionths storage. Manual rates take precedence. Same-currency 1:1 is intentional. Provider support is not verified by source comments. | MON-004/005 |
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

This inventory is source coverage plus local read-only cohort counts, not successful runtime qualification of every workflow. Mixed-unit profiles, inheritance and currency-policy gaps are findings assigned to migration owners. A lexical match is not automatically a bug, and absence of one is not transitive dataflow proof. Generic forwarding/opaque JSON/external contracts need MON-006/008/010 integration coverage. No live provider capability, official currency rule, new statutory compliance, production approval or rounding policy is asserted. No build/dev server/schema generation/deployment/migration is needed for these audit-only changes.
