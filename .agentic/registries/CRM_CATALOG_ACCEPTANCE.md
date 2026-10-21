# Combined CRM catalog acceptance

LOC-069 independently accepts the CRM presentation slice after LOC-099..102.
The current source inventory is seven CRM route TSX components and DealDrawer
in `components/dashboard/create-drawer.tsx`. Four namespaces contain 224 paired
English/Persian messages; complete catalogs retain 8,775 compatible leaves.
Every Persian CRM message contains Persian script. Wording remains provisional
pending native terminology review.

## Complete ownership inventory

Paths below are relative to `app/(dashboard)/crm/` unless stated otherwise.

| Production scope | Catalog ownership | Child evidence and exceptions |
|---|---|---|
| `page.tsx`, DealDrawer | CrmPipeline (89); shared DocumentForms footer | [LOC-099 scope](CRM_PIPELINE_CATALOGS.md) |
| `loading.tsx` | Existing SharedUI BrandLoader | Shared primitive; no authored CRM copy |
| `deals/[id]/layout.tsx`, `deals/[id]/page.tsx`, `deals/[id]/settings/page.tsx` | CrmDetail (75); CrmPipeline source labels | [LOC-100 scope](CRM_DETAIL_CATALOGS.md) |
| `deals/[id]/activity/page.tsx` | CrmActivity (42); CrmDetail type/time labels | [LOC-101 scope](CRM_ACTIVITY_CATALOGS.md) |
| `analytics/page.tsx` | CrmAnalytics (18); CrmPipeline built-in stage labels | [LOC-102 scope](CRM_ANALYTICS_CATALOGS.md) |

## Explicit exceptions and shared ownership

- Stored pipeline/stage/contact/member names, deal titles, notes, loss reasons,
  activity content, email addresses and unknown analytics stage IDs remain
  escaped caller data. Analytics returns stage IDs rather than configured names;
  only the six known built-in IDs map to finite display keys. Other IDs retain
  their original text, including underscores. Persisted names are not rewritten.
- Default setup names `Sales Pipeline`, `Lead`, `Qualified`, `Proposal`,
  `Negotiation`, `Won` and `Lost` remain saved POST values. Onboarding uses
  separately translated examples/stage labels. These compatibility values do
  not create an untranslated UI-label fallback.
- IDs, HTTP methods, paths, query keys, organization/content-type headers,
  JSON fields, form names, stage/source/activity/status/sort/filter values and
  the `deals-changed` event retain their machine contracts. Display labels use
  finite catalogs; unknown activity display types have a catalogued fallback.
- Currency codes/symbols and existing fixed-two money formatting, numeric input
  placeholders (`0.00`, `50`), `%`, punctuation/separators, absent-value `-`,
  probability geometry and stage colors remain explicit numeric/symbol/data
  exceptions. Cmd/Ctrl/Enter retain their actual keyboard meanings while the
  surrounding instruction translates. Summary counts retain existing numeric
  output; complete numeral/RTL acceptance remains independent.
- Date form values and saved dates stay Gregorian YYYY-MM-DD. Detail date-only
  labels use the UTC carrier adapter; instant/relative-time labels honor the
  independent presentation preferences. Activity day grouping uses Gregorian
  keys in the presentation timezone with previous-calendar-day arithmetic.
  The list's existing date formatting remains a later calendar/numeral boundary.
- Loader, currency/select/search/input controls, confirmation dialogs and shared
  drawer footer retain their existing catalog ownership. Developer-only context
  misuse and checked-reader exceptions are diagnostics; visible feedback is
  catalogued. The old English layout timeAgo export described in historical
  LOC-100 evidence was removed by LOC-101; current routes use translated helpers.
- CRM routes introduce no CSV/PDF/email template or generated invoice narrative.
  This acceptance does not qualify adjacent document/output localization.

## Financial, failure and transport acceptance

CRM money retains the existing safe-integer fixed-two cents contract and
canonical agreeing `*Minor` strings, including maximum safe values and USD/JPY/
KWD labels. Bigint preserves weighted-value, summary and average arithmetic;
locale/currency labels do not rescale stored units. Counts, probabilities and
conversion percentages retain their nonmonetary units. Mixed-currency scalar
summaries require a filter; translations do not remove that guard.

The combined tests feed checked detail and activity responses through the actual
layout and DealContext into overview, activity and settings in both locales.
They verify navigation destinations and active tabs, caller escaping, common
exact amounts, weighted cents and Gregorian form values. The shell blocks every
sibling page when no deal is available or the saved deal belongs to another
route. Pipeline list, analytics and detail render the same checked maximum cents
together under one PresentationProvider across three currency labels.

The activity page invokes the actual layout creation callback in the combined
test. It retains exact org headers, POST body and feed query, clears the draft
and refreshes only after a verified creation, and preserves separate successful
creation/read-failure feedback when refresh fails. Failed/foreign-identity
creation retains the draft and does not refresh. These are controlled-hook/IO
production JSX tests, not mounted-browser interactions.

Current child suites retain complete forms/selectors/confirmation callbacks,
onboarding/list/pagination, stage and won/lost actions, save/delete, date/time,
activity filters/sort/append/cleanup, analytics and negative reader checks.
Whole responses are validated before adoption; exact aliases, requested IDs,
joined names, envelopes, physical quantities and finite enums are checked.
Generation/cleanup guards suppress old reads, pagination failures preserve
verified rows and busy states release on failure. Checked mutation success is
distinct from subsequent read success. Private diagnostics are not shown as
product feedback.

Existing registered tools in `lib/mcp/tools/crm.ts` cover pipeline CRUD, deal
CRUD, stage movement, won/lost, activity list/create and analytics (16 operations).
They retain direct shared-service/DB execution with AuthContext and wrapTool.
Real migrated REST/linked MCP/independent SQL fixtures exercise those contracts,
including tenancy, authorization, safe maxima, currency groups, dates/lifecycle,
audit/history, retry and rollback. REST lists use data/pagination; MCP lists use
deals/flat total. Checked readers respect each actual envelope.

No product/catalog, service/API/tool operation or schema, authorization,
schema/migration, posting/ledger, currency/IRR flag or Stripe source change was
needed. New files contain combined tests, ownership documentation and unique
acceptance/review evidence; generated money inventory adds only the new test.

## Qualification and evidence

See [actual checks](../evidence/LOC-069-attempt-1.md) and
[honest Codex self-review](../evidence/LOC-069-review-1.md). This accepts LOC-069
alone. LOC-008/002, native terminology, full RTL/calendar/numerals, mounted
browser/keyboard, adjacent output, hosted CI, provider, deployment and production
qualification remain separate. No full build or dev startup was run.
