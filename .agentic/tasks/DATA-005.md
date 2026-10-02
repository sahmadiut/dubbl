---
{
  "id": "DATA-005",
  "title": "Define optional bank-feed provider boundary",
  "phase": 6,
  "role": "backend",
  "depends_on": [
    "DATA-004"
  ],
  "source_pages": [],
  "status": "skipped",
  "priority": 1,
  "optional": true,
  "human_review": false,
  "owner": null,
  "block_reason": null,
  "evidence": [
    "evidence/AUD-005-owner-review-1.md"
  ],
  "review": null,
  "waiver": {
    "reason": "DEC-006: provider boundary deferred; manual/CSV banking retained",
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

# DATA-005 — Define optional bank-feed provider boundary

## Objective and implementation scope

Define a generic BankFeedProvider adapter only if confirmed valuable; keep domain independent from Plaid. Document credential, consent, retry and provenance interfaces.

## Inputs

- Requirements: [Markdown implementation plan](../sources/SOURCE.md), sections [`bigcapital-to-dubbl-feature-map`](../sources/SOURCE.md#bigcapital-to-dubbl-feature-map), [`security-and-privacy`](../sources/SOURCE.md#security-and-privacy), [`performance`](../sources/SOURCE.md#performance). See [coverage map](../sources/PLAN_COVERAGE.md).
- Actual fork source and tests, docs/REPOSITORY_MAP.md, and relevant registries.
- Dependency task evidence; plan assertions alone do not prove implementation.

## Acceptance criteria

- [ ] Manual/CSV operation remains the baseline without a provider.
- [ ] Provider errors and duplicate feed events have contract fixtures.
- [ ] No Iranian-bank support is implied by a global provider.

## Verification

Run the repository's discovered commands for the affected behavior. Add meaningful regression/negative tests for financial, migration, authorization or compatibility changes. For an audit/documentation task, verify source links and reproduce claimed commands. Record exact command, exit result, fixture/context, observed outcome and limitations in a task-specific evidence Markdown file. Never report an unrun check as passed.

## Handoff

Bank-feed provider boundary deferred under accepted DEC-006 until a provider and demonstrated need are selected; manual/CSV banking remains in scope. Actual owner approval: evidence/AUD-005-owner-review-1.md. No implementation or acceptance test is claimed. Future inclusion requires explicit new owner scope and controller reopening before work.

## History

- Initial backlog generated from the supplied plan. Implementation status is unverified; no task is marked complete.
- 2026-10-02T02:31:07+00:00 | Optional scope deferred by project-owner: DEC-006: provider boundary deferred; manual/CSV banking retained
