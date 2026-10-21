# CRM deal activity catalogs

LOC-101 owns 42 paired `CrmActivity` messages (8,757 compatible leaves per
locale) for `crm/deals/[id]/activity/page.tsx`. Activity names and relative time
reuse `CrmDetail` through the presentation hook. Persian wording is provisional
pending native terminology review and full RTL qualification.

## Coverage and exceptions

- Composer title, five type-specific placeholders, keyboard hint, submitting
  state, search/filter/sort controls, count sentences, empty states, timeline
  attribution, Today/Yesterday, lifecycle banners, sidebar statistics and read
  failure feedback are catalogued. Singular type labels and plural sidebar
  labels are distinct; sentences use ICU/rich interpolation with approved tags.
- Caller content, member names and loss reasons remain escaped data. IDs,
  routes, headers, query keys, activity types, sort values and request payloads
  retain their machine contracts. Cmd/Ctrl/Enter keyboard names, punctuation,
  color/percentage geometry and currency labels/symbols are explicit exceptions.
- Lifecycle money keeps the existing fixed-two cents display and safe maximum
  value. No currency rescaling or arithmetic changes are introduced.
- Date/time display uses the independent locale, calendar, numeral and timezone
  preferences. Day groups use Gregorian keys in the presentation timezone;
  yesterday is the previous calendar day, independent of daylight saving.
  First/most-recent statistics derive chronological extremes of loaded rows,
  independent of sort order; these are not a full-history aggregation.
- The legacy English `timeAgo` export retained by LOC-100 is now removed after
  migrating its final consumer. The overview continues using the same shared
  translated relative-time helper. LOC-100 evidence remains historical.
- Shared UI primitives own their existing catalogs. Full RTL layout/numeral
  qualification and native terminology acceptance remain independent.

## Behavior and contracts

`crmActivitiesJson` checks HTTP/JSON, every joined row, finite types/timestamps,
unique IDs, requested page/limit, expected row count, total pages, all five type
counts and their sum before any feed state is adopted. Page replacement and
append share the reader. Failed reads preserve verified rows and report finite
translated feedback. Request generations ignore superseded or unmounted reads;
an in-flight guard prevents duplicate pagination requests. Appends deduplicate
IDs across pages to tolerate live insertion shifting offset boundaries.

The shared creation callback returns a boolean after checking the existing
unjoined creation reply. Failed creation retains the draft and does not refresh;
verified creation clears the draft and refreshes the feed only while current.
Refresh failure is separate from creation success. Busy keyboard submission is
guarded. Existing `add_deal_activity`/`list_deal_activities` MCP tools already
share the organization-scoped CRM service; no REST/MCP service or wire contracts
change. No schema/migration, authorization, ledger, currency flag or Stripe
implementation changes are part of this slice.

## Verification and handoff

Tests render production JSX with real next-intl, `PresentationProvider`, money
and UI code while controlling hooks/IO/context. They cover bilingual text,
escaping, maximum safe cents, selected type/sort values, query/header contracts,
negative reads, pagination/cleanup races, creation/refresh separation and
Persian-script/source-copy checks. Disposable PostgreSQL integration validates
real REST and linked MCP activity envelopes with the reader while retaining
SQL-text, scope, auth, lifecycle and rollback assertions.

See [task evidence](../evidence/LOC-101-attempt-1.md). LOC-102 and independent
LOC-069/008/002 combined acceptance remain open. Browser/native linguistic/full
RTL, hosted CI, deployment and production acceptance are separate.
