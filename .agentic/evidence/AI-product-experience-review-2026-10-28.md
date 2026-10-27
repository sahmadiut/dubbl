# AI backlog product experience review

Date: 2026-10-28. Reviewer: Codex, self-review. Scope: owner-requested inspection and improvement of all AI task definitions in `D:\Projects\a\dubbl`. This is planning evidence, not feature completion, browser evaluation, human usability testing or release approval.

## Inspected baseline

Read all 23 existing AI task files, controller instructions and scheduling state, the AI delivery/execution/provider/usage/lifecycle/registry documents, source/index coverage and current administration components/client contracts. Initial controller validation passed for 408 tasks; AI had eight done and fifteen todo tasks. No task was active; AI-023 was next. Working tree was clean at entry.

Source checks included `components/ai/management.tsx`, `components/ai/management-forms.tsx`, `lib/ai/admin-client.ts`, lifecycle/persistence state references, provider/usage service contracts and `lib/mcp/tools/ai-usage.ts`. No secrets, live provider or application database were accessed. Completed administration task handoffs were treated as historical assertions, not independently reproduced application checks.

## Findings and assigned work

| Finding | Implication | Planning correction |
|---|---|---|
| Original chat task has only four broad criteria covering nearly the whole experience | Streaming, composer/history, approvals and recovery could be accepted without usable interactions | Preserve AI-009 as integration parent; split AI-026 workspace/history and AI-027 runtime interactions; define the shared experience contract |
| AI-013 claims transitive feature coverage, but AI-014..021 are outside its dependency closure | Final acceptance could precede domain qualification | AI-028 depends on every domain follow-up; AI-012 depends on AI-028; verify AI-013 reaches every AI task |
| Admin forms show provider/config/policy fields; metered tests additionally require immutable prices and both org/member budgets | Saving a credential is not a complete setup journey | AI-011 supplies price/budget forms; AI-024 supplies readiness and guided steps using authorized shared services |
| Current management load/remount behavior and global notices do not specify protection for unrelated dirty forms | A polished settings experience needs explicit draft, conflict and error handling | AI-024/025 require per-form dirty state, inline errors, stale-response discard and safe settings impact review; runtime defect reproduction remains implementation work |
| Policy UI is a flat reviewed-tool checkbox list | Users need business labels, grouping and effective-permission explanations as coverage expands | AI-025 plus AI-014..021 catalog refresh and AI-028 integrated verification |
| Lifecycle events are content-free; awaiting-input exists as storage state without a complete consumer workflow | UI cannot invent streaming, clarification or resume endpoints | AI-023 owns scoped display/clarification REST/MCP contracts; AI-007 independently integrates them |
| Domain tasks repeat generic coverage criteria | Passing technical dispatch tests alone does not establish an understandable workflow | Add one concrete business scenario and structured results/error/record-link requirements per AI-014..021 |
| Domain candidate slices emphasize reads/drafts without assigning a required real sensitive positive path | An approval UI could be tested only against fixtures without real business effects | AI-016 must qualify existing approve_expense_claim with preview/domain authorization and exact ledger assertions; AI-028/012 consume the result |
| Open AI tasks still say to finish the old backlog before starting AI | Contradicts current scheduling decisions | Replace stale open-task handoffs; retain historical entries and completed task records |
| Accessibility/RTL requirements lack observable detail | Localization keys alone could be mistaken for usability | Specify viewports, zoom, IME, focus, announcements, mixed-direction money/IDs, themes and recovery checks; AI-028 owns integrated evidence |
| Approval wording can imply sensitive configuration becomes allowed if approved | Conflicts with the existing privileged-tool exclusion | AI-008 explicitly retains credential/security/provider/role exclusions while defining exact supported effect previews |

## Review of all original tasks

