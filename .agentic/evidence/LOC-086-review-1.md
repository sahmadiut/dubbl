# LOC-086 review 1

Reviewer: Codex. Kind: self. Date: 2026-10-21 (Asia/Tehran).
Scope: LOC-086 only; not independent peer/human/native linguistic review.

Reviewed the page/reader/catalog diff, behavior assertions and migrated worker,
plus task handoff and [scope/exception registry](../registries/PAYROLL_TIME_LEAVE_CATALOGS.md).
The 75 keys are paired, Persian leaves contain Persian script and real
next-intl rendering preserves escaped caller data and machine values.

Checked HTTP errors cannot bypass feedback or adopt malformed state; no raw
server error is displayed. Initial effects ignore obsolete results; missing
org/storage releases initial loading. Creation retains failed forms and clears
only after checked success. Approval/rejection require matching ID and status;
rejection keeps confirmation and its unchanged payload. Refresh failure after a
successful mutation shows a separate translated read failure. Existing request
headers/paths/payloads, filters/sort/search, statistics, canonical dates, physical
hours and exact monetary aliases remain unchanged.

Verified all eight saved statuses, including cancelled leave in the all view.
This page has no shift/policy editor; adjacent detail/self-service and combined
payroll ownership remain explicit. No REST/MCP operation, schema or financial
calculation changed. Existing migrated real REST/linked MCP/SQL checks pass
with the new reader. Full static and unit outcomes are recorded in
[attempt evidence](LOC-086-attempt-1.md).

No unresolved finding within this extraction scope. Approve: recorded
verification gates passed. Native Persian, full RTL/calendar/numerals, independent
LOC-067/008/002 acceptance, browser/keyboard, hosted CI and production release
remain unclaimed. Stripe remains unchanged under DEC-008.
