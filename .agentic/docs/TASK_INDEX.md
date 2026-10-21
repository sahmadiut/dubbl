# Task index

Generated initial scope index; current status always comes from task metadata via `agent.py status`.

## Explicit IRR qualification and activation

Added on 2026-10-21 at the owner's request. Follow the
[readiness map](../registries/IRR_READINESS.md); these tasks do not automatically
complete broader QA/release gates or change the runtime IRR flag. The owner
subsequently scheduled the IRR sequence after localization: IRR-001 waits for
RTL-002 and L10N-012, and IRR-001..003 now belong to phase 8.

| ID | Phase | Task | Role | Optional |
|---|---:|---|---|---|
| [IRR-001](../tasks/IRR-001.md) | 08 | Establish the current IRR financial qualification baseline | qa | no |
| [IRR-002](../tasks/IRR-002.md) | 08 | Rehearse IRR backup restore and financial rollback | database | no |
| [IRR-003](../tasks/IRR-003.md) | 08 | Qualify IRR selection controls and Persian money entry | backend | no |
| [IRR-004](../tasks/IRR-004.md) | 09 | Prepare the qualified opt-in IRR release candidate | lead | no |
| [IRR-005](../tasks/IRR-005.md) | 09 | Activate approved IRR and verify the target organization | devops | no |

## Persian currency-unit display

Owner extension, 2026-10-21: [LOC-115](../tasks/LOC-115.md), phase 03, frontend,
mandatory: localize currency-unit names throughout website pages. In fa-IR,
IRR displays as "????"; canonical ISO codes and exact amounts stay unchanged.
This follows LOC-003 and gates RTL-001 and L10N-012. Existing numeric,
currency-workspace and glossary tasks do not own this cross-page adoption.

## Existing project scope