| Tasks | Assessment and disposition |
|---|---|
| AI-001 | Inventory/architecture baseline is useful; capability truth is current registry and source. Keep completed record; new experience contract supplies missing product detail. |
| AI-002 | Live identity and scoped authorization requirements remain essential. Preserve completed record; new UI/runtime tasks test revocation and delayed cross-tenant responses. |
| AI-003 | Persistence/retention boundaries remain intact. Search/rename/delete and clarification consumers must add missing REST/MCP contracts in AI-026/023 rather than assume storage is complete UX. |
| AI-004 | Credential/provider boundary is preserved; AI-024 adds readiness/setup usability without bypassing live qualification. |
| AI-005 | Exact metering and unknown usage are preserved; AI-011 adds understandable prices, budgets and displays. |
| AI-006 | Reviewed subset and default-deny are preserved; domain tasks supply truthful supported capabilities and user scenarios. |
| AI-007 | Keep lifecycle/runtime split and independent integration; add consumed state and recovery acceptance. |
| AI-008 | Strengthen concrete preview, selection, rejection/revision and safe error/next-action contracts. |
| AI-009 | Keep all original criteria; controller split into AI-026/027, with independent assembled journey acceptance. |
| AI-010 | Preserve completed baseline; AI-024/025 track additional setup, policy and settings UX. |
| AI-011 | Add clear usage hierarchy, unknown/reserved estimates, price/member/org budget forms and real service parity for new filters/exports/global scope. |
| AI-012 | Gate on domain/UX completion and test the final service/UI contracts; existing live-provider/security gates remain. |
| AI-013 | Require every AI dependency, precise support claims and accurate bilingual user/admin help before final integration acceptance. |
| AI-014 | Bank/account disambiguation and exact filtered balances/results. |
| AI-015 | Customer disambiguation and real invoice drafts, never fictional sending/payment. |
| AI-016 | Supplier/bill/purchase-order draft journey, partial outcomes and one real approval-gated submitted-expense posting path; split a required child if necessary. |
| AI-017 | Existing asset/loan/tax report read context; no new statutory scope. |
| AI-018 | Item/warehouse/unit/as-of clarity; no fabricated movement result. |
| AI-019 | Project/task/payroll result links with strict personnel-data visibility. |
| AI-020 | Source-grounded report/document previews and explicit outbound limitations. |
| AI-021 | Own-history/workspace information, no recursive runs or privileged chat administration. |
| AI-022 | Preserve completed lifecycle/lease evidence; UI/worker consumption remains AI-023/007. |
| AI-023 | Add durable clarification and bounded presentation/stream consumers, safe continuation and truthful progress. |

## Scope and verification

All changes are under `.agentic`. Completed task files and historical evidence are unchanged. New AI-024..028 start as mandatory todo; no acceptance boxes were checked. Existing phase order, Stripe freeze, new-tax exclusion, financial/IRR/native/release gates and provider defaults are retained. The user requested task improvements, so no implementation task was started or marked complete.

Final planning checks: No application lint/typecheck, build, dev server, database, browser or provider tests are needed to establish this Markdown-only planning change; those are not claimed as performed.

- Controller validation: passed, 413 tasks. The next command still selects AI-023; no active task was created.
- Four existing focused controller tests passed in 33.106 seconds: AI-before-phase-5 ordering, deferred-phase-5 integration dependency, graph scheduling without deadlock, and split preservation of original children/dependencies. Command: python -m unittest test_agent.ControllerTests.test_owner_phase_order_selects_ai_before_deferred_phase_five test_agent.ControllerTests.test_deferred_phase_five_keeps_ai_integration_dependency test_agent.ControllerTests.test_phase_five_waits_for_data_and_translation_without_deadlock test_agent.ControllerTests.test_split_preserves_existing_children_and_original_dependencies (from .agentic/tests).
- Read-only graph/metadata audit passed: AI-013 reaches all 27 other AI tasks; AI-009 retains its child integration gate; all 80 open tasks resolve without a cycle/deadlock. This is a scheduling rehearsal, not execution/completion evidence.
- Preservation audit passed: edited existing tasks were todo and retain status, owner, evidence, review, waiver, human-review/optional flags and checked-criterion state. No completed task or previous evidence file changed. Five new tasks are mandatory todo without evidence.
- Local Markdown target check passed for 738 links across touched/new planning files; all task History sections remain last.
- git diff --check passed. Application implementation, live provider, rendered browser, native Persian and full controller lifecycle simulation were not performed or claimed.
