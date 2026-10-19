# Contact detail shell and overview catalogs

LOC-059 owns `app/(dashboard)/contacts/[id]/layout.tsx` and `page.tsx`.
The paired `ContactDetails` namespace has 76 messages (5,950 total keys per
locale). Persian wording is provisional pending native terminology review.
LOC-027/007/002 retain independent combined acceptance; this child does not
complete its parent.

## Coverage and explicit exceptions

- Six navigation labels, missing-contact/back actions, merge action/hint,
  opportunity action/hint, duplicate search/dialog/confirmation, localized
  request failures and success messages. Merge description uses approved `strong`
  rich text and escaped caller-name interpolation.
- General, payment, credit, default-account/tax, notes and danger sections;
  every authored label, description, prose placeholder, option, button, busy
  label and confirmation including explicit cancel labels.
- User-entered names, email, phone, tax numbers, notes, account names/codes,
  tax-rate names and entity title remain caller data. Canonical currency codes,
  account separators and existing tax-rate number/percent presentation remain
  data; number/date and comprehensive RTL qualification are separate work.
- Technical email/telephone examples `email@example.com` and `+1 (555) 000-0000`
  remain literal. JSX punctuation `-`, `(` and `%)` is retained. Machine form
  names, IDs, tab/type/account/filter codes, URLs, organization headers, currency
  units, validation exceptions and the context-hook developer diagnostic are
  not translated. Internal errors are caught behind localized operation messages.
- `activityTypeConfig` lives in the layout module and its labels are consumed
  exclusively by the activity sibling. LOC-060 now owns its typed message keys
  and activity/statement/bookkeeping copy; see
  [financial tab scope](CONTACT_FINANCIAL_CATALOGS.md). People/files content
  belongs to LOC-057; navigation labels are owned here.
- Existing US/1099 copy is translated as existing product presentation. It does
  not introduce a tax-policy change or qualify statutory compliance. Existing
  delete warnings are preserved; actual REST/MCP deletion remains soft deletion.
- Shared UI, contact list/picker/creation drawer, money adapters, REST/MCP,
  database schema/migrations, IRR enablement and Stripe remain unchanged.

## Behavior and contracts

`get_contact`, `update_contact`, `delete_contact`, `list_contacts` and
`merge_contacts` already cover the contact operations through organization-scoped
direct DB access. Existing account/tax/deal tools cover reference selection and
opportunity creation. This presentation extraction adds no operation or API
shape; no new MCP tool is required. Existing list-filter/limit differences are
recorded by [LOC-058](CONTACT_LIST_CATALOGS.md); full transport parity is not
claimed here.

Update retains PATCH fields, optional nulls, `none` sentinels and the existing
zero/empty-to-30 payment-terms fallback. Credit input continues through the
existing currency-aware exact adapter and sends `creditLimitMinor` strings, not
a floating-point amount. Saved credit aliases are validated before adopting
state or filling decimal input. No units, rounding or ledger logic change.

The merge route uses the duplicate as source and current contact as survivor:
`POST /contacts/{duplicateId}/merge` with `{targetContactId: currentId}`. Search
preserves its encoded term and limit 20, excluding the current contact. Failed
HTTP/JSON/envelope/row/network reads use localized fallbacks. Failed merge
requests no longer expose arbitrary server prose or leave rejected promises.
Deletion requires successful HTTP before success/navigation and rejects its
confirmation callback on failure so the existing dialog permits retry. The
delete button is explicitly non-submit inside the edit form. Missing organization
does not set update saving state or leave initial contact loading active.

## Validation and remaining qualification

[Focused checks](../../tests/contact-detail-catalogs.test.ts) render the actual
production templates through React/next-intl/PresentationProvider in both locales.
Hooks/navigation are controlled; portal controls expose their authored children.
Tests execute actual callbacks for navigation/defaults, update/read/delete/merge,
search and reference requests. They cover cancellation, malformed responses,
network/status errors, caller escaping, busy states and exact aliases through
9,007,199,254,740,991 minor units in USD/JPY/KWD. Source audit enumerates authored
JSX/display attributes and Persian-script assertions.

These are not mounted-browser tests. Native Persian terminology, full RTL/layout,
locale-specific number/date formatting, hosted CI, deployment and production
qualification remain independent. No full build or dev server is required.
