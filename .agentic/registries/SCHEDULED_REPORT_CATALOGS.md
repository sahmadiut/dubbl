# Scheduled report catalogs - LOC-113

Owns app/(dashboard)/reports/schedules/page.tsx. ScheduledReports contains 52
paired English/Persian messages for headings, help, empty states, table and form
labels, frequency/format/weekdays, ICU timing/day labels, status and errors.

Exceptions: saved report names, recipient addresses and example email placeholder
remain caller data or literal email syntax. IDs, routes, organization headers,
frequency/format enums, 0-6 weekdays, 1-28 month days, HH:MM values and persisted
timestamps remain machine contracts. Unknown frequency/format display values
retain the existing literal fallback. The missing-value em dash is punctuation.
Next-send dates retain the runtime date formatter; calendar, numeral and timezone
presentation qualification remains separate. Schedule day numbers deliberately
remain strings in ICU interpolation, preserving canonical Gregorian semantics.
Shared loader/dialog/back-link chrome retains existing catalog ownership.

Creation errors use a localized reviewed fallback for HTTP and network failures;
the form remains open and submitting clears. List requests now use the supported
100-item API limit (previously 200, rejected by schedulePaginationSchema).
This page continues to show only the first page; complete pagination is not added.
Existing list-fetch failure handling is outside this extraction's changes.

No REST/MCP/schema/export or money calculation changes. The existing schedule MCP
tools continue to use the shared schedule service. Stripe is unchanged. Persian
wording is provisional pending native review. LOC-070/008/002 combined acceptance,
full RTL/calendar/numeral/browser/output and production qualification remain open.
