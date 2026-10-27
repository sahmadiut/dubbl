# AI priority and phase-5 scheduling update

Date: 2026-10-27 (Asia/Tehran). Branch: `fresh-start`.
Scope: planning and controller scheduling only; no implementation task started.

## Actual owner instruction

The owner requested changes on the current branch: postpone phase 5, bring the
AI phase forward now, and explain phase 7 in Persian. DEC-009 supersedes the
2026-10-17 deferred-AI ordering decision.

## Applied change

- Preserve phase IDs; schedule `0, 1, 2, 3, 4, 11, 5, 6, 7, 8, 9, 10`.
- Remove 38 unfinished-backlog ordering prerequisites from AI-001, retaining
  its completed technical prerequisites and all internal AI dependencies.
- Add AI-013 as a prerequisite to the seven open phase-5 tasks. Their mandatory
  scope, todo status, phase IDs and acceptance criteria remain intact.
- Synchronize entry instructions, controller reference, AI plan, task index,
  requirements and coverage. Completed/skipped tasks and their evidence remain
  untouched. No application, Stripe, schema, runtime flag or release gate changes.

## Executed verification

- `python .agentic/agent.py validate`: passed, 376 tasks.
- `python .agentic/agent.py status` and `next`: AI is the current phase;
  AI-001 is next with no unmet dependencies. Counts remain 317 done, 51 todo,
  8 skipped; no task was claimed or completed by this planning operation.
- Focused Python unittest suite: 42 tests ran in 214.317 seconds, 41 passed,
  one skipped because the Windows account lacks symlink privilege. This covers
  the two new scheduling/dependency regressions and existing transition,
  active-slot, review, dependency, split-parent and evidence-integrity checks.
- The initial full `unittest discover` run was stopped at its exhaustive
  per-task workflow simulation. The focused suite loads ControllerTests and
  runs all cases except `test_full_graph_can_resolve_without_deadlock` and
  `test_graph_resolution_includes_new_split_child`; those two expensive
  workflow simulations are not claimed as passed.
- Separate in-memory dependency rehearsals resolved all 376 tasks without a
  deadlock, and all 377 with a synthetic split child. A current-state rehearsal
  selected all 13 AI tasks before PAR-001. These checks exercise ordering only,
  without writing task states or fabricating real completion/review evidence.
- Diff assertions confirmed orchestration-only changes, unchanged task statuses,
  stable phase IDs and unchanged acceptance criteria. `git diff --check` passed.

No full build, dev server, application database, live provider, deployment,
commit or push was run. Financial, authorization, linguistic, IRR activation and
production-release qualification remain applicable. AI enablement remains
subject to the existing default-off rollout and approval requirements.

## Handoff

Next task: AI-001, capability inventory and execution contracts. Phase 5 follows
AI-013. Phase 7 retains its 12 translation-completion and native-acceptance tasks;
the owner receives a Persian explanation in the conversation.
