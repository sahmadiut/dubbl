# Project task, time and milestone catalogs

LOC-095, LOC-096 and LOC-097 are implemented together at the owner's explicit
request. Their acceptance and evidence remain separate. LOC-068/008/002 retain
independent combined acceptance; LOC-098 remains separately owned. Persian
wording remains provisional pending native terminology and full RTL review.

## Ownership and extraction

| Task | Production scope | Catalog namespace |
|---|---|---|
| LOC-095 | Project task list/board, creation/detail drawers, checklist, comments, label presentation | ProjectTasks |
| LOC-096 | Project time list, filters, chart, timer controls, entry creation/editing and billing summaries | ProjectTime |
| LOC-097 | Project milestones, creation, assignment/payment dialogs, progress invoice preview/generation | ProjectMilestones |

The namespaces contain 63, 79 and 73 paired messages respectively, for 215
new messages and 8,457 compatible leaves per locale. Existing namespaces are
unchanged.

The slices use real next-intl messages and the existing presentation provider.
Shared project status, priority, date and duration presentation reuses the
catalogued project helpers where appropriate.

## Explicit exceptions and preserved contracts

- Project/task/milestone titles, descriptions, label names/colors, checklist
  content, comments, member names, email and invoice numbers remain caller data
  and are escaped by React.
- IDs, URLs, routes, organization/content-type headers, HTTP methods, payload
  fields, enum values, select/filter sentinels, data/chart keys and CSS colors
  remain machine contracts.
- Canonical date values remain Gregorian YYYY-MM-DD; timer timestamps remain
  instants. Display preferences do not rewrite saved dates or quantities.
- Minutes, elapsed seconds, physical hours, percentages, numeric placeholders,
  chart values and absent-value symbols keep their existing meanings.
- Money keeps exact saved minor-unit aliases and the existing project cents
  display contract, including fixed-two display and currency labels. Derived
  monetary sums use the existing exact helpers. No denomination rescaling,
  currency metadata or IRR production flag change is implied.
- Developer-only exceptions remain diagnostics. Product feedback uses finite
  translated messages and does not expose private server/parser/network prose.
- Shared UI primitive copy belongs to the existing shared catalog slices.
  Project notes, membership and remaining sibling routes belong to LOC-098.

## Transport and MCP coverage

Existing org-scoped project task, checklist, comment, time-entry, timer,
milestone, assignment and progress-invoice REST operations already have
corresponding registered MCP operations. This batch changes presentation and
its checked response handling; it does not change REST/MCP operation schemas,
authorization, database schema/migrations, posting, ledger or Stripe behavior.

Task/checklist/comment mutations require their existing acknowledgement before
clearing input, closing drawers or refreshing. Time mutations and timer
start/pause/resume/reset/save check returned identity, quantities, dates and
exact aliases. Timer autosave updates its saved-field references only after a
checked response; failed reset/save keeps the timer. Ticking is cleaned up by
the existing effect after a successful timer state transition, so a failed
request does not freeze the displayed timer.

Milestone assignment presentation now reads the persisted `isPaid` property
instead of the nonexistent `paid` property. Mark-paid remains metadata only;
it does not move money or post payroll/ledger entries. Assignment and billing
effects ignore cleaned-up replies, validate data before adoption, settle
loading and report finite translated errors. Fixed/hourly/milestone invoice
preview arithmetic remains exact; successful generation requires the existing
invoice envelope and exact pairs.

The existing timer save flow is two independent REST operations: create a time
entry and discard a running timer. This catalog batch does not make them an
atomic operation or provide durable idempotency. If entry creation commits but
discard fails (or a committed response is lost), a manual retry can duplicate
time. This pre-existing limitation requires a separate backend workflow task;
the batch does not claim atomic timer-save recovery. Autosave failures retain
unsaved references but keep the existing silent feedback policy.

## Qualification handoff

Each task has a separate attempt and review under `../evidence/`. Focused
production JSX tests cover real English/Persian rendering and meaningful
callbacks with controlled IO. Shared typecheck, catalog, lint, exact-money,
controller and diff gates are recorded in the evidence with actual results.
Native terminology, full RTL/browser/output qualification, parent acceptance,
hosted CI, deployment and production qualification remain independent. No full
build or dev server startup is required or claimed.