| ID | Phase | Task | Role | Optional |
|---|---:|---|---|---|
| [AUD-001](../tasks/AUD-001.md) | 00 | Inspect and freeze the actual fork baseline | lead | no |
| [AUD-002](../tasks/AUD-002.md) | 00 | Reproduce development and production baselines | devops | no |
| [AUD-003](../tasks/AUD-003.md) | 00 | Establish provenance and license policy | lead | no |
| [AUD-004](../tasks/AUD-004.md) | 00 | Audit all Bigcapital capability groups | accounting | no |
| [AUD-005](../tasks/AUD-005.md) | 00 | Confirm optional scope and review parity baseline | lead | no |
| [CI-001](../tasks/CI-001.md) | 01 | Establish reproducible CI and database fixtures | devops | no |
| [CI-002](../tasks/CI-002.md) | 01 | Record architecture boundaries and rollout flags | lead | no |
| [MON-001](../tasks/MON-001.md) | 02 | Inventory every money and rate boundary | backend | no |
| [MON-002](../tasks/MON-002.md) | 02 | Implement canonical exact-money operations | backend | no |
| [MON-003](../tasks/MON-003.md) | 02 | Expand all monetary columns to bigint | database | no |
| [MON-004](../tasks/MON-004.md) | 02 | Migrate FX storage with exact backfill | database | no |
| [MON-005](../tasks/MON-005.md) | 02 | Implement historical FX and provider validation | backend | no |
| [MON-006](../tasks/MON-006.md) | 02 | Evolve API and serialization compatibility (integration parent) | backend | no |
| [MON-011](../tasks/MON-011.md) | 02 | Implement exact wire primitives and shared transport guards | backend | no |
| [MON-012](../tasks/MON-012.md) | 02 | Roll out exact API and MCP boundary contracts | backend | no |
| [MON-013](../tasks/MON-013.md) | 02 | Adopt exact aliases at currency FX boundaries | backend | no |
| [MON-014](../tasks/MON-014.md) | 02 | Adopt exact contracts at core accounting boundaries | backend | no |
| [MON-015](../tasks/MON-015.md) | 02 | Adopt exact contracts at auxiliary and report boundaries | backend | no |
| [MON-016](../tasks/MON-016.md) | 02 | Adopt exact contracts at public and opaque boundaries | backend | no |
| [MON-017](../tasks/MON-017.md) | 02 | Adopt exact contact credit-limit and balance contracts | backend | no |
| [MON-018](../tasks/MON-018.md) | 02 | Adopt exact journal and recurring journal contracts | backend | no |
| [MON-019](../tasks/MON-019.md) | 02 | Adopt exact receivable document contracts | backend | no |
| [MON-020](../tasks/MON-020.md) | 02 | Adopt exact payable and procurement contracts | backend | no |
| [MON-021](../tasks/MON-021.md) | 02 | Adopt exact payment expense and banking contracts | backend | no |
| [MON-022](../tasks/MON-022.md) | 02 | Adopt exact organization and tax configuration contracts | backend | no |
| [MON-023](../tasks/MON-023.md) | 02 | Adopt exact budget CRUD contracts | backend | no |
| [MON-024](../tasks/MON-024.md) | 02 | Adopt exact inventory and costing contracts | backend | no |
| [MON-025](../tasks/MON-025.md) | 02 | Adopt exact payroll contracts | backend | no |
| [MON-026](../tasks/MON-026.md) | 02 | Adopt exact asset and loan contracts | backend | no |
| [MON-027](../tasks/MON-027.md) | 02 | Adopt exact project CRM and pricing contracts | backend | no |
| [MON-028](../tasks/MON-028.md) | 02 | Adopt exact consolidation and auxiliary configuration contracts | backend | no |
| [MON-029](../tasks/MON-029.md) | 02 | Adopt exact report and dashboard contracts | backend | no |
| [MON-007](../tasks/MON-007.md) | 02 | Cut over core accounting consumers | backend | no |
| [MON-008](../tasks/MON-008.md) | 02 | Cut over auxiliary and public money consumers | backend | no |
| [MON-009](../tasks/MON-009.md) | 02 | Implement currency regimes and explicit IRR metadata | backend | no |
| [MON-010](../tasks/MON-010.md) | 02 | Qualify money migration and unlock IRR readiness | qa | no |
| [LOC-001](../tasks/LOC-001.md) | 03 | Add locale preferences without changing URLs | frontend | no |
| [LOC-002](../tasks/LOC-002.md) | 03 | Extract English catalog and add ICU validation | frontend | no |
| [LOC-003](../tasks/LOC-003.md) | 03 | Build strict localized numeric input and formatting | frontend | no |
| [LOC-004](../tasks/LOC-004.md) | 03 | Add Persian calendar adapters and pickers | frontend | no |
| [RTL-001](../tasks/RTL-001.md) | 04 | Implement root direction and shared primitives | frontend | no |
| [RTL-002](../tasks/RTL-002.md) | 04 | Harden forms tables typography and mixed text | frontend | no |
| [PAR-001](../tasks/PAR-001.md) | 05 | Implement vendor-credit posting lifecycle | backend | no |
| [PAR-002](../tasks/PAR-002.md) | 05 | Implement vendor-credit allocation to bills | backend | no |
| [PAR-003](../tasks/PAR-003.md) | 05 | Implement vendor-credit refunds | backend | no |
| [PAR-004](../tasks/PAR-004.md) | 05 | Close customer credit and receipt workflow gaps | backend | no |
| [PAR-005](../tasks/PAR-005.md) | 05 | Close inventory tax and costing parity gaps | backend | no |
| [PAR-006](../tasks/PAR-006.md) | 05 | Add branches if product scope requires them | backend | yes |
| [PAR-007](../tasks/PAR-007.md) | 05 | Audit auth roles API keys and public payment links | security | no |
| [PAR-008](../tasks/PAR-008.md) | 05 | Close named report and dashboard gaps | backend | no |
| [DATA-001](../tasks/DATA-001.md) | 06 | Implement generalized import jobs | backend | no |
| [DATA-002](../tasks/DATA-002.md) | 06 | Standardize CSV and spreadsheet exports | backend | no |
| [DATA-003](../tasks/DATA-003.md) | 06 | Add reusable saved views and bulk operations | frontend | no |
| [DATA-004](../tasks/DATA-004.md) | 06 | Close bank rules states and matching gaps | backend | no |
| [DATA-005](../tasks/DATA-005.md) | 06 | Define optional bank-feed provider boundary | backend | yes |
| [DATA-006](../tasks/DATA-006.md) | 06 | Implement an approved optional banking connector | backend | yes |
| [DATA-007](../tasks/DATA-007.md) | 06 | Review SaaS and miscellaneous API scope | lead | yes |
| [L10N-001](../tasks/L10N-001.md) | 07 | Approve the accounting terminology glossary | accounting | no |
| [L10N-002](../tasks/L10N-002.md) | 07 | Localize accounting and dashboard | frontend | no |
| [L10N-003](../tasks/L10N-003.md) | 07 | Localize sales and receivables | frontend | no |
| [L10N-004](../tasks/L10N-004.md) | 07 | Localize purchasing and payables | frontend | no |
| [L10N-005](../tasks/L10N-005.md) | 07 | Localize banking and inventory | frontend | no |
| [L10N-006](../tasks/L10N-006.md) | 07 | Localize reports and data tooling | frontend | no |
| [L10N-007](../tasks/L10N-007.md) | 07 | Localize payroll projects and CRM | frontend | no |
| [L10N-008](../tasks/L10N-008.md) | 07 | Localize settings and authentication | frontend | no |
| [L10N-009](../tasks/L10N-009.md) | 07 | Localize customer portal payment and signing | frontend | no |
| [L10N-010](../tasks/L10N-010.md) | 07 | Localize transactional email and help errors | frontend | no |
| [L10N-011](../tasks/L10N-011.md) | 07 | Qualify Persian PDF documents | frontend | no |
| [L10N-012](../tasks/L10N-012.md) | 07 | Complete native linguistic and UX acceptance | accounting | no |
| [QA-001](../tasks/QA-001.md) | 08 | Run bilingual accounting and API qualification | qa | no |
| [QA-002](../tasks/QA-002.md) | 08 | Audit security privacy and provider constraints | security | no |
| [QA-003](../tasks/QA-003.md) | 08 | Qualify accessibility and visual regressions | qa | no |
| [QA-004](../tasks/QA-004.md) | 08 | Qualify performance and background workloads | qa | no |
| [QA-005](../tasks/QA-005.md) | 08 | Rehearse migration backup restore and rollback | database | no |
| [REL-001](../tasks/REL-001.md) | 09 | Prepare release evidence and deployment runbooks | devops | no |
| [REL-002](../tasks/REL-002.md) | 09 | Approve release candidate and canary plan | lead | no |
| [REL-003](../tasks/REL-003.md) | 09 | Execute authorized canary and production acceptance | devops | no |
| [REL-004](../tasks/REL-004.md) | 09 | Close migration compatibility window safely | database | no |
| [OPS-001](../tasks/OPS-001.md) | 10 | Perform the first scheduled maintenance review | lead | no |

