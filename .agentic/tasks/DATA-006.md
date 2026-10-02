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
  "status": "skipped",
  "priority": 1,
  "optional": true,
  "human_review": true,
  "owner": null,
  "block_reason": null,
  "evidence": [
    "evidence/AUD-005-owner-review-1.md"
  ],
  "review": null,
  "waiver": {
    "reason": "DEC-006: connector deferred with its provider boundary; no provider selected",
    "reviewer": "project-owner",
    "evidence": "evidence/AUD-005-owner-review-1.md",
    "at": "2026-10-02T02:31:07+00:00"
  },
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

Connector deferred together with DATA-005 under accepted DEC-006; no provider or jurisdiction eligibility is assumed. Actual owner approval: evidence/AUD-005-owner-review-1.md. No implementation or acceptance test is claimed. Future inclusion requires explicit new owner scope and controller reopening before work.

## History

- Initial backlog generated from the supplied plan. Implementation status is unverified; no task is marked complete.
- 2026-10-02T02:31:07+00:00 | Optional scope deferred by project-owner: DEC-006: connector deferred with its provider boundary; no provider selected
