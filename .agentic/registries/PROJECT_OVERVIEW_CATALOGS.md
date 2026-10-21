# Project overview and navigation catalogs

LOC-094 owns 89 paired `ProjectOverview` messages (8,242 total compatible keys
per locale) across project detail `page.tsx`, `layout.tsx` and their presentation
helpers. Persian wording is provisional pending native terminology review.

## Coverage and exceptions

- Overview title, statistics, financial/details/summary/progress cards, activity
  lists, empty states, duration/deadline/count messages and view/manage actions.
- Shared header, navigation, active-page accessibility, status/priority/billing
  labels, member roles, missing-project/read errors and invoice action feedback.
- Both charts: titles, duration units, series/tooltip names, finite task labels,
  legends and empty states. Chart data keys, values, colors and CSS stay machine
  values. Physical-hour chart rounding retains its existing semantics.
- The mini calendar delegates month/week/day names, accessible navigation and
  independent calendar/numeral preferences to the existing shared Calendar.
  Today, project start/end rings, task/milestone/time dots and overdue coloring
  remain. Event lookup and `data-date` use canonical Gregorian YYYY-MM-DD keys
  even when the displayed calendar is Persian. Event-count titles translate.
- Project/task/milestone/contact/member names, email, categories, descriptions,
  tags, notes, avatar initials and colors remain escaped caller data.
- URLs, IDs, org/content-type headers, JSON fields, enum/role/billing values,
  flags, chart keys and dates remain contracts. Currency codes/symbols, fixed-two
  cents display, `%`, `/`, `+`, numeric counters and absent-value `-` are explicit
  exceptions. Money remains exact bigint for derived totals; no stored units,
  canonical Minor aliases, percentage arithmetic or currency labels change.
- Existing English `formatHours`, `formatDate`, `formatDateShort` and config
  label exports in project-context remain compatibility fallbacks for the
  unconverted LOC-095..098 sibling screens. This slice uses the catalogued
  `useProjectPresentation` hook. Those sibling screens remain separately owned;
  their old helper consumers must migrate during their catalog tasks.
- Developer-only context misuse errors remain English diagnostics, not product
  feedback. Other machine/data/empty-symbol strings are not catalog entries.

## Data, failure and transport behavior

The shared reader reuses the existing projectCrmJson exact-pair checks and
validates detail identity, arrays, quantities, flags, dates and rendered joins
before atomic adoption. The provider settles loading without an organization
or when browser storage is unavailable, ignores cleaned-up requests and hides
a previous route's project. HTTP/JSON/network/shape diagnostics map to finite
translated read feedback. Refresh remains a callback available to siblings.

Invoice generation retains POST `/api/v1/projects/{id}/invoice`, `{}` and the
organization header. A checked acknowledgement is required for translated
success and navigation to `/sales/{invoice.id}`. Failed/malformed responses
never navigate or surface private server/parser diagnostics.

Existing org-scoped `get_project` and `generate_project_invoice` MCP tools
already correspond to these operations. REST/MCP/service/schema, authorization,
ledger, IRR flags and Stripe implementations are unchanged. The migrated master
and billing fixtures now check successful real REST and linked MCP responses
through these readers while retaining independent SQL/scope/rollback checks.

## Verification and handoff

Production JSX tests use real next-intl, PresentationProvider and shared calendar
with controlled hook/router/chart/IO boundaries. They verify both locales,
escaping, exact totals beyond Number.MAX_SAFE_INTEGER, feature navigation,
translated enums, plotted values, canonical calendar markers, month/Today
callbacks, failed invoice/read handling, storage and request cleanup.

See [attempt](../evidence/LOC-094-attempt-1.md) and
[Codex self-review](../evidence/LOC-094-review-1.md). LOC-068/008/002 retain
independent combined acceptance. LOC-095..098, native terminology, full RTL,
browser interaction and output/release qualification remain open. No full
build, dev startup, hosted CI, deployment or production qualification is claimed.
