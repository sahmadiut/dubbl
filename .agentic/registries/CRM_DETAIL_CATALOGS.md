# CRM deal overview, navigation and settings catalogs

LOC-100 owns 75 paired `CrmDetail` messages (8,715 compatible leaves per
locale) for `crm/deals/[id]/layout.tsx`, `page.tsx` and `settings/page.tsx`.
Source display labels reuse `CrmPipeline`. Persian wording is provisional
pending native terminology review and full RTL qualification.

## Coverage and exceptions

- Navigation, lifecycle badges/actions/confirmation, read/save/delete/activity
  feedback, unavailable state, overview labels/metrics/activity preview, relative
  time, date sentences, settings sections/fields/placeholders and danger zone.
- Stored pipeline/stage/contact/assignee names, deal titles, notes, lost reasons,
  activity content and email addresses remain escaped caller data. Persisted
  stage names are not translated or rewritten.
- IDs, tab/route values, form names, org/content-type headers, HTTP methods,
  canonical Gregorian dates, source/activity values and request bodies retain
  their machine contracts. Missing org or blocked storage fails locally.
- Currency codes/symbols, `%`, absent-data `-`, stage colors and probability
  geometry are explicit display exceptions. Fixed-two cents display remains
  independent of ISO currency exponent; weighted cents still use bigint and
  the existing half-up formula, including safe maximum values.
- Overview date-only display uses the shared UTC carrier adapter; instant
  display honors the independent presentation timezone/calendar preferences.
  Date form values stay Gregorian `YYYY-MM-DD`. Relative-time sentences use
  finite translated messages. This does not qualify full numeral/calendar/RTL
  workflows.
- The old exported `timeAgo` function in the layout remains unchanged solely
  for the separate activity-page consumer owned by LOC-101. The overview uses
  `useCrmDetailPresentation` instead. The shared layout's activity-create callback
  is checked and translated here; the full activity page remains LOC-101.
- Shared loader, UI primitives and confirmation implementation keep their own
  catalog ownership. Both confirmations supply translated cancel labels.
  Developer-only exceptions/diagnostics are not user-facing catalog content.

## Behavior and contracts

`crm-presentation.ts` delegates saved exact pairs to `projectCrmJson` and
checks the full detail envelope, requested identity, joined contact/assignee,
pipeline stages/colors, notes/lost reason and finite activity rows before atomic
adoption. Existing source/probability/date/lifecycle validation remains active.
Request versions suppress late/superseded reads and cleanup callbacks; the shell
does not render a deal from another route.

Mutation replies intentionally omit joins. Their actual `{ deal }` shape is
checked separately before translated success. A failed follow-up detail refresh
reports a read failure independently of the already verified mutation. Stage and
won/lost actions now check HTTP/JSON/payload failures and release busy state.
Failed settings saves retain uncontrolled form inputs; failed or cancelled
deletes do not navigate. Activity creation validates its unjoined `{ activity }`
reply and deal identity before clearing the draft.

Existing organization-scoped `get_deal`, `update_deal`, `delete_deal`,
`move_deal_stage`, `mark_deal_won`, `mark_deal_lost` and `add_deal_activity`
tools already share the REST CRM service. No service, API/tool contract,
authorization, schema/migration, ledger, currency flags or Stripe implementation
changes are part of this task.

## Verification and handoff

Production JSX renders with real next-intl and `PresentationProvider` while
tests control hooks/IO/context boundaries. Bilingual rendering, caller escaping,
exact cents/weighted values, dates, machine values, failure matrices,
confirmation cancellation, cleanup and superseded reads are covered. The
disposable PostgreSQL fixture checks real REST and linked MCP detail/mutation
envelopes with the presentation readers and retains independent SQL-text,
scope/auth, lifecycle, audit and rollback assertions.

See [task evidence](../evidence/LOC-100-attempt-1.md). LOC-101/102 and independent
LOC-069/008/002 combined acceptance remain open. Native Persian terminology,
browser/full RTL, hosted CI, deployment and release acceptance are separate.
