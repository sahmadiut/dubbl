# Email and document output catalogs

LOC-123 owns the paired `Output` namespace, `i18n/output.ts`, the six
`lib/email/templates` content templates and shared layout, document email
subject generation, HTML invoice/quote/credit-note/purchase-order/debit-note
renderers, PDF display labels and preview sample descriptions, and portal
statement PDF headings/columns/period text.

The translator takes an explicit per-output locale and defaults to en-US;
background output does not infer a recipient's language from cookies. Email
components accept an optional internal locale prop, and HTML generators accept
an optional internal template locale. These hooks are exercised in both locales.
Existing REST/MCP schemas and send/background callers keep their existing English
default. Recipient-language resolution and delivery activation are not claimed.
PDF renderers deliberately continue selecting the English catalog: their existing
Helvetica font has no qualified Persian shaping/font support. Persian strings are
extracted now; font embedding, bidi, pagination and native output acceptance stay
with L10N/RTL/output qualification. This is extraction, not complete Persian output.

## Exceptions and preserved contracts

- Brand and legal identity: dubbl, Mindroot Ltd, company number, registered
  jurisdiction and postal address in the email footer remain verbatim. Legal-page
  translation is separate LOC-127 scope. Placeholder demo organization `Acme Corp`
  remains sample identity, rather than translated content.
- Caller-owned organization/contact/person names, custom roles, document numbers,
  descriptions, references, notes, saved header/footer HTML, bank details, payment
  instructions, personal messages, button overrides, notification titles/bodies and
  formatted dates/amounts are data; do not translate or reinterpret them. Template
  `{{variable}}` names and their replacement behavior stay unchanged. Notification
  generation and delivery/subject text outside these templates belong to LOC-124.
- URLs, routing, tokens, email addresses, filenames, content types, enums/statuses,
  organization/auth checks, schema error messages, provider errors, delivery logs,
  timestamps, country/currency codes and statutory acronyms VAT/ABN/GST/GST/HST
  remain machine/data contracts. `compliance.ts` validation messages are existing
  API diagnostics, inventoried for LOC-124; statutory rules are not changed here.
- `snapshots.ts` persists English fallback party identity as historical data.
  Existing saved snapshots are never translated or rewritten. Render-time fallback
  captions in `render-service.ts` use the English catalog.
- Statement HTML is delegated to `contact-statement-delivery.ts`; shared report
  PDF layout/row type values are delegated to `statement-export.ts`. This task
  extracts the portal adapter's own labels, not those separate implementations.
- SMTP/Resend transport errors and saved reminder-rule subjects/bodies are not
  rewritten. Stripe files/functionality are untouched under DEC-008.
- Exact minor values, canonical Gregorian dates, quantity hundredths and currency
  exponent formatting retain `render-wire.ts` behavior. Catalog extraction does
  not enable production IRR or change any financial readiness flag.

## Qualification

`tests/output-catalogs.test.ts` renders real React Email templates in both locales,
checks plural/truncation behavior and escaping, exercises all HTML document kinds
with USD/IRR/JPY/KWD and safe-integer-boundary money, and generates a real English
PDF. Existing document wire and disposable REST/MCP integration tests retain
financial, date-row, attachment, access and saved-snapshot regression coverage.
Persian wording is provisional. Email-client compatibility, mixed-direction visual
layout, native terminology, Persian PDF font/shaping and hosted CI are not qualified.
LOC-009 and LOC-002 remain independent integration tasks.
