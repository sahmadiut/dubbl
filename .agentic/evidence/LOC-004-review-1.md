# LOC-004 self-review 1

2026-10-20 (Asia/Tehran), coding-assistant/Codex. Honest self-review by the same
implementer, not independent peer, native linguist or human approval.

Reviewed source diff, [attempt evidence](LOC-004-attempt-1.md),
[calendar contract](../registries/CALENDAR_PRESENTATION.md), all six new unit
cases, extended real locale/business REST/MCP fixture, actual local test/check
results and inventory changes against entry HEAD.

## Findings and resolution

- Calendar arithmetic stays in the installed compatible Persian DayPicker;
  Gregorian/ISO serialization uses UTC carrier coordinates, not Jalali formatting
  or host-local getters. Intl and DayPicker agree on known leap/New Year cases.
  Actual selected-day handlers round-trip across tested host/user timezones.
- Language/calendar/numerals remain independent in both pickers. Locale merging
  retains caller overrides and calendar-specific default labels. Native month
  formatters replace the prior host-locale Gregorian month override; Persian
  dropdowns therefore show Jalali months. Existing custom day-button handlers,
  focus effect, class overrides and DayPicker keyboard implementation are retained.
- Strict date-only input rejects invalid Gregorian rollover, localized strings
  and timestamps; invalid controlled values use the existing placeholder. Tests
  verify canonical callback output and unchanged empty-selection behavior.
- Separate timezone/calendar preferences and authenticated direct-DB REST/MCP
  service already existed. Reusing them avoids duplicate state or operations.
  The migrated fixture proves preference changes do not rewrite dates/timestamps
  and both business transports store canonical dates with exact unchanged money.
- Notification formatter reuse retains prior options and grouping behavior;
  existing notification/DST tests pass in the complete 1,128-test suite.
- Inventory diff has no schema-column classification changes. An already
  committed integration test omitted by the previous inventory regeneration is
  included for reproducibility without editing its source. No other unrelated
  source changes or Stripe work.

No unresolved implementation defect found within LOC-004 acceptance. Approve
for this task's self-review gate after controller checks. This does not grant
native language, mounted-browser accessibility, full RTL, fiscal/statutory
accounting-calendar, hosted CI, deployment or release approval. Limitations are
explicit in the attempt evidence and registry.
