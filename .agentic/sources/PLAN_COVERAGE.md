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

The plan's broad milestones are decomposed into 60 initial tasks with dependencies, role ownership, criteria and evidence. Split oversized tasks through the controller guide and preserve parent acceptance gates. Optional scope remains visible. Source inspection and evidence determine implementation truth; neither the plan nor tracker counts prove working features.

Auxiliary money consumers, public/signing/PDF boundaries, credit allocations/refunds, reports, imports/exports/views, providers, backup/restore and delayed compatibility cleanup remain covered. Statutory obligations and future monetary rules require explicit scope and official evidence. Owner decisions in docs/DECISIONS.md continue to govern execution.

MON-012 retains rollout integration acceptance after its children MON-013 (currency FX), MON-014 (core accounting), MON-015 (auxiliary/report) and MON-016 (public/opaque). All inherit the migration/API source sections and MON-011 prerequisites.

MON-014 retains core integration acceptance after MON-017 (contact credit limits/balances), MON-018 (journals), MON-019 (receivables), MON-020 (payables/procurement), MON-021 (payments/expenses/banking) and MON-022 (organization/tax configuration). Children inherit MON-011 and the migration/API source sections. No accounting scope or parent criterion is removed.

MON-015 retains auxiliary/report integration acceptance after MON-023 budgets CRUD, MON-024 inventory/costing, MON-025 payroll, MON-026 assets/loans, MON-027 projects/CRM/pricing, MON-028 consolidation/configuration and MON-029 reports/dashboards. Children inherit MON-011 and migration/API source sections; original parent criteria remain unchanged.

MON-016 retains public/opaque integration acceptance after MON-030 token JSON, MON-031 providers/webhooks, MON-032 backups/restore, MON-033 generic import/export and MON-034 opaque/rendering boundaries. Children inherit MON-011 and migration/API source sections. No original acceptance requirement is removed.

MON-018 retains journal integration acceptance after MON-035 CRUD, MON-036 lifecycle/bulk import and MON-037 recurring templates/generation. All trace to migration/API sections; children inherit MON-011, and lifecycle/recurring work also reuses MON-035. Original parent criteria remain unchanged.

MON-019 retains combined receivable acceptance after MON-038 invoice reads, MON-039 invoice writes, MON-040 lifecycle, MON-041 quotes, MON-042 credits, MON-043 receipts, MON-044 recurring invoices and MON-045 bulk. Children inherit MON-011 and trace to migration/API compatibility sections.

MON-020 retains combined payable/procurement acceptance after MON-046 bill reads, MON-047 CRUD, MON-048 lifecycle, MON-049 purchase orders, MON-050 requisitions, MON-051 debit notes, MON-052 goods receipts, MON-053 bulk and MON-054 settings. Children inherit MON-011 and trace to migration/API compatibility; original parent criteria remain unchanged.