## MON-016 implementation children

| ID | Task | Role | Optional |
|---|---|---|---|
| [MON-030](../tasks/MON-030.md) | Adopt exact public payment-link and portal JSON contracts | backend | no |
| [MON-031](../tasks/MON-031.md) | Adopt exact payment provider and webhook contracts | backend | no |
| [MON-032](../tasks/MON-032.md) | Adopt exact backup snapshot and restore contracts | backend | no |
| [MON-033](../tasks/MON-033.md) | Adopt exact generic import and export contracts | backend | no |
| [MON-034](../tasks/MON-034.md) | Qualify remaining opaque and public rendering boundaries | backend | no |

## MON-018 implementation children

| ID | Task | Role | Optional |
|---|---|---|---|
| [MON-035](../tasks/MON-035.md) | Adopt exact journal CRUD contracts | backend | no |
| [MON-036](../tasks/MON-036.md) | Adopt exact journal lifecycle and bulk import contracts | backend | no |
| [MON-037](../tasks/MON-037.md) | Adopt exact recurring journal contracts | backend | no |

## MON-019 implementation children

| ID | Task | Role | Optional |
|---|---|---|---|
| [MON-038](../tasks/MON-038.md) | Adopt exact invoice read contracts | backend | no |
| [MON-039](../tasks/MON-039.md) | Adopt exact invoice CRUD write contracts | backend | no |
| [MON-040](../tasks/MON-040.md) | Adopt exact invoice lifecycle contracts | backend | no |
| [MON-041](../tasks/MON-041.md) | Adopt exact quote contracts | backend | no |
| [MON-042](../tasks/MON-042.md) | Adopt exact receivable credit contracts | backend | no |
| [MON-043](../tasks/MON-043.md) | Adopt exact sales receipt contracts | backend | no |
| [MON-044](../tasks/MON-044.md) | Adopt exact recurring invoice contracts | backend | no |
| [MON-045](../tasks/MON-045.md) | Adopt exact invoice bulk contracts | backend | no |

## MON-020 implementation children

| ID | Task | Role | Optional |
|---|---|---|---|
| [MON-046](../tasks/MON-046.md) | Adopt exact bill read contracts | backend | no |
| [MON-047](../tasks/MON-047.md) | Adopt exact bill CRUD write contracts | backend | no |
| [MON-048](../tasks/MON-048.md) | Adopt exact bill lifecycle contracts | backend | no |
| [MON-049](../tasks/MON-049.md) | Adopt exact purchase order contracts | backend | no |
| [MON-050](../tasks/MON-050.md) | Adopt exact purchase requisition contracts | backend | no |
| [MON-051](../tasks/MON-051.md) | Adopt exact payable debit note contracts | backend | no |
| [MON-052](../tasks/MON-052.md) | Adopt exact goods receipt contracts | backend | no |
| [MON-053](../tasks/MON-053.md) | Adopt exact bill bulk contracts | backend | no |
| [MON-054](../tasks/MON-054.md) | Adopt exact procurement setting contracts | backend | no |

## Payment, expense and banking contract slices

| Task | Outcome | Role | Optional |
|---|---|---|---|
| [MON-055](../tasks/MON-055.md) | Adopt exact payment read contracts | backend | no |
| [MON-056](../tasks/MON-056.md) | Adopt exact payment settlement contracts | backend | no |
| [MON-057](../tasks/MON-057.md) | Adopt exact payment reversal contracts | backend | no |
| [MON-058](../tasks/MON-058.md) | Adopt exact payment batch contracts | backend | no |
| [MON-059](../tasks/MON-059.md) | Adopt exact scheduled payment contracts | backend | no |
| [MON-060](../tasks/MON-060.md) | Adopt exact expense CRUD contracts | backend | no |
| [MON-061](../tasks/MON-061.md) | Adopt exact expense claim lifecycle contracts | backend | no |
| [MON-062](../tasks/MON-062.md) | Adopt exact bank account contracts | backend | no |
| [MON-063](../tasks/MON-063.md) | Adopt exact bank transaction read contracts | backend | no |
| [MON-064](../tasks/MON-064.md) | Adopt exact bank import contracts | backend | no |
| [MON-065](../tasks/MON-065.md) | Adopt exact bank categorization contracts | backend | no |
| [MON-066](../tasks/MON-066.md) | Adopt exact bank document matching contracts | backend | no |
| [MON-067](../tasks/MON-067.md) | Adopt exact bank transfer contracts | backend | no |
| [MON-068](../tasks/MON-068.md) | Adopt exact bank reconciliation contracts | backend | no |
| [MON-069](../tasks/MON-069.md) | Adopt exact bank rule contracts | backend | no |
| [MON-070](../tasks/MON-070.md) | Adopt exact organization settings contracts | backend | no |
| [MON-071](../tasks/MON-071.md) | Adopt bounded tax rate and profile contracts | backend | no |
| [MON-072](../tasks/MON-072.md) | Adopt exact tax period contracts | backend | no |
| [MON-073](../tasks/MON-073.md) | Adopt exact approval condition contracts | backend | no |

