---
{
  "id": "DATA-001",
  "title": "Implement generalized import jobs",
  "phase": 6,
  "role": "backend",
  "depends_on": [
    "PAR-008"
  ],
  "source_pages": [
    6,
    15,
    20,
    32
  ],
  "status": "todo",
  "priority": 1,
  "optional": false,
  "human_review": false,
  "owner": null,
  "block_reason": null,
  "evidence": [],
  "review": null,
  "waiver": null
}
---

# DATA-001 — Implement generalized import jobs

## Objective and implementation scope

Audit existing imports; add scoped object imports with mapping, strict validation, dry run, idempotency, row errors, batching and resumable jobs. Preserve bank CSV/manual entry.

## Inputs

- Supplied implementation plan, pages 6, 15, 20, 32; see sources/PLAN_COVERAGE.md.
- Actual fork source and tests, docs/REPOSITORY_MAP.md, and relevant registries.
- Dependency task evidence; plan assertions alone do not prove implementation.

## Acceptance criteria

- [ ] Malformed localized money/dates produce actionable errors.
- [ ] Partial failure and retry cannot duplicate postings.
- [ ] Import jobs and uploaded artifacts enforce tenant/privacy limits.

## Verification

Run the repository's discovered commands for the affected behavior. Add meaningful regression/negative tests for financial, migration, authorization or compatibility changes. For an audit/documentation task, verify source links and reproduce claimed commands. Record exact command, exit result, fixture/context, observed outcome and limitations in a task-specific evidence Markdown file. Never report an unrun check as passed.

## Handoff

Not started. First inspect the actual fork; replace this with changed files, completed steps, remaining work, blockers and the exact next action before ending a session.

## History

- Initial backlog generated from the supplied plan. Implementation status is unverified; no task is marked complete.
