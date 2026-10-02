# Release gates

This is a policy map; current state is computed from task dependencies. No release gate is passed initially.

| Gate | Required evidence / tasks |
|---|---|
| Baseline / scope / provenance | AUD-001..005, actual owner-approved matrix |
| Production IRR readiness | MON-001..010, application-enforced flag, verified financial migration |
| Locale / RTL / all surfaces | LOC, RTL and L10N tasks, native financial review |
| Valuable feature parity | PAR tasks and explicit branch deferral if applicable |
| Productivity / optional-provider scope | DATA tasks, documented optional deferrals |
| Financial / API invariance | QA-001 |
| Security / privacy | QA-002 with attributable review |
| Accessibility / visual | QA-003 |
| Performance | QA-004 against agreed budgets |
| Migration / backup / restore | QA-005 with actual rehearsal |
| Operational readiness | REL-001 |
| Third-party distribution and provenance | Further licensing review deferred by owner under DEC-004 for the private Iran-use fork; AUD-003 findings retained as reference, not current task/release blockers |
| Candidate and production authorization | REL-002 for the exact candidate and scope |
| Production acceptance | REL-003: observed canary metrics and reconciliation |
| Delayed contract cleanup | REL-004 only after the real deprecation window |

A generic continue prompt authorizes bounded project work, not unspecified production deployment. Prepare a concrete candidate/runbook before requesting a required production approval. The tracker itself never deploys or enables IRR. Human-review labels record actual required reviews and cannot be satisfied by a model role-playing a person.

CI-002 implements the functional-currency selection gate in `lib/currency/rollout.ts`: code readiness is false and a premature `IRR_PRODUCTION_ENABLED=true` fails server configuration validation. [ADR-003](ADR-003-LOCALE-AND-CURRENCY-ROLLOUT.md) records scope and later reviewed enablement. This does not qualify existing/foreign-IRR postings or change financial gate status.
