# Accrual catalogs (LOC-038)

## Ownership

`Accruals` owns the accrual list/detail routes and `AccrualScheduleDrawer`:
document title, empty-state explanations/examples, filters, table/stat labels,
status and month labels, whole count/progress/amount sentences, creation fields,
required-input/range validation, confirmation, loading, success and error copy.
Added 94 paired English/Persian messages. Existing shared fields, date/account
pickers, confirmation and table primitives retain their own catalog ownership.

`i18n/accrual-presentation.ts` translates display status labels and localizes
known input/status/code failures; arbitrary server, parser and network prose
uses an operation-specific fallback. Successful list/detail/create/post/cancel
responses are shape-checked before state adoption or success UI. Existing
`projectCrmJson` validates exact numeric/Minor aliases. Reads now handle failures;
failed cancellation keeps its confirmation available for retry. Missing org
does not leave a spinner or create saving active.

## Explicit exceptions and preserved contracts

- Descriptions, account names/codes and unknown status values are caller data;
  React escapes these and they never become catalog keys.
- IDs, routes, query names/values, methods, organization headers, monthly/status
  enums, idempotency keys, CSS/SVG values and field selectors are machine values.
- Saved Gregorian date-only strings, numeric counts, fixed-two decimal input
  syntax, `0.00`, currency symbols and exact monetary strings remain unchanged.
  Example money uses the existing fixed-two formatter with identical English
  values; its monthly suffix is cataloged. Date/numeral/RTL conversion is separate.
- Money remains integer cents in saved numeric/Minor aliases, with decimal-major
  `totalAmountExact` on REST create. No rescaling or float aggregate was added.
  Existing bigint list sums and exact input/period adapters remain unchanged.
- Posting sends the same next `entryId`; creation retains the same retry key,
  dates, account IDs and period count. No translated labels enter payloads.
- Internal response-shape exceptions are developer diagnostics and never shown
  directly. Static English samples now use cataloged explanatory copy.

Existing organization-scoped `list_accrual_schedules`, `get_accrual_schedule`,
`create_accrual_schedule`, `post_accrual_entry` and `cancel_accrual_schedule`
MCP tools cover every unchanged operation via shared services. No REST/MCP,
service, DB schema or migration change is needed. Revenue schedules, recurring
journals and other drawers are outside this slice. Stripe remains unchanged.

## Verification and handoff

Production JSX renders through `PresentationProvider`/next-intl in both locales;
tests control hooks and inline portals without starting a server. Production
callback tests cover success/failure, exact payloads, cancellation before confirm,
malformed JSON/shapes/aliases, safe error fallbacks, paging and escaped caller
data. Source/catalog audits check authored JSX copy, Persian script and ownership.
Existing accrual REST/MCP/SQL tests use a disposable loopback PostgreSQL cluster.

See [attempt evidence](../evidence/LOC-038-attempt-1.md) and
[self-review](../evidence/LOC-038-review-1.md). Persian wording is provisional;
native terminology review, mounted browser/RTL qualification and independent
LOC-024/007/002 integration acceptance remain open.
