# Agent entry point

## Project in one glance

Build on the user's existing Dubbl fork. Preserve its architecture and existing capabilities. Audit Bigcapital's public behavior/API and independently implement valuable gaps. Deliver complete Persian localization, RTL and production-safe IRR using exact money/FX storage. Do not copy Bigcapital implementation code. The attached plan is a requirements source, not proof about this fork's current state.

Current implementation truth is the actual repository plus task evidence. `python3 .agentic/agent.py status` computes current phase, active work, blockers and next task directly from Markdown. Never maintain a competing handwritten progress counter.

## One-task execution loop

Current owner scope decision: Docker is not required for the current work. Do not require installation, execute Docker builds/tests, or block tasks solely on unavailable Docker. Necessary Docker configuration/documentation may be written and inspected without execution; record it as untested. This applies to Docker requirements throughout the backlog until the owner changes the decision. See `docs/DECISIONS.md`, DEC-002. Other checks and runtime/financial acceptance requirements remain in scope.

Current database authorization: the owner confirmed that the local `dubbl` database configured by DATABASE_URL in .env is a test database and authorized necessary queries for project work (DEC-003). Use the existing environment variable without printing or persisting its credentials. Do not ask again whether this target is a test database. Keep test fixture changes scoped and identifiable; wholesale deletion/reset is not implied. Dev-start and build restrictions remain separate.

1. Read applicable repository instructions, `docs/PROJECT.md` and `docs/REPOSITORY_MAP.md`. Run `python3 .agentic/agent.py validate`, `status`, and `context`. Inspect git status without changing unrelated work.
2. Resume `in_progress` first. If the active task is `review`, complete its review or request its genuinely required human review; do not start another task to evade review. Otherwise choose the first ready task returned by `next` and claim it with `start ID --owner NAME`.
3. Read the task, dependency evidence, role and relevant registries. Verify current source code. Plan assertions and sample paths are not confirmed facts. AUD-001 must discover the actual repository commands.
4. Work on exactly this task. Reuse existing correct code. If too large for one coherent change, follow `docs/CONTROLLER.md` to split it into child tasks; do not silently claim the entire parent complete. No automatic multi-agent delegation is required.
5. Run meaningful checks appropriate to the actual diff. Use `templates/EVIDENCE.md` for a unique `evidence/ID-attempt-N.md`. Record actual commands/results, files, known limitations and review. Do not fabricate tests, humans, commit IDs or approvals.
6. Update the task's Handoff section and relevant registries. Mark each acceptance criterion with `check ID NUMBER --note ...` only when evidence supports it. `submit` with evidence, review honestly (`self`, `peer` or actual `human`), then `done`. Human-review tasks may wait in `review`; an AI must never impersonate the approver.
7. If blocked, write the precise blocker and next action, then `block ID --reason ...`. Do not skip mandatory work. Optional tasks can be deferred only with an explicit documented owner scope decision.
8. Run `validate` and `status`. End with selected task, changes, checks/results, status, blockers and next task. Stop after one task, even if more work is ready. Do not auto-deploy from a generic continue prompt.

## Non-negotiable correctness

- Exact minor-unit integers, exact-decimal FX and explicit rate direction. No floating-point ledger math or hardcoded cents assumption.
- Preserve existing balances and v1 compatibility. USD 1250 stays 1250 minor units. Do not rescale old IRR based on magnitude.
- Persist transaction FX, canonical Gregorian date-only values and UTC instants. Locale, currency, timezone and calendar are independent.
- IRR production enablement waits for verified money/FX and migration gates. Tracker completion does not itself change application flags.
- Never rewrite posted history for a future currency regime. Verify actual official rules at implementation/release time.
- Enforce organization scope, authorization, period locks, audit and idempotency in every new workflow.
- Preserve English behavior, accessible keyboard order and mixed-text readability. Persian financial wording needs native review.
- Keep upstream mergeability, original notices and clean-room provenance. Unspecified tax/payroll/e-invoicing/hosting/provider obligations remain explicit scope decisions.

All orchestration files are written in English. Persian product translations belong in the actual application's locale assets; review examples may include the data needed to test Persian behavior.
