# Decision log

Record durable decisions with ID, date, owner, status, context, options, chosen behavior, consequences, evidence and affected tasks. Proposed decisions are not accepted decisions. A model may recommend but must not invent owner approval.

## DEC-001 — Architecture direction

Status: requirement from supplied plan, pending validation against actual fork. Keep Dubbl runtime; use Bigcapital public contracts as clean-room requirements. AUD-003 records source/license evidence.

## Open scope decisions

| Decision | Owner | Task | Initial state |
|---|---|---|---|
| Branch dimension required? | Product/accounting owner | PAR-006 | undecided |
| Optional bank adapter and connector? | Product/operations owner | DATA-005, DATA-006 | undecided |
| SaaS and miscellaneous endpoint value? | Product owner | DATA-007 | undecided |
| Toman convenience | Product/accounting owner | MON-009 / future task | unspecified; disabled |
| Iranian statutory tax/payroll/e-invoicing scope | Product/domain expert | AUD-005 | unspecified; no compliance claim |
| Hosting/provider jurisdiction and availability | Deployment owner | AUD-005, QA-002 | unspecified |
| Exact rounding and FX precision | Accounting/DB owner | MON-002, MON-004 | pending |
| Performance budgets / recovery targets | Operations/product owner | QA-004, QA-005 | pending |
| API compatibility window | API/release owner | MON-006, REL-004 | pending |

Deferral must cite an actual scope decision. If an optional prerequisite is deferred, do not implement a dependent optional feature as if the missing prerequisite existed: defer its dependent scope as well or document a valid alternative design.