## Inventory contract slices

| Task | Outcome | Role | Optional |
|---|---|---|---|
| [MON-074](../tasks/MON-074.md) | Adopt exact inventory variant and supplier contracts | backend | no |
| [MON-075](../tasks/MON-075.md) | Adopt exact inventory master and import contracts | backend | no |
| [MON-076](../tasks/MON-076.md) | Adopt exact inventory movement and warehouse contracts | backend | no |
| [MON-077](../tasks/MON-077.md) | Adopt exact inventory valuation and landed cost contracts | backend | no |
| [MON-078](../tasks/MON-078.md) | Adopt exact inventory assembly contracts | backend | no |

## Payroll contract children

| Task | Outcome | Role | Optional |
|---|---|---|---|
| [MON-079](../tasks/MON-079.md) | Exact payroll employee and contractor master contracts | backend | no |
| [MON-080](../tasks/MON-080.md) | Exact payroll settings, deduction and tax configuration contracts | backend | no |
| [MON-081](../tasks/MON-081.md) | Exact payroll time, leave and shift contracts | backend | no |
| [MON-082](../tasks/MON-082.md) | Exact payroll pay run and lifecycle contracts | backend | no |
| [MON-083](../tasks/MON-083.md) | Exact payroll contractor and tax payment contracts | backend | no |
| [MON-084](../tasks/MON-084.md) | Exact payroll compensation and forecasting contracts | backend | no |
| [MON-085](../tasks/MON-085.md) | Exact payroll report, payslip and tax form contracts | backend | no |

MON-026 retains integrated asset/loan acceptance after MON-086 masters, MON-087 depreciation, MON-088 valuation/disposal, MON-089 CWIP and MON-090 loans/schedules/payment. All children inherit MON-011 and migration/API source sections; original parent criteria remain unchanged.

## MON-027 bounded contract children

Source inspection split projects/CRM/pricing without reducing parent acceptance.

- [MON-091](../tasks/MON-091.md): Adopt exact price-list and resolution contracts.
- [MON-092](../tasks/MON-092.md): Adopt exact CRM deal and analytics contracts.
- [MON-093](../tasks/MON-093.md): Adopt exact project master and time contracts.
- [MON-094](../tasks/MON-094.md): Adopt exact project billing and profitability contracts.

## MON-028 bounded contract children

MON-028 retains combined acceptance with unchanged criteria; all children inherit MON-011 and migration/API compatibility source sections.

- [MON-095](../tasks/MON-095.md): Adopt consolidation group, member and elimination rule contracts.
- [MON-096](../tasks/MON-096.md): Adopt exact consolidation translation and report contracts.
- [MON-097](../tasks/MON-097.md): Adopt exact accrual schedule and posting contracts.
- [MON-098](../tasks/MON-098.md): Adopt exact revenue schedule and recognition contracts.
- [MON-099](../tasks/MON-099.md): Adopt exact recurring payable document contracts.

## MON-029 report contract children

| Task | Phase | Outcome | Role | Human review |
|---|---|---|---|---|
| [MON-100](../tasks/MON-100.md) | 02 | Adopt exact budget comparison report contracts | backend | no |
| [MON-101](../tasks/MON-101.md) | 02 | Adopt exact financial statement and ledger reports | backend | no |
| [MON-102](../tasks/MON-102.md) | 02 | Adopt exact aging and contact statement reports | backend | no |
| [MON-103](../tasks/MON-103.md) | 02 | Adopt exact tax and regulatory reports | backend | no |
| [MON-104](../tasks/MON-104.md) | 02 | Adopt exact operational analytics reports | backend | no |
| [MON-105](../tasks/MON-105.md) | 02 | Adopt exact dashboard and saved report contracts | backend | no |


## MON-101 bounded financial report children

MON-101 retains all original acceptance after the five children; all trace to migration/API compatibility.

- [MON-106](../tasks/MON-106.md): Adopt exact cumulative financial statement contracts.
- [MON-107](../tasks/MON-107.md): Adopt exact period financial statement contracts.
- [MON-108](../tasks/MON-108.md): Adopt exact ledger detail report contracts.
- [MON-109](../tasks/MON-109.md): Adopt exact cash flow report contracts.
- [MON-110](../tasks/MON-110.md): Adopt exact compound financial report contracts.


