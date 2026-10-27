# Source-to-task coverage

The authoritative requirements source is [SOURCE.md](SOURCE.md), the owner's Markdown replacement for the previous document. Read the plan directly by heading; this map links its sections to task families. It covers requirements and does not claim they are implemented. Current task inputs and `source_sections` metadata reference this Markdown file and its section anchors. The empty `source_pages` field is retained only for controller schema compatibility.

| Markdown source section | Requirement family | Destination / tasks |
|---|---|---|
| [Recommended direction](SOURCE.md#recommended-direction), [Explicit assumptions](SOURCE.md#explicit-assumptions) | Strategy, exact money first, assumptions, IRR and optional scope | PROJECT; AUD-001..005; MON-001..010 |
| [Baseline, prerequisites, licensing, and feature mapping](SOURCE.md#baseline-prerequisites-licensing-and-feature-mapping), [License prerequisite](SOURCE.md#license-prerequisite) | Stack, architecture and clean-room prerequisite | AUD-001..003; CI-001..002 |
| [Bigcapital-to-Dubbl feature map](SOURCE.md#bigcapital-to-dubbl-feature-map) | Complete capability audit; domain reuse and adapters | AUD-004; BIGCAPITAL_PARITY; PAR-001..008; DATA-001..007 |
| [Money and database architecture](SOURCE.md#money-and-database-architecture) | Exact minor units, widening, decimal FX and historical rates | MON-001..008 |
| [Rial and redenomination design](SOURCE.md#rial-and-redenomination-design) | Regimes, future redenomination and explicit toman distinction | MON-009; CURRENCY_REGIMES |
| [Farsi i18n/l10n strategy](SOURCE.md#farsi-i18nl10n-strategy) | Locale precedence, routing, numerals, calendars, dates and ICU | LOC-001..004; L10N-001..012 |
| [RTL UI/UX strategy](SOURCE.md#rtl-uiux-strategy), [Accessibility acceptance criteria](SOURCE.md#accessibility-acceptance-criteria) | Logical CSS, direction, bidi, typography, PDFs and accessibility | RTL-001..002; L10N-009..011; QA-003 |
| [Implementation roadmap, milestones, roles, and resource estimates](SOURCE.md#implementation-roadmap-milestones-roles-and-resource-estimates) | Roles, milestones, sequencing and estimates | TASK_INDEX; roles/*; PROJECT; dependency graph |
| [Testing matrix](SOURCE.md#testing-matrix), [CI/CD](SOURCE.md#cicd) | Layered tests, invariants, CI and release pipeline | TEST_MATRIX; CI-001; MON-010; QA-001..005 |
| [CI/CD](SOURCE.md#cicd), [Required configuration, files, resource examples, and testing-ready implementation details](SOURCE.md#required-configuration-files-resource-examples-and-testing-ready-implementation-details) | Deployment, integration configuration and backups | CI-002; REL-001..003; REPOSITORY_MAP |
| [Security and privacy](SOURCE.md#security-and-privacy), [Performance](SOURCE.md#performance) | Unicode, rates, privacy, providers and measured performance | PAR-007; DATA-005..006; QA-002; QA-004 |
| [Database and currency migration](SOURCE.md#database-and-currency-migration), [API backward compatibility](SOURCE.md#api-backward-compatibility) | Expand / dual-read-write / verify / switch / contract; reconciliation | MON-003..010; QA-005; REL-004 |
| [Risk register](SOURCE.md#risk-register) | Risk management and production IRR gate | RISKS; RELEASE_GATES; MON-010; AUD-001 |
| [Required configuration, files, resource examples, and testing-ready implementation details](SOURCE.md#required-configuration-files-resource-examples-and-testing-ready-implementation-details) | Locale structure, catalogs, terminology, exact formatting, digits and dates | LOC-001..004; L10N-001; MON-002; actual paths discovered in AUD-001 |
| [Required files and pull-request sequence](SOURCE.md#required-files-and-pull-request-sequence) | Money/i18n/RTL/IRR/module/parity/release checklists | MON; LOC; RTL; L10N; PAR; DATA; REL tasks |
| [Code-review rejection criteria](SOURCE.md#code-review-rejection-criteria), [Maintenance model](SOURCE.md#maintenance-model) | Review gates, durable registries and recurring revalidation | START_HERE; REVIEW prompt; TEST_MATRIX; UPSTREAM_DUBBL; BIGCAPITAL_PARITY; I18N_TERMINOLOGY; CURRENCY_REGIMES; OPS-001 |
| [Recommended tools and libraries](SOURCE.md#recommended-tools-and-libraries), [Prioritized source hierarchy](SOURCE.md#prioritized-source-hierarchy) | Tools and primary-source verification | SOURCE; SOURCES_TO_VERIFY; relevant implementation tasks |

MON-006 retains final API compatibility integration acceptance. Its implementation children are [MON-011](../tasks/MON-011.md) (wire primitives/shared transport guards) and [MON-012](../tasks/MON-012.md) (real REST/MCP endpoint rollout), both traced to database migration and API backward compatibility above.

## Deliberate refinements

### Owner-requested Persian currency-unit display (2026-10-21)

[LOC-115](../tasks/LOC-115.md) adds the explicit cross-page presentation scope
missing from the numeric-formatting/glossary tasks: when language is fa-IR,
show Persian currency names, with IRR rendered as "ریال". The task follows
LOC-003 and gates RTL-001 and L10N-012. Exact amounts, ISO machine values,
stored history and REST/MCP contracts are preserved; English remains unchanged.
This extends the existing Farsi locale and configuration requirements.

### Owner-directed IRR qualification and activation (2026-10-21)

The owner requested Codex perform the remaining IRR checks or create executable
tasks for them. [Instruction and observed baseline](../evidence/IRR-qualification-scope-2026-10-21.md).
This refines the existing testing, migration, risk and release requirements; it
does not reopen completed financial implementation tasks or declare readiness.

- [IRR-001](../tasks/IRR-001.md): Current financial/migration qualification baseline.
- [IRR-002](../tasks/IRR-002.md): Exact IRR backup/restore and rollback rehearsal.
- [IRR-003](../tasks/IRR-003.md): Real selection, authorization/history controls and critical Persian money entry.
- [IRR-004](../tasks/IRR-004.md): Reviewed default-off opt-in IRR release candidate.
- [IRR-005](../tasks/IRR-005.md): Actual approved target activation and canary reconciliation.

The owner subsequently requested IRR work after localization. IRR-001..003
are phase-8 technical qualification, with IRR-001 waiting for RTL-002 and
L10N-012 (catalog/input/RTL work and final native translation acceptance).
The remaining IRR sequence follows its existing dependencies and release gates.
REL-001 depends on IRR-004 so REL-002 can approve the exact prepared candidate;
IRR-005 follows that approval and REL-003 waits for its observed outcome. Under
DEC-009 (2026-10-27), AI implementation no longer waits for this IRR sequence;
IRR qualification and activation gates remain unchanged.
See [readiness map](../registries/IRR_READINESS.md) for scope and handoffs.

### Earlier refinements

The plan's broad milestones are decomposed into 60 initial tasks with dependencies, role ownership, criteria and evidence. Split oversized tasks through the controller guide and preserve parent acceptance gates. Optional scope remains visible. Source inspection and evidence determine implementation truth; neither the plan nor tracker counts prove working features.

Auxiliary money consumers, public/signing/PDF boundaries, credit allocations/refunds, reports, imports/exports/views, providers, backup/restore and delayed compatibility cleanup remain covered. Statutory obligations and future monetary rules require explicit scope and official evidence. Owner decisions in docs/DECISIONS.md continue to govern execution.

MON-012 retains rollout integration acceptance after its children MON-013 (currency FX), MON-014 (core accounting), MON-015 (auxiliary/report) and MON-016 (public/opaque). All inherit the migration/API source sections and MON-011 prerequisites.

MON-014 retains core integration acceptance after MON-017 (contact credit limits/balances), MON-018 (journals), MON-019 (receivables), MON-020 (payables/procurement), MON-021 (payments/expenses/banking) and MON-022 (organization/tax configuration). Children inherit MON-011 and the migration/API source sections. No accounting scope or parent criterion is removed.

MON-015 retains auxiliary/report integration acceptance after MON-023 budgets CRUD, MON-024 inventory/costing, MON-025 payroll, MON-026 assets/loans, MON-027 projects/CRM/pricing, MON-028 consolidation/configuration and MON-029 reports/dashboards. Children inherit MON-011 and migration/API source sections; original parent criteria remain unchanged.

MON-016 retains public/opaque integration acceptance after MON-030 token JSON, MON-031 providers/webhooks, MON-032 backups/restore, MON-033 generic import/export and MON-034 opaque/rendering boundaries. Children inherit MON-011 and migration/API source sections. No original acceptance requirement is removed.

MON-018 retains journal integration acceptance after MON-035 CRUD, MON-036 lifecycle/bulk import and MON-037 recurring templates/generation. All trace to migration/API sections; children inherit MON-011, and lifecycle/recurring work also reuses MON-035. Original parent criteria remain unchanged.

MON-019 retains combined receivable acceptance after MON-038 invoice reads, MON-039 invoice writes, MON-040 lifecycle, MON-041 quotes, MON-042 credits, MON-043 receipts, MON-044 recurring invoices and MON-045 bulk. Children inherit MON-011 and trace to migration/API compatibility sections.

MON-020 retains combined payable/procurement acceptance after MON-046 bill reads, MON-047 CRUD, MON-048 lifecycle, MON-049 purchase orders, MON-050 requisitions, MON-051 debit notes, MON-052 goods receipts, MON-053 bulk and MON-054 settings. Children inherit MON-011 and trace to migration/API compatibility; original parent criteria remain unchanged.

MON-021 retains combined payment/expense/banking acceptance after MON-055 through MON-069. Verified independent read, settlement/reversal, batch/schedule, expense CRUD/lifecycle, bank account/read/import/coding/matching/transfer/reconciliation/rule workflows inherit MON-011 and trace to migration/API compatibility; original parent criteria remain unchanged.

MON-022 retains combined configuration acceptance after MON-070 organization settings, MON-071 tax rates/profiles, MON-072 tax periods and MON-073 approval conditions. Children inherit MON-011 and trace to migration/API compatibility; original parent criteria remain unchanged.

MON-024 retains combined inventory/costing acceptance after MON-074 variants/suppliers, MON-075 master/import, MON-076 movements/warehouses, MON-077 valuation/landed costs and MON-078 BOM/assembly. Verified source domains inherit MON-011 and migration/API source sections; original parent criteria remain unchanged.

MON-025 retains combined payroll acceptance after MON-079 master records, MON-080 settings/deductions/tax, MON-081 time/leave/shifts, MON-082 pay runs/lifecycle, MON-083 contractor/tax payments, MON-084 compensation/forecasts and MON-085 reports/payslips/tax forms/self-service outputs. Children inherit MON-011 and migration/API source sections; original parent criteria remain unchanged.

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

MON-029 retains report/dashboard integration after MON-100 budget comparison, MON-101 financial statements/ledger, MON-102 aging/contact statements, MON-103 tax/regulatory, MON-104 operational analytics and MON-105 dashboards/saved reports. All inherit MON-011 and migration/API source sections; all original criteria remain unchanged.


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


MON-103 maps tax/regulatory report migration/API compatibility boundaries in [TAX_REPORT_WIRE_CONTRACTS](../registries/TAX_REPORT_WIRE_CONTRACTS.md); MON-029 retains independent combined report acceptance.


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

Both children trace to money architecture, database migration and the required PR sequence.
MON-007 retains all original criteria; backend completion cannot establish UI or parent acceptance.

- [MON-128](../tasks/MON-128.md): Shared core posting arithmetic and backend ownership.
- [MON-129](../tasks/MON-129.md): Core exact money editors, previews and presentation; split further if needed.
- [MON-130](../tasks/MON-130.md), [MON-131](../tasks/MON-131.md), [MON-132](../tasks/MON-132.md), [MON-133](../tasks/MON-133.md): Source-verified journal, receivable, payable and cash/tax/account UI slices; MON-129 retains combined acceptance.
- [MON-134](../tasks/MON-134.md), [MON-135](../tasks/MON-135.md), [MON-136](../tasks/MON-136.md), [MON-137](../tasks/MON-137.md): Shared invoice creation/editor, saved invoice lifecycle, other receivable documents and recurring UI children; MON-131 retains combined acceptance.


MON-132 retains independent payable/procurement integration after these source-verified UI children:

- [MON-138](../tasks/MON-138.md): Cut over bill creation UI money.
- [MON-139](../tasks/MON-139.md): Cut over saved bill lifecycle UI money.
- [MON-140](../tasks/MON-140.md): Cut over debit note UI money.
- [MON-141](../tasks/MON-141.md): Cut over procurement document UI money.
- [MON-142](../tasks/MON-142.md): Cut over recurring bill UI money.

MON-136 retains all original criteria after splitting its four independent UI domains.
Children trace to money architecture, database migration and the required PR sequence:

- [MON-143](../tasks/MON-143.md): Quote creation, saved display and lifecycle money.
- [MON-144](../tasks/MON-144.md): Credit note prices, reads and invoice application.
- [MON-145](../tasks/MON-145.md): Sales receipt prices, reads and cash lifecycle.
- [MON-146](../tasks/MON-146.md): Customer prepayment amounts, balances and application.

MON-133 core cash/tax/account UI is split into MON-147..152, retaining money-and-database-architecture, database-and-currency-migration and required-files-and-pull-request-sequence coverage. MON-133 retains independent combined acceptance; child completion is insufficient.

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

Source inspection separated duplicate scheduled depreciation/loan/revenue and auto-reversal writers from FX revaluation and remaining worker composition. Both children retain api-backward-compatibility and database-and-currency-migration; MON-159 keeps all original acceptance criteria.

- [MON-164](../tasks/MON-164.md): Scheduled bookkeeping and auto-reversal money consumers.
- [MON-165](../tasks/MON-165.md): FX revaluation and remaining background composition.

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

Source inspection found 23 settings TSX files totaling over 10,000 lines. LOC-012,
LOC-006 and LOC-002 retain independent integration acceptance. All children trace
to farsi-i18nl10n-strategy and
required-configuration-files-resource-examples-and-testing-ready-implementation-details.

- [LOC-014](../tasks/LOC-014.md): Core navigation, general, procurement, cost centers and tags.
- [LOC-015](../tasks/LOC-015.md): Settings automation and notification preferences.
- [LOC-016](../tasks/LOC-016.md): Settings access and audit.
- [LOC-017](../tasks/LOC-017.md): Settings providers, documents and data management.


## AI agent and administration extension (2026-10-17)

Owner-requested backlog; see [delivery plan](../docs/AI_AGENT_PLAN.md) and [requirements](../sources/SOURCE.md#ai-agent-and-administration-owner-extension). Updated by DEC-009 on 2026-10-27: phase 11, priority 2, scheduled now before phase 5. AI-001 retains completed technical prerequisites and no longer waits for the unfinished older backlog. Owner clarification: phase 5 follows phases 6 and 7 and waits for both AI-013 and L10N-012. Its tasks remain queued for reconsideration; deletion has not been requested. Phase-5 ordering gates are removed from phases 6 and 7. Internal AI dependencies and all qualification/release gates remain intact. Task files remain the status source.

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

- [LOC-116](../tasks/LOC-116.md): Extract document email history catalogs; LOC-071 child.

- [LOC-117](../tasks/LOC-117.md): Extract dashboard overview and widget catalogs; LOC-071 child.

- [LOC-118](../tasks/LOC-118.md): Extract document workspace catalogs; LOC-071 child.

- [LOC-119](../tasks/LOC-119.md): Extract document send control catalogs; LOC-071 child.

## LOC-122 landing/help bounded extraction

- [LOC-125](../tasks/LOC-125.md): Extract landing shell and conversion catalogs; LOC-122 child.
- [LOC-126](../tasks/LOC-126.md): Extract landing feature and help catalogs; LOC-122 child.
- [LOC-127](../tasks/LOC-127.md): Extract public pricing and legal catalogs; LOC-122 child.
- [LOC-128](../tasks/LOC-128.md): Extract documentation chrome and public metadata catalogs; LOC-122 child.

## RTL root and shared-layout implementation

The RTL UI/UX and accessibility sections map to RTL-001's bounded children:
[RTL-003](../tasks/RTL-003.md) root/Radix propagation,
[RTL-004](../tasks/RTL-004.md) shared primitive logical layout/behavior, and
[RTL-005](../tasks/RTL-005.md) shell/navigation/sidebar conversion.
RTL-001 retains independent combined bilingual layout, focus and icon acceptance;
RTL-002 retains forms/tables/typography/mixed identifiers. DEC-005 and DEC-008
remain applicable, including screenshot-free review and frozen provider surfaces.

## RTL-008 module adoption children

Actual source audit: shared tables contain click-only sort headers and narrow-toolbar/long-header risks; banking account fields and public/output identifiers require independent domain review.

- [RTL-009](../tasks/RTL-009.md): Harden shared data-table direction layout and sorting accessibility.
- [RTL-010](../tasks/RTL-010.md): Adopt bidi and resilient layout across dashboard modules.
- [RTL-011](../tasks/RTL-011.md): Adopt bidi and resilient layout across public admin and outputs.

RTL-008 retains exhaustive combined module/output acceptance; RTL-002 remains its independent integration parent. File ownership is recorded in `registries/RTL_MODULE_OWNERSHIP.json`; frozen provider sources stay unchanged.

## Iran business capabilities (phase 12, before phase 5)

DEC-010: scheduled after phase 7, before phase 5; no new tax scope. Requirements: [owner extension](../sources/SOURCE.md#iran-business-capabilities-owner-extension).

| Task | Outcome | Depends on (in addition to AI-013 and L10N-012) |
|---|---|---|
| [MOD-001](../tasks/MOD-001.md) | Define module registry and lifecycle contracts | None |
| [MOD-002](../tasks/MOD-002.md) | Enforce organization module settings across execution paths | MOD-001 |
| [MOD-003](../tasks/MOD-003.md) | Add personal workspace preferences and business presets | MOD-002 |
| [SVC-001](../tasks/SVC-001.md) | Implement goods and services catalog types | MOD-002 |
| [SVC-002](../tasks/SVC-002.md) | Implement service pricing and sales document integration | SVC-001 |
| [SVC-003](../tasks/SVC-003.md) | Deliver services catalog and pricing user workflows | SVC-002, MOD-003 |
| [TRY-001](../tasks/TRY-001.md) | Define check and promissory-note accounting contracts | MOD-002 |
| [TRY-002](../tasks/TRY-002.md) | Implement received and issued check treasury lifecycle | TRY-001 |
| [TRY-003](../tasks/TRY-003.md) | Implement promissory notes and guarantees | TRY-001 |
| [TRY-004](../tasks/TRY-004.md) | Deliver treasury workspace reminders and reconciliation | TRY-002, TRY-003, MOD-003 |
| [IRO-001](../tasks/IRO-001.md) | Add Iranian party and banking data workflows | MOD-002, DATA-001 |
| [IRO-002](../tasks/IRO-002.md) | Implement explicit rial and toman input and display preferences | MOD-003 |
| [IRO-003](../tasks/IRO-003.md) | Complete Persian operational dates and configurable fiscal periods | MOD-003 |
| [POS-001](../tasks/POS-001.md) | Implement POS sessions and cashier shifts | MOD-002, SVC-002 |
| [POS-002](../tasks/POS-002.md) | Deliver fast checkout payments returns and receipts | POS-001, SVC-003, IRO-002 |
| [POS-003](../tasks/POS-003.md) | Add qualified receipt and payment-terminal adapters | POS-002 |
| [POS-004](../tasks/POS-004.md) | Implement bounded offline checkout and safe synchronization | POS-002 |
| [PAYIR-001](../tasks/PAYIR-001.md) | Specify Iranian non-tax payroll workflows | MOD-002 |
| [PAYIR-002](../tasks/PAYIR-002.md) | Implement non-tax payroll policies and Persian payslips | PAYIR-001, IRO-003 |
| [COL-001](../tasks/COL-001.md) | Add record comments mentions and activity notifications | MOD-003 |
| [COL-002](../tasks/COL-002.md) | Implement optional organization channels and direct messaging | COL-001 |
| [IRN-001](../tasks/IRN-001.md) | Qualify the integrated Iran business capabilities | MOD-001, MOD-002, MOD-003, SVC-001, SVC-002, SVC-003, TRY-001, TRY-002, TRY-003, TRY-004, IRO-001, IRO-002, IRO-003, POS-001, POS-002, POS-003, POS-004, PAYIR-001, PAYIR-002, COL-001, COL-002 |

### AI-006 reviewed registry gaps (2026-10-27)

AI-006 supports only its explicit seven-operation reviewed subset. AI-014 through AI-021 own finite domain candidate slices and exact gap classification from AI_TOOL_COVERAGE.json; they depend on AI-006 and AI-008. New Iranian tax, Stripe and privileged credential/security/provider chat operations remain excluded. Full-site support cannot be claimed until operation-level gaps are reconciled under AI-013.


## AI-007 durable execution slices

- [AI-022](../tasks/AI-022.md): bounded scoped lifecycle, exclusive leases and crash classification.
- [AI-023](../tasks/AI-023.md): metered provider/tool loop, worker scheduling and deterministic end-to-end execution.

AI-007 remains the independent integration parent; neither child alone accepts its original criteria.
