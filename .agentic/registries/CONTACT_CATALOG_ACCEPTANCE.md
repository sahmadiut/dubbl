# Combined contacts catalog acceptance (LOC-027)

LOC-027 independently accepts the combined contacts extraction from LOC-057..060.
Seven paired namespaces contain 295 messages: Contacts (86), ContactDetails (76),
ContactPeople (19), ContactFiles (22), ContactBookkeeping (13), ContactActivity
(35) and ContactStatement (44). Complete catalogs retain 6,042 keys per locale.
Persian wording is provisional pending native financial terminology review.

## Current source inventory and explicit exceptions

Route paths below are relative to `app/(dashboard)/contacts/`.

| Surface | Authored display copy and ownership |
|---|---|
| `page.tsx` | [List inventory](CONTACT_LIST_CATALOGS.md): title, filters, table, sorting, empty guidance, counts, delete dialog and outcomes. |
| `loading.tsx` | Real shared BrandLoader uses SharedUI.loading2. No route-specific authored prose. |
| `[id]/layout.tsx`, `[id]/page.tsx` | [Detail inventory](CONTACT_DETAIL_CATALOGS.md): six navigation tabs, missing/back, merge/search/confirmation, opportunity action, editable fields, defaults, notes, deletion and request outcomes. |
| `[id]/people/page.tsx`, `[id]/files/page.tsx` | [People/files inventory](CONTACT_PEOPLE_FILES_CATALOGS.md): form, primary badge, counts, empty states, visibility, upload/download/delete, accessible actions and errors. |
| `[id]/bookkeeping/page.tsx`, `[id]/activity/page.tsx`, `[id]/statement/page.tsx` | [Financial inventory](CONTACT_FINANCIAL_CATALOGS.md): account/tax settings, activity filters/statuses/type labels, pagination, statement filters/presets/summary/table, PDF/email controls and request outcomes. Activity configuration is shared from the actual layout module. |
| `components/dashboard/contact-picker.tsx` | [List inventory](CONTACT_LIST_CATALOGS.md): selection, search, type badges, empty/creation controls and read failure. |
| ContactDrawer in `components/dashboard/create-drawer.tsx` | [List inventory](CONTACT_LIST_CATALOGS.md): creation fields, descriptions, type choices, outcomes and explicit create/cancel/creating labels passed to real shared DrawerFooter. Other drawer bodies retain their owners. |

The complete nine-route inventory, picker and owned creation body contain no
unexplained authored English JSX or visible literal attributes. Exact retained
technical placeholders are `email@example.com` and `+1 (555) 000-0000` in the
overview and creation drawer. `1099` identifies the existing US form; translating
its existing description does not qualify Iranian statutory compliance.

Names, notes, email, phone, tax numbers, person/job titles, file names, account/
tax names and codes, document numbers and explicit caller picker placeholders
remain escaped caller data. Statement descriptions are opaque service output,
including existing generated English document labels; localized service/PDF/
email content remains with LOC-009 and broader output acceptance. No heuristic
translation of server or user prose is introduced.

Currency/amount/date display, file-size units B/KB/MB and scaling, percentage
precision, initials, numeric samples, counts in tab badges, signs, separators
and missing-value punctuation preserve their documented existing presentation.
Dedicated numeral/date adapters and complete RTL are separate work. Canonical
types/statuses, filters, sort/preset codes, sentinel values, DOM/form names,
Gregorian dates, URLs/methods, headers, IDs, visibility/MIME values, signed
storage URLs/bytes, exact Minor aliases, caught internal errors and developer
diagnostics remain machine contracts.

## Independent combined verification

[Combined tests](../../tests/contact-catalog-integration.test.ts) compile the
production detail layout and all six pages into a shared module cache. The real
ContactContext provider/consumers and activity configuration are composed under
React, next-intl and PresentationProvider. Both locales render populated,
empty, missing and loading states. USD/JPY/KWD cases preserve the low digits of
9,007,199,254,740,991 minor units. Caller markup is escaped and all six tab labels,
tab selection, page content, exact credit input, statement/activity money,
canonical account options, primary/visibility badges and shared loader labels
are checked together.

Captured production JSX handlers retain their real closures: editing the credit
input in Details, explicitly rerendering Bookkeeping and submitting produces the
same organization-scoped PATCH with KWD `creditLimitMinor: "123456789"` for input
`123456.789`. Pending saving disables both pages' submit buttons. A valid saved
response adopts exact money; disagreeing aliases retain the prior saved contact,
show the localized operation error and reset saving. No fabricated contact
context or reconstructed handler is substituted.

These checks control initial hook state, effects, navigation, network IO and
portals; explicit rerendering is not a mounted browser test. A recursive AST audit
pins all nine route paths, audits picker/owned drawer copy, checks all seven
namespace schemas and asserts Persian script. The four child suites run together
on current source, including the real creation footer, callback successes,
HTTP/JSON/envelope/network failures, cancellation, retry cleanup, organization
headers, payloads, exact aliases, plurals, escaping and accessible labels.

Existing isolated migrated PostgreSQL suites run real API-key REST handlers,
registered MCP SDK calls and independent SQL assertions for contacts, statements,
activity, print/email preflight and combined report/contact reconciliation.
An explicit loopback TEST_DATABASE_URL targets a dedicated temporary PostgreSQL
cluster; fixtures create/drop randomized databases. No application DB is used.

## Preserved operations and handoff

No production source, catalog, REST/MCP, service, money adapter, schema/migration,
currency units, IRR flags or Stripe changes are needed for this acceptance.
Existing organization-scoped contact CRUD/merge, activity/statement/export/email,
reference account/tax and contact file metadata tools retain their contracts.
The PDF action retains printable HTML with browser Print / Save PDF behavior.

Full transport parity is not claimed: MCP contact lists retain their existing
limit/filter/balance differences, and add-person/file download/delete MCP tools
remain pre-existing gaps documented by the child inventories. No new user
operation or changed REST route requires a tool addition in this task.

LOC-007/002 retain independent combined acceptance. Native Persian terminology,
complete RTL/font/layout/browser qualification, number/date adapters, user-visible
service/PDF/email translation, live storage/email providers, hosted CI, production
migration/deployment and IRR enablement remain separate. Stripe is preserved under
DEC-008. No full build, dev server, Docker or deployment is part of this task.

See [attempt evidence](../evidence/LOC-027-attempt-1.md) and
[honest self-review](../evidence/LOC-027-review-1.md).
