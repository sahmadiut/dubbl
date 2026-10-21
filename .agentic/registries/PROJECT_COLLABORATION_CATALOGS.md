# Project team, member and notes catalogs

LOC-098 owns project `[id]/members/page.tsx` and `[id]/notes/page.tsx`,
including the member/team sheets and note creation/editing/actions/filters.
`ProjectMembers` contains 57 paired messages; `ProjectNotes` contains 37.
Catalogs have 8,551 compatible leaves per locale. Earlier namespaces remain
semantically unchanged.

Real next-intl renders roles, count forms, descriptions, feedback, placeholders,
empty states, shortcuts and accessible action labels. Unknown role values use
a finite translated fallback. Note dates/times use the existing presentation
preferences for language, calendar, numerals and timezone without changing the
saved instant or sort order. Persian wording remains provisional.

## Exceptions and contracts

- Names, initials, email addresses, team names/colors and note content remain
  caller data, escaped by React. Search highlighting preserves this escaping.
- Organization/project/member/team/note IDs, route/query strings, HTTP methods,
  content-type/organization headers, JSON fields, role values and select/filter
  sentinels remain machine contracts. Shared primitive copy remains owned by
  the existing shared catalog slices.
- The member hourly rate retains exact `hourlyRateMinor` decimal-string input
  and the existing project cents/fixed-two display contract, including currency
  prefixes. No currency rescaling, money arithmetic, IRR flag or ledger change.
- Numeric input values, separators, CSS colors and nonverbal symbols remain
  unchanged. Keyboard shortcuts retain their actual Ctrl/Enter/Esc keys; the
  surrounding instructions are translated.
- Presentation-reader diagnostics are developer-only. Product feedback uses
  finite translated messages and never exposes server/network/parser prose.

## Behavior and transport coverage

Choice and assignment readers check HTTP, JSON, envelopes, identities, rendered
joins, duplicate IDs and exact money before atomic adoption. Read effects ignore
responses after cleanup. Read failures have separate localized feedback.
Mutation acknowledgements are checked before success, closing sheets, clearing
forms or refresh. Member/team creations match the selected member/team identity;
note edits/pins match the selected note. Failed operations retain input and
release busy state. A committed team mutation followed by a failed assignment
reload retains mutation success and reports the separate read failure.

The existing org-scoped registered MCP tools already cover add/update/remove
project member, assign/unassign/list project team assignments, and note
create/update/delete/list operations. REST/MCP implementation, authorization,
schema/migrations and Stripe files remain unchanged. The project-master
integration fixture passes actual successful REST and linked MCP responses
through the new readers while retaining independent SQL and isolation checks.

## Qualification handoff

See [attempt](../evidence/LOC-098-attempt-1.md) and
[Codex self-review](../evidence/LOC-098-review-1.md) for commands and results.
LOC-068/008/002 retain independent combined acceptance. Native Persian
terminology, full RTL/browser/output qualification, hosted CI, deployment and
production acceptance remain separate. No full build or dev server startup.
