# Dubbl agentic project workspace

An English, repository-local execution system for the [Markdown implementation plan](sources/SOURCE.md). It contains 60 initial tasks, explicit dependencies, eight responsibility profiles, evidence-based completion, and an offline Python controller. It is a project operating system, not an implementation of Dubbl itself.

## Install once

1. Extract the ZIP at your existing fork's repository root. The ZIP contains the hidden `.agentic/` directory. Enable hidden-file display if necessary.
2. Preserve any existing `.agentic` directory: review and merge rather than overwrite it. Do not replace an existing root `AGENTS.md`.
3. From the repository root run `python3 .agentic/agent.py validate`, then `python3 .agentic/agent.py status`.
4. Give your coding assistant the bootstrap prompt in `prompts/BOOTSTRAP.md`. It inspects the actual fork before claiming implementation progress.
5. Optionally merge the small text from `templates/ROOT_AGENT_INSTRUCTIONS.md` into your existing root agent instructions. This is important because most coding assistants do not automatically discover instructions inside an arbitrary hidden directory.
6. Commit `.agentic/` with the implementation changes it describes. Evidence must be sanitized; never commit credentials or real customer data.

Windows: use `python` instead of `python3` if that is your installed Python launcher. Requires Python 3.10 or later; no pip packages, API key, server or network access is needed for the controller.

## Everyday use

```bash
python3 .agentic/agent.py status
python3 .agentic/agent.py next
python3 .agentic/agent.py context
python3 .agentic/agent.py --json status
```

After the root instructions are installed, your prompt can simply be:

> Continue.

A portable prompt when automatic instruction loading is uncertain:

> Read .agentic/START_HERE.md and continue exactly one ready task. Resume active work first, verify the result, update the task and evidence, and stop with a concise handoff.

The controller selects work and tracks state. The coding assistant reads the context, edits the actual repository and runs appropriate checks. The controller does not call an AI, execute project code, poll for work, deploy, schedule maintenance or authenticate reviewers.

## Start here

- `START_HERE.md`: compact agent contract and one-task loop.
- `docs/PROJECT.md`: intent, architectural constraints and unknowns.
- `docs/TASK_INDEX.md`: complete initial task map.
- `docs/CONTROLLER.md`: CLI and state machine.
- `docs/REPOSITORY_MAP.md`: verified local paths/commands; initially unknown.
- `docs/TEST_MATRIX.md`: financial, locale, security and release checks.
- `sources/SOURCE.md`: authoritative Markdown requirements source.
- `sources/PLAN_COVERAGE.md`: traceability from Markdown sections to task families.
- `registries/`: parity, money, upstream, provenance, terminology and currency facts.
- `tasks/`: the single source of truth for task state.

No source repository was supplied when this package was built. The first task is baseline inspection. All 60 implementation tasks start as `todo`; this means unverified, not that the fork contains no working features. No current legal, currency or provider assertion from the source plan has been independently reverified here.
