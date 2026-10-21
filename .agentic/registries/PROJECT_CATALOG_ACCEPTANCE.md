# Combined project catalog acceptance

LOC-068 independently accepts the project presentation slice after LOC-093..098.
The current source inventory is 11 route TSX components and ProjectDrawer in
`components/dashboard/create-drawer.tsx`. Seven namespaces contain 498 paired
English/Persian messages; both complete catalogs have 8,551 compatible leaves.
Every Persian project message contains Persian script. Wording is provisional
pending native terminology review.

## Complete ownership inventory

Paths below are relative to `app/(dashboard)/projects/` unless stated otherwise.

| Production scope | Catalog ownership | Child evidence and exceptions |
|---|---|---|
| `page.tsx`, `[id]/settings/page.tsx`, ProjectDrawer | Projects (100); shared DocumentForms footer | [LOC-093 scope](PROJECT_LIST_CATALOGS.md) |
| `loading.tsx` | Existing SharedUI BrandLoader | Shared primitive; no authored project copy |
| `[id]/layout.tsx`, `[id]/page.tsx` | ProjectOverview (89); Projects finite project labels | [LOC-094 scope](PROJECT_OVERVIEW_CATALOGS.md) |
| `[id]/project-context.tsx` | Checked read errors rendered by ProjectOverview in layout | Provider and compatibility exceptions below |
| `[id]/tasks/page.tsx` including board, checklist, comments and drawers | ProjectTasks (63); shared project presentation | [LOC-095 scope](PROJECT_TASK_TIME_MILESTONE_CATALOGS.md) |
| `[id]/time/page.tsx` including entry drawer, charts and timers | ProjectTime (79); shared project date/duration presentation | [LOC-096 scope](PROJECT_TASK_TIME_MILESTONE_CATALOGS.md) |
| `[id]/milestones/page.tsx` including assignments, paid metadata and progress invoice sheets | ProjectMilestones (73) | [LOC-097 scope](PROJECT_TASK_TIME_MILESTONE_CATALOGS.md) |
| `[id]/members/page.tsx` including team/member sheets | ProjectMembers (57) | [LOC-098 scope](PROJECT_COLLABORATION_CATALOGS.md) |
| `[id]/notes/page.tsx` including creation, editing, pinning and filters | ProjectNotes (37) | [LOC-098 scope](PROJECT_COLLABORATION_CATALOGS.md) |

## Explicit exceptions and shared ownership

- Project/task/milestone/contact/member/team names, email, initials, tags,
  categories, descriptions, labels, checklist text, comments, notes and invoice
  numbers are caller/saved data. React escapes them; the notes highlighter
  preserves escaping. Catalog interpolation does not turn caller data into HTML.
- IDs, routes, URLs, HTTP methods, organization/content-type headers, JSON fields,
  enum values, filter/select sentinels, CSS colors/classes, chart keys and the
  `projects-changed` event remain machine contracts. Labels are translated.
- Currency codes/symbols, numeric input placeholders and values, timer digits,
  percentages, overflow `+`, punctuation/separators and absent-value `-` remain
  explicit numeric/symbol exceptions. Ctrl/Enter/Esc retain their actual key
  meanings while the surrounding instructions translate.
- Shared controls, tables, calendar, confirmation dialog, loader, footer and
  pickers retain their existing catalog ownership. The shared calendar honors
  independent language/calendar/numeral preferences; event lookup, `data-date`,
  saved dates and form values remain canonical Gregorian YYYY-MM-DD. Note
  timestamps retain the existing instant/timezone preferences and ordering.
- Legacy `formatHours`, `formatDate` and `formatDateShort` in project-context
  remain compatibility exports with no project route display consumers. Legacy
  config labels remain compatibility data; presentation helpers reuse their
  colors while replacing every rendered finite label with a translation.
  The combined source guard prevents routes from importing these old display
  helpers/configs. `useProject` misuse errors and reader exceptions remain
  developer diagnostics; visible read/mutation feedback uses finite catalogs.
- Project-generated invoice notes/line descriptions remain saved backend output:
  `Invoice for project: ...`, `Time entry: ... minutes`, `Milestone: ...`, fixed
  percentage descriptions and `Billable expense` fallback in
  `lib/api/project-billing.ts`. They are not authored project-page chrome and
  must not be rewritten in issued/saved history. Remaining output-copy work is
  separately owned by LOC-009 and subsequent output/native qualification.
  Project pages do not introduce a project CSV/PDF download template here.

## Financial, failure and transport acceptance

Project money retains the existing fixed-two cents display contract, including
JPY/KWD currency labels, safe numeric saved values and canonical `*Minor`
strings. Derived sums/time earnings use bigint, including totals beyond the
safe Number range. Mixed-currency list totals remain suppressed. Whole minutes,
elapsed seconds, physical hours and progress/markup percentages are distinct
quantities; locale does not rescale them or reinterpret historical money.

One checked detail response now composes the actual ProjectProvider, layout
and all seven detail workflows under the same PresentationProvider/next-intl
instance in both locales. Tests verify canonical navigation/active tabs,
escaped caller data, shared exact amounts and derived earnings. Failed or
previous-route data cannot render through any detail page. Combined AST guards
audit all 11 components plus the drawer/shared footer for authored JSX, display
attributes, toast/document-title literals and obsolete helper imports.

The current child suites additionally check list/drawer/settings composition,
feature visibility, empty states, chart/calendar values and interactions, forms,
selectors, board drag/drop, callback payloads and input retention. Readers reject
failed HTTP, JSON, envelopes, mismatched identities, corrupt exact aliases and
invalid rendered quantities/joins. Effects ignore cleaned-up replies. Success,
refresh/navigation/clearing and busy-state release follow checked acknowledgments;
a failed follow-up read retains committed mutation success and reports its
separate read error. Private diagnostics do not become product feedback.

Existing org-scoped registered tools in `project-master.ts` and `projects.ts`
cover project CRUD, members/teams, tasks/checklists/comments/labels, time entries,
timers, notes, milestones/assignments and invoice previews/generation. They
retain direct shared-service/DB execution through AuthContext and wrapTool.
No REST/MCP schema/operation, authorization, schema/migration, posting, ledger,
currency/IRR flag or Stripe implementation changed. Current migrated integration
fixtures exercise actual REST, linked registered MCP, independent SQL, tenancy,
permissions, retry, history and rollback contracts together.

The existing timer-save workflow creates an entry and discards the timer in
two independent REST operations. If entry creation commits but discard fails,
or a committed response is lost, a retry may duplicate time. This acceptance
retains the child evidence's backend/idempotency limitation; it does not claim
atomic timer-save recovery. Autosave retains its existing silent error policy.

## Qualification and evidence

See [actual checks](../evidence/LOC-068-attempt-1.md) and
[honest Codex self-review](../evidence/LOC-068-review-1.md). This accepts LOC-068
alone. LOC-008/002, native terminology, full RTL/calendar/numerals, mounted
browser/keyboard, remaining output localization, hosted CI, deployment and
release/production qualification remain separate. No full build or dev startup
was run for this task. Self-review is not independent peer or human approval.
