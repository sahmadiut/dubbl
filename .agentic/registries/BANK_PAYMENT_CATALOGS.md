# Bank payment catalogs

LOC-033 adds 134 paired `BankPayments` messages in English and provisional
Persian, bringing both catalogs to 3,600 compatible keys. Existing namespaces
are unchanged. LOC-023/007/002 retain independent integration acceptance.

## Authored presentation covered

- `app/(dashboard)/accounting/banking/scheduled/page.tsx`: document title,
  heading/guidance, status filter and badges, relative date groups, processing
  actions/results, empty/read states, unknown contact, scheduling dialog, bill
  balance suffix, amount accessibility label, fields and operation notifications.
- `batches/page.tsx`: document title, heading/guidance, empty/read states,
  status/count labels, creation dialog, selection counts, amount accessibility
  labels, totals/unavailable state, preview failures and operation notifications.
- `batches/[id]/page.tsx`: title, confirmation, status/date summaries, navigation,
  submission/results, item summaries, accessible remove action, remittance dialog,
  missing-email guidance, sending/skipped counts and operation notifications.
- `components/dashboard/create-drawer.tsx`: only `BankTransferDrawer`, including
  account/amount/date/memo fields, placeholders, preview, accessibility label,
  local guards, loading/errors, notifications and translated footer props.
  `TransferDrawer` and all other shared declarations remain unchanged.
- `components/dashboard/payment-amount-preview.tsx`: real scheduled-payment
  preview and invalid-amount guidance. The existing financial test now supplies
  the same PresentationProvider context as the application.
- `i18n/bank-payment-presentation.ts`: finite typed status, request-error and
  local validation mappings. Shared BankAccountErrors provide permission,
  authentication, input/range and known bank failures. Unknown server, HTML,
  network and parser failures use translated operation fallbacks. Raw exception
  text is never shown by these mutation handlers. Responses are inspected before
  consuming their successful JSON; error readers clone before shared fallback.

ICU handles payment/supplier/selection counts and complete confirmation/result
messages. Date-group identifiers remain stable tokens with the existing local
day-difference algorithm. An Effect Event reads current translations for initial
processing notifications; its processing effect still depends only on orgId,
so changing a filter or locale does not post cash again.

## Explicit exceptions and contracts

Account/contact/batch names, bill numbers, notes, memos, references and email
addresses remain escaped caller data. IDs, ISO currency codes, canonical dates,
status values, machine request fields, org headers, routes/query strings, CSS,
icons and punctuation remain unchanged. `0.00` remains a technical decimal
example; existing date and exact-money adapters retain their presentation policy.
Internal caught read/preview sentinel errors are not user-visible copy. Saved
transfer journal descriptions, audit data and remittance email content remain
service-owned and unchanged; broader document/email extraction is separate.

No schema, migration, financial service, REST, MCP or Stripe implementation
changed. No new operation was introduced. Existing org-scoped tools retain
schedule list/get/create/update/delete/process, batch list/get/create/update/
submit, `generate_remittance`, `send_payment_batch_remittance` and
`record_bank_transfer` coverage. Manual/CSV banking and export paths are unchanged.
Canonical Minor strings, bigint previews/totals, bill/contact/currency guards,
confirmation/session guard, date grouping, cancellation/removal payloads and
close/reset/refresh/navigation behavior are preserved.

## Verification and handoff

`tests/bank-payment-catalogs.test.ts` renders actual production templates through
React, next-intl and PresentationProvider in both locales. Hook state/navigation
are controlled and portals render inline. Production callback syntax runs with
explicit network/state boundaries for schedule create/cancel/process, batch
create/submit/remove, remittance preview/send and bank transfer. Checks cover
exact low digits in USD/JPY/IRR/KWD, canonical dates/org headers/payloads,
confirmation/organization guards, invalid amounts/currencies, failure preservation,
remittance alias/totals rejection, sent/skipped/partial counts, HTML/network and
unknown errors, escaped caller content, date-group boundaries and stable initial
processing dependencies. An AST audit rejects authored English JSX/visible
literal attributes, and Persian-character checks guard every new Persian leaf.

These are template/callback tests, not browser event automation or database
transaction qualification. Persian terminology is provisional pending native
review. Full RTL/font/layout, browser interactions, database integration, hosted
CI, providers, deployment and production IRR gates remain independent. No
application database was used. See [evidence](../evidence/LOC-033-attempt-1.md)
and [honest self-review](../evidence/LOC-033-review-1.md).
