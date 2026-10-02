# Upstream Dubbl registry

Local baseline inspected 2026-10-02 for AUD-001. No fetch or remote freshness claim. Evidence: `../evidence/AUD-001-attempt-1.md`.

| Field | Verified value | Evidence |
|---|---|---|
| Fork remote | https://github.com/sahmadiut/dubbl.git (origin) | git remote -v |
| Fork branch / HEAD | master / f30f34aa55fe316a5e4ab79cdb70c9f61f6d5840 | Git inspection |
| Upstream remote / local pinned commit | https://github.com/dubbl-org/dubbl.git; upstream/master 13c3cf14e7900d32ad0ee8081c385e404dc120f9 | Local remote refs; latest online SHA unverified |
| Original license and notices | LICENSE present, Apache-2.0; complete review pending AUD-003 | LICENSE/README |
| Last upstream comparison | 2026-10-02 local comparison: 0 behind, 1 ahead | git rev-list --left-right --count upstream/master...HEAD |
| Intentional divergence | HEAD adds 99 .agentic files; no product runtime differences from local upstream | git show --stat HEAD, git diff --name-only upstream/master HEAD |
| Existing user changes | Clean working tree at task entry; audit docs/evidence/tracker changes now uncommitted | git status --short |

For each future merge: record date, source/target commits, conflicts, retained local decisions, migration/API effects and executed regression checks. Preserve mergeability; avoid unrelated architecture rewrites. OPS-001 starts recurring review after release.
