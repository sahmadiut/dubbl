# Text to merge into existing root agent instructions

This repository uses `.agentic/START_HERE.md` as its project execution contract. For "continue" or project implementation work, read that file, run `python3 .agentic/agent.py context`, and advance exactly one eligible task. Resume active work first. Update task Markdown and concrete evidence, validate state, and leave a handoff. Do not invent completed work or human approval. Preserve the repository's other instructions and unrelated edits.

Do not copy this template over an existing root instructions file; merge the paragraph deliberately. If your tool uses a different instruction mechanism, add the same pointer there.
