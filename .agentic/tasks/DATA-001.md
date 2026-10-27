---
{
  "id": "DATA-001",
  "title": "Implement generalized import jobs",
  "phase": 6,
  "role": "backend",
  "depends_on": [
    "MON-008",
    "RTL-002",
    "AI-013"
  ],
  "source_pages": [],
  "status": "todo",
  "priority": 1,
  "optional": false,
  "human_review": false,
  "owner": null,
  "block_reason": null,
  "evidence": [],
  "review": null,
  "waiver": null,
  "source_sections": [
    "bigcapital-to-dubbl-feature-map",
    "security-and-privacy",
    "performance"
  ]
}
---

# DATA-001 — Implement generalized import jobs

## Objective and implementation scope

Audit existing imports; add scoped object imports with mapping, strict validation, dry run, idempotency, row errors, batching and resumable jobs. Preserve bank CSV/manual entry.

## Inputs

- Requirements: [Markdown implementation plan](../sources/SOURCE.md), sections [`bigcapital-to-dubbl-feature-map`](../sources/SOURCE.md#bigcapital-to-dubbl-feature-map), [`security-and-privacy`](../sources/SOURCE.md#security-and-privacy), [`performance`](../sources/SOURCE.md#performance). See [coverage map](../sources/PLAN_COVERAGE.md).
- Actual fork source and tests, docs/REPOSITORY_MAP.md, and relevant registries.
- Dependency task evidence; plan assertions alone do not prove implementation.

## Acceptance criteria

- [ ] Malformed localized money/dates produce actionable errors.
- [ ] Partial failure and retry cannot duplicate postings.
- [ ] Import jobs and uploaded artifacts enforce tenant/privacy limits.

## Verification

Run the repository's discovered commands for the affected behavior. Add meaningful regression/negative tests for financial, migration, authorization or compatibility changes. For an audit/documentation task, verify source links and reproduce claimed commands. Record exact command, exit result, fixture/context, observed outcome and limitations in a task-specific evidence Markdown file. Never report an unrun check as passed.

## Handoff

Owner scheduling clarification, 2026-10-27 (DEC-009): implement imports over existing capabilities after AI, using completed exact-money and RTL foundations. Report/parity expansion in phase 5 is deferred and no longer gates this task. Existing validation, authorization and idempotency criteria remain required.

Not started. First inspect the actual fork; replace this with changed files, completed steps, remaining work, blockers and the exact next action before ending a session.

## History

- Initial backlog generated from the supplied plan. Implementation status is unverified; no task is marked complete.
- 2026-10-27T11:44:56+00:00 | DEC-009 clarification: Replace PAR-008 ordering dependency with MON-008, RTL-002 and AI-013 so phase 6 can precede deferred phase 5; acceptance criteria unchanged.
