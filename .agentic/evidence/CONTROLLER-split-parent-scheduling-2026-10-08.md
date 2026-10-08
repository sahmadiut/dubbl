# Controller split-parent scheduling correction — 2026-10-08

## Identity

Operator: Codex. Repository: D:\Projects\dubbl. Baseline HEAD: 405b102a0849eaf22ae50f9e5d9892dc0e6274b5. The working tree was clean at entry; this correction is local and uncommitted. No application build, dev server, database operation, deployment or delegated reviewer was used.

## Implementation or audit result

The checked-out controller selected only eligible `todo` tasks, while 19 split parents remained `blocked`. Thirteen had no unresolved dependencies. The next task was MON-033 despite those parents retaining open integration acceptance.

Changes:
- Optional `split_children` metadata is validated as a unique list of strings contained in `depends_on`; ordinary historical tasks remain compatible.
- `split ID --children CHILD... --note ...` adds children to dependencies and split metadata, retains original prerequisites/children/criteria, queues the todo/in-progress parent, clears owner/blocker/review and releases its slot. Cycles, unknown children, self-dependency, duplicate children, blank notes and unresolved blocked states are rejected without writing.
- `queue ID --note ...` explicitly resolves a blocked task to todo without claiming the active slot or requiring its dependencies to have finished.
- Ready parents precede unrelated eligible tasks within the same phase; active/review precedence and all dependency gates remain intact.
- Genuine external blockers remain blocked even when children finish. Child completion does not check or complete parent acceptance.
- Updated START_HERE, the controller reference and task template to use the split command for future splits.
- Inspected each blocked parent's reason, dependency list and handoff, registered its actual children and used the controller queue transition for all 19. Added scheduling handoffs/history; removed the obsolete MON-029 handoff claim that queue is unavailable.

Migrated parents: MON-006, MON-012, MON-014, MON-015, MON-016, MON-018, MON-019, MON-020, MON-021, MON-022, MON-024, MON-025, MON-026, MON-028, MON-029, MON-101, MON-102, MON-104, MON-105.

## Acceptance mapping

1. Finished children release their parent for independent integration: new regressions cover split → child completion → ready parent, legacy blocked → queue → ready, original prerequisites, priority, active/review slots and nested integration.
2. Blockers and acceptance remain honest: new regressions cover external blockers, invalid splits, metadata validation, queue resolution notes and explicit optional deferral. Parent submission with unchecked criteria still fails.
3. Backlog correction preserves completed work: SHA-256 comparisons verified all 109 previously done/skipped task files unchanged. Comparison to Git HEAD verified each of the 19 parents retains exactly its original acceptance section. Original dependencies remain unchanged during migration.

## Verification

| Command / procedure | Fixture | Observed result | Limitation |
|---|---|---|---|
| `python -m unittest discover -s .agentic/tests -v` | Temporary copies of backlog | Exit 0; 42 tests run, 41 passed, 1 skipped (Windows symlink privilege unavailable); 672.629 seconds | Controller behavior only; synthetic evidence/review identities |
| `python .agentic/agent.py --json validate` | Actual backlog | Exit 0, valid, 173 tasks | Structural validation, not product qualification |
| `python .agentic/agent.py status` and `--json next` | Actual backlog | 105 done, 64 todo, 4 skipped, 0 blocked; 15 ready including 13 integration parents; next MON-101 | Count-based progress, not effort |
| Read-only SHA-256 comparison of closed task files | Actual backlog, before/after correction | 109/109 unchanged | Does not qualify their product behavior |
| Acceptance-section comparison against `git show HEAD:.agentic/tasks/ID.md` | All 19 migrated parents | 19/19 unchanged | Open acceptance remains open |
| Remaining-backlog simulation via controller mutations on a temporary copy | Copied actual current states, synthetic criteria/evidence/reviews | All 64 remaining tasks resolved, all 19 integration parents selected, no deadlock; phase-local parent precedence asserted at every selection | Synthetic human labels used only in temporary fixtures; no real approval or completion |
| `git diff --check` | Local correction | Exit 0 | Git reports normal LF/CRLF checkout notices for controller-written task files |

The actual-state simulation retained existing completed/skipped tasks, used real dependency metadata, repeatedly selected the controller's next task and supplied artificial acceptance/evidence/review records only in its temporary copy. It asserted no ready integration parent was bypassed by an ordinary task in the same phase. Final copied state had no blocked/waiting work and no next task. No real task acceptance, evidence, review or completion was fabricated.

Observed money-phase simulation order:
MON-101, MON-102, MON-104, MON-105, MON-018, MON-019, MON-020, MON-021, MON-022, MON-014, MON-024, MON-025, MON-026, MON-028, MON-029, MON-015, MON-033, MON-034, MON-016, MON-012, MON-006, MON-007, MON-008, MON-009, MON-010.

## Review

Codex self-review of scheduling, transitions, task migration and assertions. No peer or human review is claimed. Completed task files and historical evidence were preserved. Product integration, accounting qualification and production readiness remain each task's responsibility.

## Handoff

Next task: MON-101, still todo, with all dependencies resolved and its original acceptance unchecked. Thirteen integration parents are ready. Six wait in todo: MON-006, MON-012, MON-014, MON-015, MON-016 and MON-029. They will become eligible automatically after all dependencies qualify.

Use the documented split command for future decomposition; use block for genuine external blockers and queue only after resolving them. This correction does not start or complete a product task, commit/push changes or enable production flags.
