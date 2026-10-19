# Contact financial tab catalogs

LOC-060 owns bookkeeping, activity and statement pages under
`app/(dashboard)/contacts/[id]/`, the activity configuration labels in the
shared layout, and `lib/i18n/contact-financial-presentation.ts`.

The paired flat namespaces contain 13 `ContactBookkeeping`, 35 `ContactActivity`
and 44 `ContactStatement` messages: 92 additions, 6,042 keys per locale.
Persian wording remains provisional pending native financial terminology review.
LOC-027/007/002 retain independent combined acceptance.

## Coverage and explicit exceptions

- Bookkeeping account/tax sections, descriptions, placeholders, empty options,
  save action and update/reference outcomes.
- Activity type/date filters, clear action, empty and loading states, five type
  badges, all current invoice/quote/credit-note/payment/bill status codes and a
  safe unknown-status fallback. Shared configuration stores typed catalog keys;
  icons, colors and document destinations retain their existing values.
- Statement period/date filters, clear/PDF/email actions, missing-email tooltip,
  loading/empty states, summary labels and hints, table headings and hints,
  opening/closing rows, five transaction types and a safe unknown-type fallback,
  read and email outcomes.
- Contact/account/tax names, codes, document numbers and transaction descriptions
  remain data. Descriptions arrive as opaque service strings and may contain
  user references or existing generated English document labels. They are not
  translated by guessing their contents; localized service/PDF/email content
  belongs to the broader user-visible output and integration work.
- Existing account separators, tax-rate percentage punctuation and precision,
  currency/amount/date formatting and the credit-note minus sign remain intact.
  Comprehensive localized number/date presentation and RTL layout are separate.
- Machine types/statuses/filter values, preset codes and their existing Gregorian
  date calculations, pagination, organization headers, IDs, URLs, request bodies,
  currency codes, `none` sentinels, exact aliases and internal caught exceptions
  are not translated. Unknown status/type values use finite catalog fallbacks
  rather than arbitrary server text or prototype properties.
- Shared UI, other contact screens, database schema/migrations, financial
  calculations, currency units, IRR enablement and Stripe are outside this slice.

## Behavior and contracts

Existing `update_contact`, account/tax listing, `get_contact_activity`,
`get_contact_statement`, `export_contact_statement` and
`email_contact_statement` tools cover these operations using organization-scoped
services/direct database access. This presentation change adds no operation,
REST shape or MCP tool. The existing PDF action still opens printable HTML;
browser Print / Save PDF remains the export behavior.

Bookkeeping preserves all PATCH fields, nullable optional values, `none`
sentinels and currency-aware `creditLimitMinor` input strings. Saved credit
aliases are validated before adoption. Missing organization is checked before
setting saving state. Reference reads now check HTTP success, envelopes and
displayed row fields; failures use localized copy without adopting invalid rows.

Activity retains limit 30, date/type filters, cursor and append/replace behavior,
infinite-scroll guards and document navigation. Statement reads retain filters,
abort guards and exact summary/movement validation. PDF query parameters and
email body/header behavior are unchanged. Failed email responses use a localized
operation fallback instead of exposing arbitrary server or network prose.

## Validation and remaining qualification

[Focused checks](../../tests/contact-financial-catalogs.test.ts) render actual
production templates with React, next-intl and PresentationProvider in both
locales, controlling hooks/navigation and exposing portal control children.
Actual production callbacks cover updates, references, activity pagination,
statement reads/aborts, PDF/email, filter reset and all six date presets.
Checks include status/JSON/shape/alias/network failures, missing organization,
busy states, caller escaping, prototype-like unknown values and exact amounts
through 9,007,199,254,740,991 minor units in USD/JPY/KWD. Source audit enumerates
authored JSX/display attributes and asserts Persian script in every new message.

These checks do not claim mounted-browser, native terminology, comprehensive
RTL/date/number formatting, live provider, hosted CI, deployment or production
qualification. No full build or unrequested dev server is part of this task.
