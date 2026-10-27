# Iran business scope and planning verification

Date: 2026-10-27 (Asia/Tehran).

## Owner authorization

The owner asked to add the reviewed capabilities to tasks, explicitly excluding tax because Iranian tax tasks will be defined separately later. The owner then rejected placing them within phase 5 and instructed placing them before phase 5, whose existing tasks may be deleted in a later decision. This authorizes backlog preparation, not implementation, deletion of phase-5 tasks, tax work or production activation.

## Changes

Added stable phase 12 (Iran business capabilities), scheduled after phase 7 and before phase 5, with 22 todo tasks: MOD-001..003, SVC-001..003, TRY-001..004, IRO-001..003, POS-001..004, PAYIR-001..002, COL-001..002 and IRN-001. Preserved existing phase IDs and all existing phase-5 criteria. Open phase-5 tasks and QA-001 now depend on independent IRN-001 acceptance; no phase-12 task depends on phase 5. Existing AI-first ordering remains. Source, coverage, task index, decision, entry-point and delivery-plan documentation were updated. New tax tasks are excluded, including payroll tax and Modian.

Existing dirty files from earlier planning were preserved. No application code, schema, production flags or existing task statuses changed. No commit, push, build, dev server or deployment was performed.

## Verification

- `python .agentic/agent.py validate`: passed, 398 tasks.
- `python .agentic/agent.py status`: 22 new phase-12 tasks are todo; AI-001 remains next; phase 12 appears between 7 and 5.
- Independent in-memory simulation of all 398 tasks: passed, no deadlock; L10N-012 precedes MOD-001, IRN-001 precedes open phase-5 tasks. No task state was persisted.
- `git diff --check`: passed; existing LF/CRLF notices are informational.
- Initial validation/test attempt exposed out-of-range task priorities; corrected all new priorities and the test fixture to the controller's 0..3 range. Final validation passes.
- Full controller suite replay was stopped after prolonged execution of exhaustive per-transition graph tests. The final bounded suite excludes `test_full_graph_can_resolve_without_deadlock` and `test_graph_resolution_includes_new_split_child`; the independent full-graph scheduling simulation above provides ordering/deadlock coverage but does not claim those exhaustive mutation tests passed.
- Bounded controller suite: 44 tests run in 226.056 seconds, OK, 1 skipped (Windows symlink privilege); 43 passed, including new phase-order regression. Two exhaustive replay tests excluded as described above.

This is planning evidence only, not implementation or legal/provider qualification.
