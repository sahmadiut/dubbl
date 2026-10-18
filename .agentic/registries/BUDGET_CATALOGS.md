# Budget catalogs (LOC-037)

## Ownership

`Budgets` owns budget list, detail layout/overview/settings and `BudgetDrawer`:
titles, empty/search/filter states, sample department names, status and period
type labels, totals and variance sentences, chart labels, period breakdowns,
creation/settings fields, amount accessibility labels, validation, confirmations,
success and failure messages. Added 145 paired English/Persian messages.

`i18n/budget-presentation.ts` localizes canonical generated period labels only
for display. Saved labels remain the grouping and wire keys. Unknown period
types and arbitrary custom labels pass through. Chart tooltips select exact
saved amounts using stable data keys, independently of translated legend names.

## Explicit exceptions and contracts

- Caller-entered names, account names/codes, IDs and arbitrary custom period
  labels are data. React escapes these; they are not catalog keys.
- Routes, query parameters, methods, organization headers, event names, enum
  values, CSS/SVG attributes and chart data keys remain machine values.
- Canonical Gregorian dates, numeric years, exact minor-unit strings, currency
  codes/symbols, decimal input syntax and `0.00` remain unchanged. Existing
  formatting and percentage geometry remain; date/numeral/RTL qualification is
  separate. Month/year templates contain placeholders only in both catalogs;
  their month argument comes from the translated Gregorian month catalog.
- Separators, arithmetic signs, percentage marks and missing-value dashes are
  presentation punctuation. The chart's compact thousands suffix is cataloged.
- Internal developer exceptions and invisible currency-load diagnostics are
  technical text. Unknown network, parser, adapter and server errors use an
  operation-specific localized fallback. Known input/range, authentication and
  authorization failures use reviewed catalog messages.
- Reads retain the existing `budgetJson` exact-money validator. Save/create use
  the unchanged `budgetLinesInput` adapter and canonical period labels. Amount
  redistribution, signed values, safe ranges and fixed-two units are unchanged.
- Deletion/toggle failures show localized errors, retain confirmation for retry,
  and emit no success/event/navigation. Missing organization no longer leaves
  creation stuck in saving state. These are bounded error-presentation repairs.

Existing REST CRUD/report handlers and registered `list_budgets`, `get_budget`,
`create_budget`, `update_budget`, `delete_budget` and `budget_vs_actual` MCP tools
cover the unchanged operations. No API, MCP, service, schema or migration changes
were needed. Stripe remains unchanged under DEC-008. Sibling drawers and existing
catalog namespaces were compared against HEAD and are unchanged.

## Verification and handoff

Production components render through real `PresentationProvider`/next-intl in
both locales with controlled hooks and inline portals/chart shells. Tests execute
production callbacks and check exact payloads, localized errors, draft validation,
confirmation cancellation, successful/failed writes, escaped data and tooltips.
The source audit rejects authored JSX copy and untracked display attributes.
Existing budget REST/MCP/SQL integration tests run against disposable databases.

See [evidence](../evidence/LOC-037-attempt-1.md) and
[self-review](../evidence/LOC-037-review-1.md). Persian financial wording remains
provisional pending native review. Mounted browser, RTL and independent
LOC-024/LOC-007/LOC-002 integration acceptance remain open. Report/dashboard and
budget-alert copy are outside this route/drawer slice.
