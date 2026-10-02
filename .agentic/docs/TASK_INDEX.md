# Task index

Generated initial scope index; current status always comes from task metadata via `agent.py status`.

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
