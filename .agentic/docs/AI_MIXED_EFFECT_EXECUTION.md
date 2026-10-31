# Combined approved sensitive effects

AI-050 accepts the combined domain boundary implemented by AI-052, AI-053 and
AI-054. Trusted callers use `executeApprovedJournal`, `executeApprovedSettlement`
and `executeApprovedInvoiceEmail` in `lib/ai/action-batches.ts`. These functions
accept only run, lease, batch and item UUIDs. Only fresh durable consumption
provides original validated arguments to the shared domain services. Historical
decisions, presentation, receipts and domain status cannot supply new authority.

One decision may select distinct saved journals, invoices and bills, with an
explicit dependency graph across adapters. Each prerequisite needs its actual
succeeded step and matching consumption for that same decision. Unselected work
cannot execute. A saved resource appears only once in a batch: paying an invoice
and then emailing that same invoice requires a later observation and decision.
GL totals include posting and settlement only, grouped by currency with exact
minor-unit strings; draft deletion and outbound email contribute no GL amounts.

Each effect rechecks its original arguments, versions, resource/policy bindings,
selection, identity, live permissions, runtime/configuration, lease, expiry and
Stop inside the domain lock boundary. Journal/payment transactions also enforce
period/fiscal locks and saved exact money/FX invariants. Unsupported or unbound
business approvals fail closed. SQL, audit and rendering waits precede the final
authority/time checks. Conservative domain/reference/credential locks serialize
ordinary writers, including absent policy rows. Detailed contracts:
[journals](AI_JOURNAL_EXECUTION.md), [cash](AI_SETTLEMENT_EXECUTION.md),
[delivery](AI_EMAIL_EXECUTION.md), [consumption](AI_ACTION_CONSUMPTION.md).

Effects commit individually. Stop or later failure retains the actual completed
prefix and bounded receipts; no batch rollback is promised. Journal/payment
mutation, operation audit and success receipt share one transaction. Lost COMMIT
acknowledgement observes that receipt without repeating the operation. External
email instead persists its immutable attempt before dispatch. Acknowledged
acceptance, known rejection and uncertainty remain distinct. A later domain
rollback cannot undo acknowledged delivery. A crashed or uncertain send requires
reconciliation and cannot be retried through an old lease or the ordinary resend
operation, including after AI metadata erasure.

`tests/integration/ai-mixed-effects.test.ts` exercises the actual domain/SQL
boundaries with session-backed REST approval, registered linked MCP reads and
revisions, real worker leases, and stubbed delivery. It covers a chain of posting,
invoice payment, bill payment, email and draft deletion, plus unselected work;
USD and 2147483648 IRR minor units; middle-payment lost COMMIT acknowledgement;
repeated receipts; resource/permission/Stop/lease races after an earlier commit;
partial failure/uncertainty; delivery followed by domain rollback; and a killed
sender followed by fresh-process recovery. Existing adapter suites retain their
independent period/policy/reference/authorization and asynchronous wait checks.

Fixture SQL explicitly queues approved runs solely to test these boundaries.
AI-051 owns the application resume and worker integration. AI-044 and AI-008
retain their independent combined acceptance. No public/model dispatch capability
or new REST/MCP operation is added by this acceptance. Default-off gates remain.
Global table locks can contend across organizations, and email holds locks
through transport acknowledgement. Confirmed means transport acceptance, not
inbox delivery. Live providers, performance, deployed workers, UI/native Persian,
deployment and rollout activation remain unqualified.
