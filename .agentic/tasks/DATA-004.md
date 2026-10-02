---
{
  "id": "DATA-004",
  "title": "Close bank rules states and matching gaps",
  "phase": 6,
  "role": "backend",
  "depends_on": [
    "DATA-001"
  ],
  "source_pages": [
    6,
    15,
    18
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

# DATA-004 — Close bank rules states and matching gaps

## Objective and implementation scope

Compare rule operators, categorization, pending/recognized states, matching heuristics and period-lock behavior. Reuse current domain and normalize only useful differences.

## Inputs

- Supplied implementation plan, pages 6, 15, 18; see sources/PLAN_COVERAGE.md.
- Actual fork source and tests, docs/REPOSITORY_MAP.md, and relevant registries.
- Dependency task evidence; plan assertions alone do not prove implementation.

## Acceptance criteria

- [ ] CSV/manual reconciliation remains functional in both languages.
- [ ] Ambiguous matches require explicit resolution without double posting.
- [ ] Locked-period and tenant-isolation fixtures pass.

## Verification

Run the repository's discovered commands for the affected behavior. Add meaningful regression/negative tests for financial, migration, authorization or compatibility changes. For an audit/documentation task, verify source links and reproduce claimed commands. Record exact command, exit result, fixture/context, observed outcome and limitations in a task-specific evidence Markdown file. Never report an unrun check as passed.

## Handoff

Not started. First inspect the actual fork; replace this with changed files, completed steps, remaining work, blockers and the exact next action before ending a session.

## History

- Initial backlog generated from the supplied plan. Implementation status is unverified; no task is marked complete.
