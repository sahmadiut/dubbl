# CI controller graph-size regression diagnosis and repair

2026-10-02, Asia/Tehran. Operator/self-reviewer: codex. Owner explicitly asked
to inspect the GitHub CI failure. Entry HEAD
`2aeba9312e90713a3334304abcb19c8b4240efbb`, clean tree. This is bounded CI maintenance;
no backlog task was started, reopened or completed. Fix remains uncommitted.

## Remote evidence and cause

Queried the fork explicitly with GitHub CLI `-R sahmadiut/dubbl` after discovering
the CLI's implicit repository selection pointed to upstream. No repository
setting, secret, workflow dispatch or remote write was performed.

- [Latest run 37024111305](https://github.com/sahmadiut/dubbl/actions/runs/37024111305)
  at current HEAD: Task Controller's validation step passed; Python unittest step
  failed. Lint, Typecheck, Test and PostgreSQL Migration Fixtures passed. Build
  and Docker Build were skipped because the controller prerequisite failed.
- [Failing controller job](https://github.com/sahmadiut/dubbl/actions/runs/37024111305/job/110894266540)
  reports `test_initial_graph_has_one_ready_task`: `66 != 60`, and
  `test_full_graph_can_resolve_without_deadlock`: `65 != 60`.
- Tests hard-coded the initial 60-task count and limited graph resolution to 65
  iterations. MON-006 and MON-012 implementation splits expanded the graph to
  66 tasks. The fixed count became stale, and the simulation could stop before
  completing every task even after updating the count alone.
- [Prior run 37019406808](https://github.com/sahmadiut/dubbl/actions/runs/37019406808)
  also had stale controller counts and the old `/safe-number/` integration
  assertion. That storage-error assertion was already corrected in MON-013;
  the latest hosted PostgreSQL job now passes. It needs no additional fix here.

## Repair and self-review

Changed only `.agentic/tests/test_agent.py`:

- Initial fixture counts come from actual copied task files, while preserving
  the required sole ready task and all-todo initial state assertions.
- Graph resolution collects the fixture's expected task IDs independently from
  controller status, derives a finite iteration budget from them, rejects repeat
  selection and requires exact completion membership. No-next/blocked/waiting
  assertions remain. Runtime controller validation/review/dependency gates are
  unchanged.
- Added a regression that appends a synthetic split child to the copied graph,
  gives it the parent's original prerequisites and adds it to the parent's
  dependencies. All 67 copied tasks must resolve. Parent acceptance criteria
  remain intact. No real task or evidence content is modified by the test.

Self-review finds no remaining scoped issue. Dynamic membership assertions
preserve deadlock/completion checks instead of replacing them with a new fixed
number. Existing authorization, human-review, evidence tampering, line-ending,
lock, cycle and reopening tests remain enabled.

## Actual verification

Commands ran in `D:/Projects/dubbl`.

| Command | Actual result | Limit |
|---|---|---|
| `gh run list -R sahmadiut/dubbl --limit 8 --json databaseId,displayTitle,headSha,status,conclusion,url,createdAt` | Exit 0; identified latest fork failures/current SHA | Read-only hosted evidence |
| `gh run view 37024111305 -R sahmadiut/dubbl --json jobs,url,conclusion` and `--log-failed` | Exit 0; controller-only latest failure and exact assertions | Remote run predates this local fix |
| `gh run view 37019406808 -R sahmadiut/dubbl --log-failed` | Exit 0; prior failures explained above | Historical evidence only |
| `python -m unittest discover -s .agentic/tests -v` | Exit 0; 32 tests in 103.072s, 31 passed and 1 Windows privilege skip | Symlink escape test skips existing Windows error 1314; hosted Linux must run it |
| `python .agentic/agent.py validate` | Exit 0; 66 real tasks valid | Structural checks only |
| `python .agentic/agent.py status` and `git diff -- .agentic/tasks` | Real counts unchanged; next MON-014; no task diff | No actual delivery progress inferred from synthetic fixtures |
| `git diff --check` | Exit 0 | LF/CRLF notice only |

No application code, workflow configuration, DB schema, migration, dependency,
completed task/evidence or production flag changed. No full build, dev server,
Docker, DB mutation, deployment, push or CI rerun was executed. Application
checks were read from the actual latest hosted run and are not claimed as new
local runs. The local fix must be committed/pushed before GitHub can validate it;
the existing remote run remains failed. Final task/controller validation and
whitespace checks are recorded by the following terminal commands.
