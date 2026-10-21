# Owner ordering update: IRR after localization

Date: 2026-10-21 (Asia/Tehran). Author: Codex. Scheduling only.

The owner instructed, translated from Persian: "Put the IRR tasks after
localization."

Moved IRR-001..003 from phase 2 to phase 8 (release qualification). Added
RTL-002 and L10N-012 as prerequisites of IRR-001 so catalog/input/RTL work and
final Persian translation acceptance finish first. Preserved the existing
MON dependencies and IRR-001 -> IRR-002 -> IRR-003 -> IRR-004 -> IRR-005 chain.
IRR-004..005 stay in phase 9 with their existing QA/release prerequisites.
All five IRR tasks remain todo, with no acceptance or review changes.

Updated START_HERE, task index, source coverage, readiness map and rollout ADR
to match task metadata. The earlier creation evidence remains historical;
its former phase-2 priority is superseded by this owner instruction.

Verification:

- Controller validation passed for all 346 tasks, including cycle checks.
- Explicit dependency traversal confirms all five IRR tasks transitively wait
  for both RTL-002 and L10N-012.
- Controller status now reports Locale foundation; next is LOC-104,
  "Extract income and executive report catalogs." IRR-001 is not ready.
- Owned Markdown local links resolve and git diff --check passes.

This ordering change does not alter runtime configuration, the owner's local
IRR testing override, application code or database data. No task was completed,
application tests/build/server startup run, or commit/push performed for this
scheduling-only instruction.
