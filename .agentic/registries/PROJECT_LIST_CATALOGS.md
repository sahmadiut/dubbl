# Project list, creation and settings catalogs

LOC-093 owns 100 paired `Projects` messages across the project list,
`ProjectDrawer` in `create-drawer.tsx`, and project settings. `loading.tsx`
delegates to the existing catalogued shared loader. Persian wording is
provisional pending native terminology review and RTL qualification.

## Coverage and exceptions

- List titles, empty/error/loading/filter presentation, table headers, finite
  lifecycle/priority labels, statistics, budget percentage and duration units.
- Creation and settings fields, placeholders, option labels, date prompts,
  financial/timeline/feature sections, success/failure feedback, busy actions,
  deletion confirmation and color-radio accessible names. The drawer footer
  reuses existing `DocumentForms` cancel/creating messages.
- Project/contact/member names, email, descriptions, categories, tags, avatar
  initials and colors are caller data, escaped by React and never translated.
- IDs, routes, org/content-type headers, request field names, `projects-changed`,
  form names, status/priority/billing values and feature flags remain machine
  contracts. Dropdown labels translate while values remain unchanged.
- Currency codes and symbols, numeric placeholder `0`, progress `%`, avatar
  overflow `+`, separators and absent-value `-` remain intentional exceptions.
  Saved money retains the existing fixed-two cents contract even for JPY/KWD;
  no stored units change. Bigint aggregates and mixed-currency suppression stay
  intact. `estimatedHours`/`totalHours` retain whole-minute wire semantics;
  canonical Gregorian date strings are untouched. Broad numeral/date adapter
  and RTL qualification remains separate.

## Data, failures and verification

`i18n/project-presentation.ts` delegates exact-money validation to the existing
`projectCrmJson`, checks the list envelope, row identity, finite enums, quantities
and rendered joins, and checks create/update/delete acknowledgement envelopes.
HTTP/JSON/network/storage diagnostics never appear as product messages.
Missing org context releases loading/saving with finite translated feedback;
cancelled list requests cannot overwrite newer state. Delete failures preserve
the current screen and never dispatch success events or navigate away.

Existing org-scoped `list_projects`, `create_project`, `update_project` and
`delete_project` MCP tools share the REST master service; no API/tool/schema,
authorization, ledger, currency, IRR flag or Stripe changes are needed here.
The migrated project-master fixture now checks real REST and linked MCP
responses through the presentation readers, alongside its independent SQL,
tenancy, permissions, invalid input, audit, history and atomic rollback checks.

The focused suite renders production JSX with real next-intl and
`PresentationProvider`, production table/footer/money inputs, and controlled
hook/IO/portal boundaries. It checks both locales, escaping, exact large sums,
currency separation, enum/form/date contracts, requests, confirmation and all
success/failure callbacks. It is not a browser interaction qualification.

See [attempt](../evidence/LOC-093-attempt-1.md) and
[Codex self-review](../evidence/LOC-093-review-1.md). LOC-094..098 own the
remaining project surfaces; LOC-068/008/002 retain independent combined
acceptance. No native review, full RTL/browser, hosted CI, deployment or
production qualification is claimed.