## MON-102 bounded report and statement children

MON-102 retains every original integration criterion and depends on these children.

- [MON-111](../tasks/MON-111.md): Adopt exact aged receivable and payable reports.
- [MON-112](../tasks/MON-112.md): Adopt exact contact statements and delivery.
- [MON-113](../tasks/MON-113.md): Adopt exact payment-performance analytics.


## MON-104 bounded operational report children

MON-104 retains every original criterion and inventory valuation integration. All children inherit MON-011 and trace to migration/API compatibility.

- [MON-114](../tasks/MON-114.md): Adopt exact spend and sales analytics.
- [MON-115](../tasks/MON-115.md): Adopt exact expense and KPI analytics.
- [MON-116](../tasks/MON-116.md): Adopt exact cash forecasts and unrealized FX reports.
- [MON-117](../tasks/MON-117.md): Adopt exact bank analytics reports.
- [MON-118](../tasks/MON-118.md): Adopt exact recurring calendar and duplicate reports.

## MON-105 bounded dashboard and report children

MON-105 retains all original integration criteria. Each child inherits MON-011 and the migration/API compatibility source sections.

- [MON-119](../tasks/MON-119.md): Adopt exact dashboard widget and action alert contracts.
- [MON-120](../tasks/MON-120.md): Adopt safe dashboard layout contracts.
- [MON-121](../tasks/MON-121.md): Adopt exact custom and saved report contracts.
- [MON-122](../tasks/MON-122.md): Adopt exact report schedule and delivery contracts.
- [MON-123](../tasks/MON-123.md): Adopt exact budget notification contracts.

## MON-034 bounded opaque and rendering children

MON-034 retains its original integration criteria. Children inherit MON-011 and migration/API compatibility sections.

- [MON-124](../tasks/MON-124.md): Adopt safe invoice snapshot correction contracts.
- [MON-125](../tasks/MON-125.md): Qualify remaining opaque JSON and administrative forwarding.
- [MON-126](../tasks/MON-126.md): Adopt safe public invoice signing contracts.
- [MON-127](../tasks/MON-127.md): Qualify remaining SSR and PDF monetary bridges.

## MON-007 core consumer cutover children

MON-007 retains its original acceptance criteria and independent combined verification.

- [MON-128](../tasks/MON-128.md): Cut over shared core posting arithmetic.
- [MON-129](../tasks/MON-129.md): Cut over core money editors and presentation; split further if verified scope requires it.
- [MON-130](../tasks/MON-130.md): Manual and recurring journal UI money.
- [MON-131](../tasks/MON-131.md): Receivable document UI money.
- [MON-132](../tasks/MON-132.md): Payable and procurement UI money.
- [MON-133](../tasks/MON-133.md): Core cash, tax, account ledger and opening balance UI money.

MON-131 is split into bounded receivable consumers and retains final integration:

- [MON-134](../tasks/MON-134.md): Shared line editor and invoice creation money.
- [MON-135](../tasks/MON-135.md): Invoice list, detail and settlement UI money.
- [MON-136](../tasks/MON-136.md): Quote, credit, receipt and prepayment UI money.
- [MON-137](../tasks/MON-137.md): Recurring invoice UI money.


MON-132 retains independent payable/procurement integration after these source-verified UI children:

- [MON-138](../tasks/MON-138.md): Cut over bill creation UI money.
- [MON-139](../tasks/MON-139.md): Cut over saved bill lifecycle UI money.
- [MON-140](../tasks/MON-140.md): Cut over debit note UI money.
- [MON-141](../tasks/MON-141.md): Cut over procurement document UI money.
- [MON-142](../tasks/MON-142.md): Cut over recurring bill UI money.

MON-136 retains independent combined acceptance after these verified domain slices:

- [MON-143](../tasks/MON-143.md): Quote creation and lifecycle UI money.
- [MON-144](../tasks/MON-144.md): Credit note UI money.
- [MON-145](../tasks/MON-145.md): Sales receipt UI money.
- [MON-146](../tasks/MON-146.md): Customer prepayment UI money.

## MON-133 bounded core UI slices

- [MON-147](../tasks/MON-147.md): Cut over opening balance UI money.
- [MON-148](../tasks/MON-148.md): Cut over payment and allocation UI money.
- [MON-149](../tasks/MON-149.md): Cut over expense and mileage UI money.
- [MON-150](../tasks/MON-150.md): Cut over banking and reconciliation UI money.
- [MON-151](../tasks/MON-151.md): Cut over tax and core settings UI money.
- [MON-152](../tasks/MON-152.md): Cut over account ledger and shared core presentation.

## MON-008 auxiliary/public consumer split

Original MON-008 criteria and independent combined acceptance remain open. Source-verified children retain api-backward-compatibility and database-and-currency-migration coverage:

