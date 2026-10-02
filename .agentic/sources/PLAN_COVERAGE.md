# Source-to-task coverage

The full 37-page plan was extracted and reviewed to create this package. Page ranges below use the PDF's printed numbering. Task metadata retains precise source pages. This map covers requirements; it does not claim they are implemented.

| Plan pages | Requirement family | Destination / tasks |
|---|---|---|
| 1–2 | Strategy, exact money first, assumptions, IRR rather than silent toman | PROJECT; AUD-001..005; MON-001..010 |
| 3 | Baseline stack, architecture and license prerequisite | AUD-001..003; CI-001..002 |
| 4–7 | Complete feature-map audit and domain reuse / adapters | AUD-004; BIGCAPITAL_PARITY; PAR-001..008; DATA-001..007 |
| 7–9 | Exact minor units, money type widening, decimal FX and historical rates | MON-001..008 |
| 9 | Regimes, future redenomination and explicit toman distinction | MON-009; CURRENCY_REGIMES |
| 10–11 | Locale precedence, routing, numeral/calendar/date boundary and ICU | LOC-001..004 |
| 11–12 | Logical CSS, direction, bidi, typography, PDFs and accessibility | RTL-001..002; L10N-009..011; QA-003 |
| 13–15 | Milestones, roles, sequencing and resource estimates | TASK_INDEX; roles/*; PROJECT; dependency graph |
| 16–18 | Layered tests, named invariants, CI and release pipeline | TEST_MATRIX; CI-001; MON-010; QA-001..005 |
| 18–19 | Deployment configuration, actual integration services, backups | CI-002; REL-001..003; REPOSITORY_MAP |
| 19–20 | Security, Unicode, rates, privacy, providers and performance | PAR-007; DATA-005..006; QA-002; QA-004 |
| 21–23 | Expand/dual-read-write/verify/switch/contract; compatibility and reconciliation | MON-003..010; QA-005; REL-004 |
| 23–24 | Risk register, production IRR gate and proposed structure | RISKS; RELEASE_GATES; MON-010; AUD-001 |
| 24–27 | Illustrative locale/source structure and sample catalogs | LOC-001..004; actual paths discovered in AUD-001 |
| 28–30 | Terminology, exact formatting, digits, dates and clean-room PR | L10N-001; LOC-003..004; MON-002; AUD-003 |
| 31–32 | Money/i18n/RTL/IRR/module/parity/release PR checklists | MON; LOC; RTL; L10N; PAR; DATA; REL tasks |
| 32–33 | Code review rejection criteria and maintenance policy | START_HERE; REVIEW prompt; TEST_MATRIX; OPS-001 |
| 33–34 | Four durable registries and recurring revalidation | UPSTREAM_DUBBL; BIGCAPITAL_PARITY; I18N_TERMINOLOGY; CURRENCY_REGIMES; OPS-001 |
| 34–37 | Tool recommendations and primary-source hierarchy | SOURCE; SOURCES_TO_VERIFY; relevant implementation tasks |

## Deliberate refinements

The original plan contains broad multi-week milestones. They are decomposed into 60 reviewable initial tasks with dependencies, role ownership, criteria and evidence. If source inspection shows one task still exceeds a bounded change, split it explicitly using the controller guide and preserve the parent acceptance gate. Optional scope remains visible rather than disappearing. Baseline claims start unverified; no initial completed work is invented. Maintenance is a dated future task after release, not an automatically scheduled process.

Every important PR/checklist family is represented, including auxiliary money consumers (payroll, assets, loans, budgets and recurring jobs), public/signing/PDF money boundaries, credit allocations/refunds, reports, imports/exports/views, provider constraints, backup/restore and delayed compatibility cleanup. Statutory obligations and future monetary rules remain questions until the owner supplies scope and official evidence.
