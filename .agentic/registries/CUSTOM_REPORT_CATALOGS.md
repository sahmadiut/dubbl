# Saved/custom report catalogs - LOC-112

Owns saved/page.tsx and custom/page.tsx under app/(dashboard)/reports.
CustomReports contains 50 paired English/Persian messages for headings, source
labels, controls, empty states, confirmations, notices, errors and ICU counts.

Exceptions: caller report names/descriptions and result values remain caller data;
column identifiers (including Minor), source identifiers unknown to the display
map, currencies, routes, saved configurations, CSV contents and download endpoints
remain machine contracts. Dates retain the existing runtime date formatter;
calendar/numeral/RTL qualification belongs to later tasks. Shared dialog, table,
loader and confirmation chrome retain their existing catalog ownership.

Run failures use a reviewed localized fallback rather than arbitrary diagnostic
prose. Existing save/delete networking behavior is otherwise preserved.
No REST/MCP/schema or Stripe changes. Existing custom report tools remain intact.
Persian wording is provisional pending native review. LOC-070/008/002 acceptance
and browser, full RTL, calendar, production and hosted CI qualification remain open.