- [MON-153](../tasks/MON-153.md): Cut over inventory detail and write-down UI money.
- [MON-154](../tasks/MON-154.md): Cut over remaining inventory UI money.
- [MON-155](../tasks/MON-155.md): Cut over payroll UI money.
- [MON-156](../tasks/MON-156.md): Cut over asset and loan UI money.
- [MON-157](../tasks/MON-157.md): Cut over budget project and CRM UI money.
- [MON-158](../tasks/MON-158.md): Cut over auxiliary report dashboard and contact money.
- [MON-159](../tasks/MON-159.md): Verify and cut over remaining background money consumers.
- [MON-160](../tasks/MON-160.md): Cut over public rendering export and provider money consumers.

## MON-158 bounded report and contact slices

MON-158 retains its original criteria and final integration acceptance. These children trace to api-backward-compatibility and database-and-currency-migration.

- [MON-161](../tasks/MON-161.md): Cut over cumulative and period financial statement UI money.
- [MON-162](../tasks/MON-162.md): Cut over remaining auxiliary report UI money.
- [MON-163](../tasks/MON-163.md): Cut over contact dashboard and shared report display money.

## MON-159 bounded background slices

MON-159 retains original criteria and independent final integration acceptance.

- [MON-164](../tasks/MON-164.md): Cut over scheduled bookkeeping and auto-reversal money consumers.
- [MON-165](../tasks/MON-165.md): Cut over FX revaluation and verify remaining background composition.

## MON-162 report contract slices

Parent criteria remain open; all children cover api-backward-compatibility and database-and-currency-migration.

- [MON-166](../tasks/MON-166.md): Cut over ledger cash-flow and aging UI money.
- [MON-167](../tasks/MON-167.md): Cut over tax tracking consolidation and custom report UI money.
- [MON-168](../tasks/MON-168.md): Cut over analytical and bank report UI money.

## LOC-002 catalog extraction split

Original parent criteria and independent integration acceptance remain open. All
children trace to farsi-i18nl10n-strategy and
required-configuration-files-resource-examples-and-testing-ready-implementation-details.

- [LOC-005](../tasks/LOC-005.md): Catalog validation and complete preference messages.
- [LOC-006](../tasks/LOC-006.md): Shell, authentication and settings extraction.
- [LOC-007](../tasks/LOC-007.md): Accounting, sales and purchasing extraction.
- [LOC-008](../tasks/LOC-008.md): Operations and reporting extraction.
- [LOC-009](../tasks/LOC-009.md): Public, document and background extraction.

See [catalog contracts](../registries/MESSAGE_CATALOGS.md) for current coverage and
limits. Later native terminology and RTL workflow acceptance stay with L10N/RTL.

## LOC-006 extraction split

Source inspection separates authentication/onboarding, shared shell, settings and administration into reviewable slices. LOC-006 retains combined acceptance.

- [LOC-010](../tasks/LOC-010.md): Extract authentication onboarding and invitation catalogs.
- [LOC-011](../tasks/LOC-011.md): Extract shared shell and UI primitive catalogs.
- [LOC-012](../tasks/LOC-012.md): Extract settings configuration catalogs.
- [LOC-013](../tasks/LOC-013.md): Extract teams administration and notification catalogs.

## LOC-012 settings extraction split

Verified source scope: 23 settings TSX files totaling over 10,000 lines. LOC-012
retains independent combined acceptance after these bounded children.

- [LOC-014](../tasks/LOC-014.md): Core navigation, general, procurement, cost centers and tags.
- [LOC-015](../tasks/LOC-015.md): Settings automation and notification preferences.
- [LOC-016](../tasks/LOC-016.md): Settings access and audit.
- [LOC-017](../tasks/LOC-017.md): Settings providers, documents and data management.


## AI agent and administration extension (2026-10-17)

