---
{
  "id": "DATA-006",
  "title": "Implement an approved optional banking connector",
  "phase": 6,
  "role": "backend",
  "depends_on": [
    "DATA-005"
  ],
  "source_pages": [],
  "status": "todo",
  "priority": 1,
  "optional": true,
  "human_review": true,
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

# DATA-006 — Implement an approved optional banking connector

## Objective and implementation scope

Implement only the owner-selected and currently permissible connector after a current availability review. Never assume a local bank or CBI API exists.

## Inputs

- Requirements: [Markdown implementation plan](../sources/SOURCE.md), sections [`bigcapital-to-dubbl-feature-map`](../sources/SOURCE.md#bigcapital-to-dubbl-feature-map), [`security-and-privacy`](../sources/SOURCE.md#security-and-privacy), [`performance`](../sources/SOURCE.md#performance). See [coverage map](../sources/PLAN_COVERAGE.md).
- Actual fork source and tests, docs/REPOSITORY_MAP.md, and relevant registries.
- Dependency task evidence; plan assertions alone do not prove implementation.

## Acceptance criteria

- [ ] Current provider/jurisdiction review is documented by the responsible owner.
- [ ] Secrets stay server-side and imported events are idempotent.
- [ ] Sandbox contract, failure and revocation tests pass.

## Verification

Run the repository's discovered commands for the affected behavior. Add meaningful regression/negative tests for financial, migration, authorization or compatibility changes. For an audit/documentation task, verify source links and reproduce claimed commands. Record exact command, exit result, fixture/context, observed outcome and limitations in a task-specific evidence Markdown file. Never report an unrun check as passed.

## Handoff

Not started. First inspect the actual fork; replace this with changed files, completed steps, remaining work, blockers and the exact next action before ending a session.

## History

- Initial backlog generated from the supplied plan. Implementation status is unverified; no task is marked complete.
