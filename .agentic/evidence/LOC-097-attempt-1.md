# LOC-097 attempt 1

## Identity and scope

2026-10-21, Codex, master. Owner-requested concurrent LOC-095/096/097 batch;
controller acceptance is sequential. Scope: milestone creation/completion/deletion, assignment/payment dialogs and hourly/fixed/milestone progress invoices.
Final diff is verified but not yet committed at evidence creation.

## Acceptance mapping

1. Extracted 73 paired ProjectMilestones messages using real next-intl.
   Shared status/date/duration presentation uses existing paired catalogs where
   applicable. All authored copy and Persian script have focused source guards.
   Explicit data/machine/numeric/shared/sibling exceptions are recorded in
   [scope registry](../registries/PROJECT_TASK_TIME_MILESTONE_CATALOGS.md).
2. Tests cover exact aggregate and fixed-percentage previews, all billing presentation branches, persisted isPaid, scoped create/complete/delete/assignment/payment/invoice payloads, malformed readers and failed/cleaned-up read effects. The assignment paid property mismatch is corrected without changing REST/MCP or payment semantics.
   tests/project-milestone-catalogs.test.ts passes. The shared final invocation passes 73/73 focused/regression
   tests and 2/2 migrated REST/MCP/SQL integrations. Typecheck, 8,457-key catalog
   validation, zero-error lint, money inventory/legacy, controller and diff gates
   pass. All prior namespaces/schema entries remain unchanged. Exact URLs,
   methods, payloads, dates, physical units, money and MCP contracts remain.
3. Registry, this evidence and task handoff preserve provisional Persian and
   independent LOC-068/008/002, LOC-098, native terminology and RTL qualification.

## Verification, review and handoff

See [actual shared commands/results, corrected findings and limitations](LOC-095-097-validation-1.md).
No full build/dev startup, application database use, Stripe change, native/RTL,
interactive browser, hosted-CI or production acceptance is claimed. Review is
honest Codex self-review. After separate controller acceptance, create one local
batch commit; no push was requested. Next controller task after the batch is
LOC-098; do not include it in this request.
