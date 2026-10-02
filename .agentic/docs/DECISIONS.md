# Decision log

Record durable decisions with ID, date, owner, status, context, options, chosen behavior, consequences, evidence and affected tasks. Proposed decisions are not accepted decisions. A model may recommend but must not invent owner approval.

## DEC-001 — Architecture direction

Status: requirement from the [Markdown implementation plan](../sources/SOURCE.md), pending validation against actual fork. Keep Dubbl runtime; use Bigcapital public contracts as clean-room requirements. AUD-003 records source/license evidence.

## DEC-002 — Docker execution deferred by owner

Date: 2026-10-02 (Asia/Tehran). Owner: project owner (actual user in this session). Status: accepted, effective until the owner changes it.

The owner stated that they do not currently want or have Docker, authorized writing necessary Docker files, and explicitly said Docker testing is unnecessary and may be omitted. Record of the decision: `../evidence/DOCKER-scope-decision-2026-10-02.md`.

Chosen behavior: Docker installation, container startup, production Docker builds and Docker-specific tests are outside the current execution scope. Agents may prepare or maintain necessary Docker configuration/documentation and inspect it statically. Mark Docker execution as omitted by owner decision and unverified, never passed. Docker absence alone must not block AUD-002, CI-001 or subsequent qualification tasks. Preserve existing Docker support and CI configuration unless a concrete change is needed; this is not an instruction to disable CI jobs or remove Docker files.

Consequences: AUD-002 no longer requires production Docker reproduction. Apply the same execution exception to CI-001 and the test matrix; remaining non-Docker acceptance criteria, financial checks and release gates still apply. Root restrictions on full builds and unrequested dev startup remain in force. No dev-start, database mutation or deployment permission is implied.

## DEC-003 — Existing local database authorized for testing

Date: 2026-10-02 (Asia/Tehran). Owner: project owner (actual user in this session). Status: accepted.

The owner confirmed that the database already configured in .env is a test database and authorized necessary queries. Use DATABASE_URL from the existing environment; do not copy credentials into documentation, code, commands or evidence. The authorized target is the local database named `dubbl`. Its test status no longer requires confirmation or provisioning a separate database as a prerequisite.

Queries and scoped fixture setup needed for project testing may proceed within this authorization. Prefer identifiable fixture records and transactions where appropriate. This does not authorize wholesale resets/deletion, production targets, deployments or dev startup. Root migration and build rules remain applicable. Actual initial read-only checks are recorded in `../evidence/AUD-002-attempt-2.md`.

## DEC-004 — Private fork; further licensing work deferred

Date: 2026-10-02 (Asia/Tehran). Owner: project owner (actual user in this session). Status: accepted.

The owner clarified that this is their own private project for use in Iran, with no intention to contribute to upstream Dubbl or release it as open source. They accepted the AUD-003 notes already written and directed the assistant to ignore further licensing work and move past this task.

Keep the completed inventory and policy notes as reference. Defer further license/provenance remediation, distribution-notice assembly and the new licensing review/release gates proposed during AUD-003; do not let these findings block current project execution. Remove the new public contribution-guide addition. Do not publish, contribute upstream, relicense dependencies, or infer a right to copy third-party implementation from this scope decision. Existing license files remain unchanged. Other accounting, localization, authorization, migration and task-review requirements remain in scope.

Evidence: the owner's message during AUD-003, recorded in `../evidence/AUD-003-attempt-1.md`. The controller still closes exactly one task per continuation; AUD-004 is selected next after AUD-003.

## DEC-005 — Screenshot requirements removed by owner

Date: 2026-10-02 (Asia/Tehran). Owner: project owner (actual user in this session). Status: accepted.

The owner said screenshots are unnecessary for continuation, instructed removing screenshot requirements from `.agentic`, and requested a commit to prepare for the next task. Screenshot capture, screenshot tests and screenshot golden comparisons are outside the current scope throughout the backlog. Their absence and unavailable browser/screenshot helpers must not block task completion. Financial reconciliation, actual behavioral/layout/accessibility review, native linguistic/accounting review and PDF correctness remain applicable. No screenshot or browser check is claimed passed.

Updated AUD-002, RTL-001, L10N-002 through L10N-008, the baseline runbook, test matrix and requirements source accordingly. Historical evidence and task history are retained as records of the earlier scope. The owner also reported starting the local dev server; authenticated HTTP captures now succeeded. No general future agent dev-start authorization or production deployment is inferred.

Evidence: `../evidence/AUD-002-attempt-4.md`.

## DEC-006 — AUD-005 baseline and optional scope approved by owner

Date: 2026-10-02 (Asia/Tehran). Owner: project owner (actual user in this conversation). Status: accepted after the owner requested and received a Persian explanation and approved the recommendation. Actual review: `../evidence/AUD-005-owner-review-1.md`.

The [owner review packet](AUD-005-OWNER-REVIEW.md) is accepted as the planning baseline, with both accounting findings open. Defer branches (PAR-006), bank-feed adapter/connector (DATA-005 and DATA-006), SaaS/miscellaneous parity (DATA-007), toman UX, new statutory compliance/accounting-calendar work and hosting/provider selection. The four optional tasks are explicitly skipped through the controller. Reasons and continuing mandatory work are detailed in the packet. Existing capabilities are preserved. Exact money/FX, migration, accounting, Persian/RTL and manual/CSV banking remain in scope.

Preparation evidence: `../evidence/AUD-005-attempt-1.md`; closure evidence: `../evidence/AUD-005-attempt-2.md`. Schedule ranges remain estimates, with no committed start or due dates. This owner review does not qualify financial outputs, provider availability or production readiness. Future inclusion requires an explicit scope change; deferred optional tasks must be reopened. Both baseline defects retain their remediation and QA tasks.

## Remaining open scope decisions

| Decision | Owner | Task | Initial state |
|---|---|---|---|
| Branch dimension required? | Product/accounting owner | PAR-006 | deferred under DEC-006 |
| Optional bank adapter and connector? | Product/operations owner | DATA-005, DATA-006 | both deferred under DEC-006 |
| SaaS and miscellaneous endpoint value? | Product owner | DATA-007 | new parity deferred under DEC-006 |
| Toman convenience | Product/accounting owner | MON-009 / future task | deferred under DEC-006; disabled |
| Iranian statutory tax/payroll/e-invoicing scope | Product/domain expert | AUD-005 | new implementation deferred under DEC-006; no compliance claim |
| Statutory accounting calendar | Product/domain expert | LOC-004 / future task | deferred under DEC-006; Persian presentation remains in scope |
| Hosting/provider jurisdiction and availability | Deployment owner | QA-002, REL-001/002 | selection deferred under DEC-006; required before relevant deployment/provider use |
| Exact rounding and FX precision | Accounting/DB owner | MON-002, MON-004 | pending |
| Performance budgets / recovery targets | Operations/product owner | QA-004, QA-005 | pending |
| API compatibility window | API/release owner | MON-006, REL-004 | pending |

Deferral must cite an actual scope decision. If an optional prerequisite is deferred, do not implement a dependent optional feature as if the missing prerequisite existed: defer its dependent scope as well or document a valid alternative design.
