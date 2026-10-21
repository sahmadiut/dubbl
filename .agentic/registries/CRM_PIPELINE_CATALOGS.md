# CRM pipeline list and creation catalogs

LOC-099 owns 89 paired `CrmPipeline` messages (8,640 compatible leaves per
locale) for `crm/page.tsx` and `DealDrawer` in `create-drawer.tsx`.
`crm/loading.tsx` already delegates to the shared catalogued loader. Persian
wording is provisional pending native terminology review and RTL qualification.

## Coverage and exceptions

- Document/header titles, onboarding copy and fictitious sample names,
  capability descriptions, filter/source/status/sort labels, counts and
  interpolated summaries, empty states, feedback and reverse-sort accessible name.
- Drawer sections, fields, placeholders, source options, date prompt, creation
  feedback and unsaved-change confirmation. The footer reuses `DocumentForms`
  cancel/creating messages. Persisted pipeline/stage/contact/assignee names,
  titles, notes and unknown stage identifiers remain escaped caller data.
- Saved default setup values `Sales Pipeline`, `Lead`, `Qualified`, `Proposal`,
  `Negotiation`, `Won` and `Lost` remain unchanged in the POST body. The default
  onboarding stage labels translate separately. No stored names are rewritten.
- IDs, paths, event `deals-changed`, org/content-type headers, input names,
  pipeline/stage/source/status/sort values and filters remain machine contracts.
  Finite displayed source and lifecycle labels translate without changing values.
- Currency codes/symbols, sample monetary/percentage literals, placeholders
  `0.00`/`50`, `%`, separators, probability geometry and stage colors are explicit
  exceptions. Existing fixed-two cents display and USD creation default remain;
  JPY/KWD labels do not rescale values. Canonical Gregorian dates are unchanged.
  Existing browser date formatting, complete numeral/calendar and RTL work remain
  independent. This task introduces no compliance or production IRR claim.

## Data and behavior

`i18n/crm-presentation.ts` delegates saved exact pairs to `projectCrmJson` and
checks pipeline/stage/deal identities, envelopes, rendered joins, finite
probabilities/sources, dates, lifecycle timestamps, counts and monetary fields
before adoption or mutation success. List summary totals intentionally cover
the full pipeline/currency dataset while pagination totals honor filters.
REST keeps `data`/`pagination`; MCP keeps `deals`/flat `total`.

Network/HTTP/JSON/storage/validation failures use finite translated feedback.
Missing organization releases saving/loading. Failed pipeline reads cannot
masquerade as onboarding; cleaned-up pipeline reads and superseded deal reads
cannot adopt stale data. Pagination failures retain current rows, stop automatic
retries, roll back the attempted page and offer explicit retry from page one;
they do not claim the list is exhausted. Only checked creates close the drawer,
emit `deals-changed`, reset fields and navigate. Failed creates preserve fields.

Existing organization-scoped `list_pipelines`, `create_pipeline`, `list_deals`
and `create_deal` tools already share the REST CRM service. No service/tool/API,
authorization, schema/migration, ledger, currency or Stripe implementation changes.

## Verification and handoff

Focused tests render production JSX with real next-intl and
`PresentationProvider`, controlling hooks/IO and portal boundaries. They cover
both locales, escaping, exact maximum cents, canonical date/request/filter
contracts, callbacks, failures, cleanup, stale reads and pagination. The CRM
integration worker validates actual REST and registered MCP payloads through
these readers, preserving its independent SQL, scope/authorization, audit,
history and rollback assertions. The existing budget/project/CRM UI fixture
also passes. These checks do not establish browser or native linguistic approval.

See [attempt](../evidence/LOC-099-attempt-1.md) and
[Codex self-review](../evidence/LOC-099-review-1.md).
LOC-100..102 own detail/navigation/settings, activity and analytics.
LOC-069/008/002 retain independent combined acceptance; native/RTL, output,
hosted CI, deployment and release qualification remain separate.
