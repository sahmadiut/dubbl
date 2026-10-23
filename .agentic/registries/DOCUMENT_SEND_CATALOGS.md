# Document send control catalogs

LOC-119 owns `components/dashboard/send-document-dialog.tsx`. Its 44 paired
DocumentSend messages cover all five document kinds, composition labels,
personal-message prompts, email/document preview actions and iframe titles,
retry/edit/back actions, attachment control, send/mark actions and finite errors.
English lower-case document labels are explicit catalog values; Persian does not
depend on English case conversion. Whole sentences own their interpolations.

The related launch controls in sales invoice, quote and credit-note detail and
purchase-order and debit-note detail already use their respective domain
catalogs. They retain ownership; this task adds no duplicate launch keys.

Explicit exceptions and adjacent ownership:

- The entire invoice payment selector, labels, Stripe connection effect,
  payment-link state/reset and Pay invoice preview props remain unchanged under
  DEC-008. Its English copy is an explicit owner-scope exception.
- Outgoing email subjects, the English document type map used for subjects,
  template fallback `there`, preview `View quote`/`Pay invoice` labels, example
  preview URL and email/PDF templates retain LOC-009 ownership. The translated
  UI document label is kept separate from the existing email subject label.
- `publicEmailMoney`, its fixed template currency formatting and existing en-US
  date formatter remain unchanged. Dates, numerals and templates need separate
  locale/calendar qualification. No saved amount is coerced to Number.
- Recipient example `recipient@example.com`, caller names/messages/organization,
  document numbers, missing-value dash, blob URLs and returned HTML/PDF are data
  or technical examples. Caller text is escaped by React in the dialog.
- Document kinds, API/PDF paths, payload keys, POST methods, organization storage
  and header keys, attachPdf/includePaymentLink values and callbacks are preserved.

HTTP send failures use a finite translated fallback instead of raw server
diagnostics; network send/mark failures now show the same operation fallback.
Existing finally blocks release loading state. Successful callbacks and request
bodies are unchanged. Mark-as-sent still sends a bodyless POST.

Existing REST routes and MCP registrations were inspected: invoice-lifecycle,
quotes, credit-notes, debit-notes and purchase-orders expose their existing send
operations; `email.ts` and `document-rendering.ts` expose send_document_email,
preview_document_email, list_document_emails and resend_document_email alongside
the document-emails REST routes. Credit/debit-note recognition
does not promise email delivery. This presentation-only slice adds no user
operation or REST/MCP/schema/auth/money contract and does not qualify existing
email-provider delivery or full MCP email parity.

Production JSX tests use real next-intl/PresentationProvider, controlled hook
state and IO, and wrappers exposing portal children. Both locales and all five
kinds exercise rendering, escaping, exact bigint money, send/mark/email/PDF
preview success and HTTP/network failures, safe errors, request payloads and
headers, callback behavior, preview loading/recovery and field edits. Hooks are
controlled rather than mounted, so effect lifecycle, browser/keyboard/layout and
provider delivery are not qualified. No database fixture is required.

Persian wording is provisional. Native terminology review, RTL/calendar/numeral
qualification, LOC-071 combined acceptance and higher parents remain independent.