Owner-requested backlog; see [delivery plan](../docs/AI_AGENT_PLAN.md) and [requirements](../sources/SOURCE.md#ai-agent-and-administration-owner-extension). Phase 11, priority 2; AI-001 depends on all currently unfinished pre-existing tasks, so localization and the rest of the existing backlog finish first. Task files remain the status source.

- [AI-001](../tasks/AI-001.md): Define agent capability inventory and execution contracts.
- [AI-002](../tasks/AI-002.md): Enforce live identity and permissions for agent tool calls.
- [AI-003](../tasks/AI-003.md): Persist scoped conversations runs and tool execution state.
- [AI-004](../tasks/AI-004.md): Manage AI provider credentials models and configuration.
- [AI-005](../tasks/AI-005.md): Meter token usage costs and enforce concurrent budgets.
- [AI-006](../tasks/AI-006.md): Build authorized domain tool registry and guarded dispatch.
- [AI-007](../tasks/AI-007.md): Implement durable bounded multi-step agent execution.
- [AI-008](../tasks/AI-008.md): Add action previews approvals and resumable execution.
- [AI-009](../tasks/AI-009.md): Build bilingual agent chat and action timeline.
- [AI-010](../tasks/AI-010.md): Build provider and agent policy administration UI.
- [AI-011](../tasks/AI-011.md): Build scoped AI usage and operations dashboard.
- [AI-012](../tasks/AI-012.md): Qualify agent security privacy and workflow reliability.
- [AI-013](../tasks/AI-013.md): Accept integrated AI agent and controlled rollout.

## LOC-017 provider/document/data split

LOC-017 retains combined acceptance; locale requirements remain unchanged.

- [LOC-018](../tasks/LOC-018.md): Billing and Stripe settings catalogs.
- [LOC-019](../tasks/LOC-019.md): Document template settings catalogs.
- [LOC-020](../tasks/LOC-020.md): Import/export, backups and trash catalogs.


## LOC-007 domain extraction split

Verified scope: 87 route TSX files plus shared forms/drawers. LOC-007 retains independent combined acceptance; all children preserve exact-money, REST/MCP and DEC-008 Stripe boundaries.

- [LOC-021](../tasks/LOC-021.md): Chart of accounts and accounting navigation.
- [LOC-022](../tasks/LOC-022.md): Journals and opening balances.
- [LOC-023](../tasks/LOC-023.md): Banking catalogs.
- [LOC-024](../tasks/LOC-024.md): Assets loans budgets and accrual catalogs.
- [LOC-025](../tasks/LOC-025.md): Sales catalogs.
- [LOC-026](../tasks/LOC-026.md): Purchasing catalogs.
- [LOC-027](../tasks/LOC-027.md): Contacts catalogs.
- [LOC-028](../tasks/LOC-028.md): Tax catalogs.

## LOC-023 banking extraction split

Verified scope: 11 route/shared TSX files (7,019 lines) plus banking drawers. LOC-023 retains independent combined acceptance. Shared _components.tsx ownership is divided between transaction workspace and import presentation; reconciliation owns its page. Preserve Stripe under DEC-008.

- [LOC-029](../tasks/LOC-029.md): Extract bank account catalogs.
- [LOC-030](../tasks/LOC-030.md): Extract bank transaction workspace catalogs.
- [LOC-031](../tasks/LOC-031.md): Extract bank import catalogs.
- [LOC-032](../tasks/LOC-032.md): Extract bank reconciliation catalogs.
- [LOC-033](../tasks/LOC-033.md): Extract bank payment scheduling and batch catalogs.

## LOC-025 sales extraction split

Verified source scope: 18 route TSX files (7,728 lines) plus shared forms and seven creation drawers. LOC-025 retains independent combined acceptance; all children preserve exact-money, REST/MCP and DEC-008 Stripe boundaries.

- [LOC-039](../tasks/LOC-039.md): Extract sales payment catalogs.
- [LOC-040](../tasks/LOC-040.md): Extract sales invoice catalogs.
- [LOC-041](../tasks/LOC-041.md): Extract sales quote catalogs.
- [LOC-042](../tasks/LOC-042.md): Extract cash sale catalogs.
- [LOC-043](../tasks/LOC-043.md): Extract sales credit note catalogs.
- [LOC-044](../tasks/LOC-044.md): Extract customer prepayment catalogs.
- [LOC-045](../tasks/LOC-045.md): Extract recurring invoice catalogs.
- [LOC-046](../tasks/LOC-046.md): Extract revenue schedule catalogs.
- [LOC-047](../tasks/LOC-047.md): Extract shared sales document catalogs.

## LOC-026 purchasing extraction split

Verified scope: 18 route TSX files (7,887 lines), plus shared forms/drawers. LOC-026 retains independent combined acceptance; shared ProcurementMoneyDetails belongs to LOC-048. Preserve exact-money, REST/MCP and DEC-008 boundaries.

- [LOC-048](../tasks/LOC-048.md): Extract goods receipt catalogs.
- [LOC-049](../tasks/LOC-049.md): Extract supplier bill catalogs.
- [LOC-050](../tasks/LOC-050.md): Extract recurring bill catalogs.
- [LOC-051](../tasks/LOC-051.md): Extract expense catalogs.
- [LOC-052](../tasks/LOC-052.md): Extract supplier debit note catalogs.
- [LOC-053](../tasks/LOC-053.md): Extract purchase requisition catalogs.
- [LOC-054](../tasks/LOC-054.md): Extract purchase order catalogs.
- [LOC-055](../tasks/LOC-055.md): Extract landed cost catalogs.
- [LOC-056](../tasks/LOC-056.md): Extract shared purchasing catalogs.

## LOC-027 contacts extraction split

Verified scope: nine route TSX files (2,965 lines including blanks), plus the shared contact picker and creation drawer. LOC-027 retains independent combined acceptance. Preserve exact-money, REST/MCP and DEC-008 boundaries.

- [LOC-057](../tasks/LOC-057.md): Extract contact people and files catalogs.
- [LOC-058](../tasks/LOC-058.md): Extract contact list and creation catalogs.
- [LOC-059](../tasks/LOC-059.md): Extract contact detail shell catalogs.
- [LOC-060](../tasks/LOC-060.md): Extract contact financial tab catalogs.

## LOC-008 operations and reporting catalog children

- [LOC-066](../tasks/LOC-066.md): Extract inventory catalogs.
- [LOC-067](../tasks/LOC-067.md): Extract payroll catalogs.
- [LOC-068](../tasks/LOC-068.md): Extract project catalogs.
- [LOC-069](../tasks/LOC-069.md): Extract CRM catalogs.
- [LOC-070](../tasks/LOC-070.md): Extract reporting catalogs.
- [LOC-071](../tasks/LOC-071.md): Extract dashboard and document catalogs.
- [LOC-072](../tasks/LOC-072.md): Extract inventory category catalogs.
- [LOC-073](../tasks/LOC-073.md): Extract inventory item catalogs.
- [LOC-074](../tasks/LOC-074.md): Extract inventory variant and supplier catalogs.
- [LOC-075](../tasks/LOC-075.md): Extract inventory warehouse catalogs.
- [LOC-076](../tasks/LOC-076.md): Extract inventory movement catalogs.
- [LOC-077](../tasks/LOC-077.md): Extract inventory assembly catalogs.
- [LOC-078](../tasks/LOC-078.md): Extract inventory valuation and alert catalogs.

## LOC-067 payroll catalog children

27 route components plus two creation drawers; parent retains independent combined acceptance.

- [LOC-079](../tasks/LOC-079.md): Extract payroll overview and navigation catalogs.
- [LOC-080](../tasks/LOC-080.md): Extract payroll employee list and creation catalogs.
- [LOC-081](../tasks/LOC-081.md): Extract payroll employee detail catalogs.
- [LOC-082](../tasks/LOC-082.md): Extract payroll contractor catalogs.
- [LOC-083](../tasks/LOC-083.md): Extract payroll run list and creation catalogs.
- [LOC-084](../tasks/LOC-084.md): Extract payroll run detail catalogs.
- [LOC-085](../tasks/LOC-085.md): Extract payroll payslip and tax form catalogs.
- [LOC-086](../tasks/LOC-086.md): Extract payroll time and leave configuration catalogs.
- [LOC-087](../tasks/LOC-087.md): Extract payroll leave and timesheet detail catalogs.
- [LOC-088](../tasks/LOC-088.md): Extract payroll self-service catalogs.
- [LOC-089](../tasks/LOC-089.md): Extract payroll compensation catalogs.
- [LOC-090](../tasks/LOC-090.md): Extract payroll analytics forecasting and reports catalogs.
- [LOC-091](../tasks/LOC-091.md): Extract payroll tax liability catalogs.
- [LOC-092](../tasks/LOC-092.md): Extract payroll settings catalogs.

## LOC-068 project catalog children

Verified 11 route TSX files totaling 5,262 lines plus a 242-line creation drawer; parent retains independent combined acceptance.

- [LOC-093](../tasks/LOC-093.md): Extract project list creation and settings catalogs.
- [LOC-094](../tasks/LOC-094.md): Extract project overview and navigation catalogs.
- [LOC-095](../tasks/LOC-095.md): Extract project task catalogs.
- [LOC-096](../tasks/LOC-096.md): Extract project time and billing catalogs.
- [LOC-097](../tasks/LOC-097.md): Extract project milestone catalogs.
- [LOC-098](../tasks/LOC-098.md): Extract project team and notes catalogs.

## LOC-069 CRM catalog children

Seven route TSX files plus DealDrawer; parent retains independent combined acceptance.

- [LOC-099](../tasks/LOC-099.md): Extract CRM pipeline list and creation catalogs.
- [LOC-100](../tasks/LOC-100.md): Extract CRM deal overview navigation and settings catalogs.
- [LOC-101](../tasks/LOC-101.md): Extract CRM deal activity catalogs.
- [LOC-102](../tasks/LOC-102.md): Extract CRM analytics catalogs.

## LOC-070 reporting catalog children

Verified 34 report TSX components; parent retains independent combined acceptance.
LOC-103 owns directory/shared primitives; later slices depend on that foundation.

- [LOC-103](../tasks/LOC-103.md): Extract report directory and shared navigation catalogs.
- [LOC-104](../tasks/LOC-104.md): Extract income and executive report catalogs.
- [LOC-105](../tasks/LOC-105.md): Extract balance sheet and cash flow catalogs.
- [LOC-106](../tasks/LOC-106.md): Extract trial balance and general ledger catalogs.
- [LOC-107](../tasks/LOC-107.md): Extract aging payments and vendor report catalogs.
- [LOC-108](../tasks/LOC-108.md): Extract analytical and comparison report catalogs.
- [LOC-109](../tasks/LOC-109.md): Extract forecast and financial calendar catalogs.
- [LOC-110](../tasks/LOC-110.md): Extract tax report catalogs.
- [LOC-111](../tasks/LOC-111.md): Extract banking report catalogs.
- [LOC-112](../tasks/LOC-112.md): Extract saved and custom report catalogs.
- [LOC-113](../tasks/LOC-113.md): Extract scheduled report catalogs.
- [LOC-114](../tasks/LOC-114.md): Extract consolidation and report pack catalogs.
