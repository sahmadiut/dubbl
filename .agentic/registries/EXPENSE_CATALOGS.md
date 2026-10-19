# Expense catalogs - LOC-051

LOC-051 is the bounded expense/recurring-expense child of LOC-026.
LOC-026/007/002 retain independent combined acceptance. Persian wording is
provisional pending native financial terminology review and RTL qualification.
DEC-008 preserves Stripe unchanged.

## Source ownership

| Source | Extracted copy |
|---|---|
| `app/(dashboard)/purchases/expenses/page.tsx` | Page/document titles, columns, statuses, empty pipeline and guidance, summary labels, mixed-currency fallback, search/date/status/sort filters and failures |
| `app/(dashboard)/purchases/expenses/[id]/page.tsx` | Detail title, workflow actions/confirmations/dialogs/toasts, timestamps and mileage captions, receipt preview/download/failure, edit drawer and its local footer, labels, errors and amount accessibility names |
| `app/(dashboard)/purchases/expenses/recurring/page.tsx` | Page/list/drawer, statuses and frequency options/selected trigger, schedule labels, fixed-two amount guidance/prefix, totals, preview and creation/read failures |
| `components/dashboard/create-drawer.tsx` | Only ExpenseDrawer and its import: claim creation, organization currency/mileage/tax lookup failures, item/mileage labels, previews, required fields, action/busy/cancel overrides |
| `i18n/expense-presentation.ts` | Typed finite status/frequency/sort display maps and reviewed local validation errors |

Added 196 paired Expenses messages: 5,403 compatible keys per locale. All
existing catalog namespaces remain unchanged. Count/list/detail/settings errors
store finite keys and render in the current locale; translations are absent from
read-effect dependencies. Unknown/prototype-like status/frequency/sort codes
remain caller data. Unreviewed local validation uses a translated amounts/accounts
fallback. HTTP/network/JSON failures use operation-specific translated messages;
server prose never selects the local-validation map or becomes visible copy.

## Preserved data, money and workflow behavior

Expense reads keep the counts/list/detail URLs, organization header, pagination,
sort/filter codes and exact-money adoption. Malformed list envelopes and money
aliases enter the read-failure state. Existing first-page/count cancellation
guards remain intact. Mixed-currency summaries are translated without adding
unlike currencies; same-currency totals still use bigint.

Creation/editing keep POST/PATCH endpoints and title/description/item payloads.
Currency remains the organization currency for new claims and the saved currency
for edits. Exact amount strings and canonical amountMinor values retain existing
currency scales, range, positive-on-create/zero-on-edit rules, tax-inclusive
policy, receipt references and line identity. Mileage still extends original
exact distance/rate decimals before rounding, retains hundredths-of-mile
metadata, and preserves omitted saved metadata on edit. Local money validation
is translated separately from transport failures. Failed requests keep forms
open and restore the saving control. New-claim success requires a saved identity
before closing/navigation. Aborted currency/tax reads do not adopt state.

Submit/resubmit, recall, approve, reject, pay, reverse and delete retain their
POST/DELETE routes and original body/header choices. Rejection keeps caller
reason text; payment keeps canonical date text. Confirmation cancellation still
prevents destructive requests. Successful operations refresh/navigate and close
the relevant dialog as before; failures use localized per-operation feedback.

Receipt URL lookup retains the encoded file key, org header, image/other-file
preview distinction and download behavior. Missing org context makes no request;
HTTP/JSON/network/shape failures now settle loading and show the receipt fallback.
No storage provider request was made during verification.

Recurring expenses retain supplier ownership, all six canonical frequencies,
monthly/USD reset defaults, date-only schedule, optional occurrence cap and
end date, type expense, quantity 1 and exact unitPriceExact strings. Every
currency retains legacy fixed-two input: 12.50 stores 1250 raw units, including
JPY/IRR/KWD. Expenses generate gross amounts without tax/discount. Subminor ties
and all monetary parsers/helpers are unchanged. Missing org/submitting guards,
HTTP/envelope checks and aborted initial-read suppression prevent misleading
success or stale state. Creation requires a saved template identity before reset.

## Explicit exceptions and independent ownership

- Caller titles/names/descriptions/categories, people/email, rejection reasons,
  account/tax labels, filenames, currency codes and saved date text remain data
  and are React-escaped. Unknown machine values are displayed unchanged.
- Technical URLs, JSON names, IDs, status/filter/frequency codes, CSS/icons,
  numeric placeholders and missing-value dashes remain constants.
- Existing money/date/distance/percentage/quantity adapters and ASCII exact
  decimal entry remain intact. Complete numeral/calendar adoption is separate.
- ExpenseAmountInput is a generic, unchanged exact-decimal wrapper with required
  caller label. All expense-owned callers now provide translated labels; no
  helper or input scale change was needed.
- Shared date/dialog/currency/table primitives and AccountPicker retain existing
  catalogs. ContactPicker internals remain LOC-058; the recurring expense supplier
  placeholder belongs here. FileUploader internals already use Upload catalogs.
- Shared purchasing navigation/forms remain LOC-056. Other purchasing children
  and combined LOC-026 acceptance remain independent. No new workflow was added.
- No REST/MCP/service/schema/migration/FX/worker/IRR rollout or Stripe change.

## Existing MCP coverage

The organization-scoped direct DB tools in `lib/mcp/tools/expense-crud.ts` already
cover list/get/count/create/update/delete; `expenses.ts` covers
submit/recall/approve/reject/pay/reverse. The recurring template tools in
`recurring-templates.ts` already cover list/create for expense type. Existing
AuthContext, described schemas, permissions and wrapTool error handling remain
unchanged. Receipt URL access keeps its existing storage authorization boundary.

## Verification and limits

`tests/expense-catalogs.test.ts` runs production functions with real
React/next-intl/PresentationProvider, tables, date/currency/amount inputs,
selectors and exact-money helpers. Hooks/router and portal/picker/uploader
boundaries are controlled. Ten focused tests cover bilingual list/detail/create/
edit/recurring rendering, all workflow statuses, escaping, mixed currencies,
exact previews/payloads, frequency values/callbacks, action failures, read/settings
cancellation, malformed aliases/envelopes, receipt failure handling, source AST
inventory and Persian script. Existing migrated PostgreSQL tests separately
exercise real REST, registered MCP, SQL, lifecycle and recurring money behavior.

See [attempt evidence](../evidence/LOC-051-attempt-1.md) and
[honest self-review](../evidence/LOC-051-review-1.md) for final results. These are
controlled rendering/callback checks, not mounted browser interaction or layout
approval. Native Persian terminology, RTL/fonts/layout, hosted CI, deployment and
production IRR qualification remain independent. No full build or dev server ran.
