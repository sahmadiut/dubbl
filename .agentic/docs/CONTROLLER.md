# Controller reference

## Data and safety model

Python 3.10+ standard library; works offline. Each `tasks/ID.md` contains a strict JSON object between `---` lines, followed by human-readable Markdown. JSON is a deliberate restricted front-matter format: no YAML parser dependency or executable metadata. Task files are the sole status source; all dashboards are computed. `docs/TASK_INDEX.md` is an initial navigation index, not live status.

State path: `todo -> in_progress -> review -> done`. Review rejection returns to `in_progress`. Open work can become `blocked`, then resume. Only optional tasks may become `skipped` with documented owner scope approval. A skipped prerequisite is considered resolved for dependency ordering, not implemented. Mandatory work cannot be skipped. A blocked task does not block unrelated ready work; an active or review task occupies the single work slot.

Selection: active/review first; otherwise eligible todo tasks by phase, priority (0 first), ID. A ready task has all dependencies done or explicitly skipped. Phase labels are planning groups, not hidden barriers; express every hard gate as a dependency. Status reports the earliest unfinished phase and count-based progress, not effort-weighted progress. Maintenance and the delayed contract phase are included in the initial 60 tasks and can remain open after production acceptance.

## Commands from repository root

```bash
python3 .agentic/agent.py validate
python3 .agentic/agent.py status
python3 .agentic/agent.py --json status
python3 .agentic/agent.py next
python3 .agentic/agent.py context
python3 .agentic/agent.py show AUD-001
python3 .agentic/agent.py start AUD-001 --owner coding-assistant
```

`context [ID]` emits project/role/task/handoff/dependency pointers for the current task. Read the referenced evidence and registries as needed; the output intentionally does not duplicate the whole plan. `--root /path/to/.agentic` and `--json` are global options and must appear before the subcommand. Script location determines its default root, so read-only commands also work from another directory. Exit 0 means command success; invalid data/transitions use exit 2. No ready task is a successful query with an explicit empty result, not a fabricated completion.

## Finish a task

First edit the task's Handoff section and create `evidence/AUD-001-attempt-1.md` from the evidence template using real results. Then, for each criterion actually met:

```bash
python3 .agentic/agent.py check AUD-001 1 --note "See baseline evidence, section 1"
python3 .agentic/agent.py check AUD-001 2 --note "See baseline evidence, section 2"
python3 .agentic/agent.py check AUD-001 3 --note "See baseline evidence, section 3"
python3 .agentic/agent.py submit AUD-001 --evidence evidence/AUD-001-attempt-1.md
```

Create a separate review evidence Markdown file with actual findings. For an honestly identified self-review:

```bash
python3 .agentic/agent.py review AUD-001 --result approve --reviewer coding-assistant --kind self --evidence evidence/AUD-001-review-1.md
python3 .agentic/agent.py done AUD-001
```

`--kind peer` means a real separate reviewer; `--kind human` records an actual human's review, not a model role-play. Human-review tasks reject self/peer approval. The CLI cannot authenticate a human or prove that prose/tests are true; it enforces workflow structure. The operator is responsible for honest evidence. The required human reviews come from the [Markdown implementation plan](../sources/SOURCE.md)'s parity, accounting, linguistic, security, migration and release gates.

`review --result reject` returns work for repair. Editing acceptance/content/evidence after approval invalidates its fingerprint. Re-submit and review again. Completed task evidence is immutable; use new attempts instead of rewriting old shared evidence. Do not mutate done task content before reopening.

New review fingerprints use `digest_version: text-lf-v1`: evidence is decoded as UTF-8 and line endings normalized to LF before hashing. Git's LF/CRLF checkout conversion does not invalidate approval; other whitespace and content edits still do. Historical unversioned byte fingerprints remain accepted only when matching combinations of exact current bytes or LF/CRLF representations of the same evidence content, including mixed line endings across files. Legacy candidate combinations are bounded at 4096; larger cases require a new review. No old review identity, evidence or task status is rewritten. Unknown fingerprint versions are rejected.

## Pause and recover

```bash
python3 .agentic/agent.py note AUD-001 --note "Inspected schema; next inspect API boundary"
python3 .agentic/agent.py block AUD-001 --reason "Repository source is not available; needs local checkout"
python3 .agentic/agent.py resume AUD-001 --owner coding-assistant --note "Local checkout is now available"
```

Before ending any session update Handoff with files changed, checks actually run, unverified items and exact next action. In-progress work stays selected next time. `note` appends history without changing status. `check ... --undo` clears a criterion only while in progress.

Optional deferral example (only after actual owner decision and evidence file creation):

```bash
python3 .agentic/agent.py skip PAR-006 --reason "Owner deferred multi-branch scope" --reviewer project-owner --evidence evidence/branch-scope-decision.md
```

`reopen ID --reason ...` returns done/skipped work to todo. Completed/active downstream tasks must be reopened first in reverse dependency order; do not invalidate their prerequisites silently. Reopened checkboxes/evidence are preserved as history and must be reverified or unchecked. New review is mandatory.

## Add or split work

Copy `templates/TASK.md` to a unique `tasks/ABC-001.md`, edit all metadata and acceptance details, then run validate. Extend the task index and source coverage when scope changes. Never reuse an existing ID. New IDs must be uppercase group plus a numeric suffix of at least three digits.

For a task too broad for one bounded change: return its in-progress status to a documented blocked state, create child tasks with the parent's original prerequisites, then add those child IDs to the parent's dependencies. Keep the parent as a final integration/acceptance task. Children must NOT depend on their parent, which would make a cycle. Once children finish, resume the parent to verify integration. Update the parent's criteria honestly; never silently delete requirements. Structural metadata editing is allowed for this planning operation, followed immediately by validate. Do not edit done tasks without reopening first.

## Integrity limits and crash recovery

The controller validates IDs, schema, roles, dependencies, cycles, single active task, evidence paths and completion gates. Mutations acquire an exclusive local lock, reread current state and atomically replace one task file. No shell command embedded in Markdown is executed. Task metadata and approval fingerprints are not an access-control system or tamper-proof audit log; Git review supplies change history. Simultaneous manual edits are not locked. Remote copies/git branches are not coordinated. Use one writer per checkout; resolve merge conflicts and run validate before continuing.

On a crash, inspect `.controller.lock` for PID/time, establish that no writer is still running, then remove only that stale lock and re-run validate. Do not auto-delete a live lock. If a manually edited done task no longer validates, restore its last valid version from Git, then use reopen before editing. The tool has no bypass-validation mutation command.

Use `python3 -m unittest discover -s .agentic/tests -v` to test the controller on temporary copies. These tests validate orchestration only; they do not qualify Dubbl's financial implementation.

## Requirements source references

The authoritative requirements are in [sources/SOURCE.md](../sources/SOURCE.md). Task inputs link directly to its Markdown section anchors; direct document links and `source_sections` record those locations. The required `source_pages` field stays empty for controller schema compatibility and is not a source locator. New tasks should use Markdown sections, not page numbers. [PLAN_COVERAGE](../sources/PLAN_COVERAGE.md) maps sections to task families. Historical evidence remains an immutable record of its audit date; current source references are governed by SOURCE.md.
