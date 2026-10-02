# Controller CI correction: portable review fingerprints

2026-10-02 (Asia/Tehran), coding-assistant. User reported the Task Controller GitHub failure; this is a bounded repair, not a new backlog task or renewed financial/owner approval. Entry HEAD f97158c91009a6291c0f78dbddc2708034d64642, clean tree. Changes uncommitted.

## Observed failure and cause

Read actual job 110820518041 logs in [run 37001662916](https://github.com/sahmadiut/dubbl/actions/runs/37001662916). Validation failed with exit 2: `AUD-001: content/evidence changed since review; submit/review again`; controller tests consequently skipped. Lint, typecheck, application tests and PostgreSQL migration fixtures succeeded; dependent build/Docker/migration jobs skipped. CLI run-log download initially failed with a TLS handshake timeout; GitHub connector job-log retrieval succeeded.

The old digest hashed evidence raw bytes. AUD-001/003/004 evidence lists combine LF files with SOURCE-MARKDOWN-reference-update-2026-10-02.md, whose working copy is CRLF. Git stores that last file as LF. Local validation passed, but committed Git blob digests failed for those three tasks. A temporary reconstruction using exact Git blobs reproduced the original AUD-001 validation error. No historical evidence content had to change.

## Repair and verification

agent.py now produces versioned text-lf-v1 fingerprints from UTF-8 evidence text with normalized line endings. Historical unversioned approvals match only exact raw/LF/CRLF equivalent hashes per file, with at most 4096 candidate combinations. This supports the actual mixed evidence set without changing historical approval identities, evidence, task states or review kind. Unknown digest versions and actual text/whitespace edits remain rejected. CONTROLLER.md documents the behavior. Five new controller regressions exercise new fingerprints, both legacy checkout directions, mixed evidence and unknown versions; evidence edits remain negative cases.

All commands from D:/Projects/dubbl:

- `python -m unittest discover -s .agentic/tests -v`: final exit 0, 31 tests in 69.818s, 30 passed, one existing Windows symlink-privilege skip. No Linux execution claimed locally.
- `python .agentic/agent.py validate`: exit 0, all 60 tasks structurally valid. `status`: unchanged seven done/four skipped, MON-001 next.
- Temporary exact Git-blob reproduction: original controller exit 2; repaired controller exit 0. Converting all evidence in that temporary copy to CRLF also exits 0. Appending a real content alteration to AUD-001 evidence still exits 2 with the review-invalidated error. Temporary copy removed; actual evidence unchanged.
- Explicit verification of all seven existing approval digests: passed without metadata changes.
- `git diff --check`: exit 0, only LF/CRLF Git notices.

Initial repair considered whole-set LF/CRLF conversion but did not pass the actual mixed evidence case; corrected to bounded per-file equivalent combinations before final verification. An intermediate 30-test suite passed; final five-regression suite includes the mixed historical case.

Self-reviewed changes; no independent/human review claimed. No application/schema/API/MCP changes, database mutation, build/dev/Docker/deployment, commit, push or remote workflow rerun. Next action: commit/push this repair so GitHub tests the corrected commit; rerunning f97158c alone would still use the old controller. A push continues to use existing CI job conditions, including the existing production migration job. Backlog remains ready for MON-001 on a later continuation.
