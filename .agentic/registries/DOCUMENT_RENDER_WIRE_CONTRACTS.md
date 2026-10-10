# MON-127 document rendering contracts

## Boundary ownership and representations

| Boundary | MCP counterpart | Inputs and outputs |
|---|---|---|
| GET v1/invoices/:id/pdf, quotes/:id/pdf, credit-notes/:id/pdf, purchase-orders/:id/pdf, debit-notes/:id/pdf | render_invoice, render_quote, render_credit_note, render_purchase_order, render_debit_note | Owned live UUID; optional format=html/pdf, default HTML. view:data. HTML text or binary PDF; MCP returns format/content/contentType/filename/document with PDF content base64. |
| POST v1/document-templates/:id/preview | preview_document_template | Owned live template UUID, empty/absent JSON body; format=html/pdf. manage:invoices. Sample amounts retain fixed input integers but display organization default currency; sample document DTO accompanies MCP output. Invoice/quote/PO presentation follows template type; other existing template types retain invoice sample presentation, not new payslip/receipt output. |
| GET api/pay/:token/pdf | render_payment_link_invoice | Opaque payment-link capability, no caller org/document override. PDF; tool also accepts HTML and additionally scopes to AuthContext organization with view:data. Live invoice/organization/contact; draft/void denied; paid downloads remain available. |
| GET api/portal/:token/invoices/:id/pdf | render_portal_invoice | Active unexpired portal capability and invoice UUID belonging to that capability contact/org; format as above. Tool adds AuthContext org and view:data. |
| GET api/portal/:token/statements/pdf | render_portal_statement | Active capability; optional real Gregorian startDate/endDate/currencyCode plus html/pdf (REST default PDF, tool default HTML). Returns original attachment workflow or printable HTML. Uses the contact-statement calculation; tool additionally returns dated data with Minor aliases. |
| POST v1/document-emails/preview | preview_document_email | Strict bounded display-text props; manage:invoices. amountFormatted is text, not a monetary field. HTTP(S) viewUrl only. Returns {html}; no send/log mutation. |
| POST v1/document-emails/:id/resend | resend_document_email | Owned email log UUID; empty/absent REST body. Tool retains emailLogId input and {success,emailLogId,status}; REST retains {emailLog:{id,status}}. manage:invoices plus view:data. All five document kinds are preflighted even without attachments; requested attachments are generated before delivery. |
| Existing send_document_email | Same existing MCP operation | Existing fields and {success,emailLogId,status} retained. Optional safe signed amountCents (legacy name, document-currency minor units), additive canonical amountMinor string, aliases must agree. Bounded dates/text, strict unknown rejection; manage:invoices/view:data. Amount override affects only email display, never saved money. All requested PDF kinds use validated saved currency. |
| POST v1/invoices/:id/send, attachPdf=true | Existing send_invoice owns lifecycle; send_document_email owns email-only delivery | Existing email/lifecycle separation remains. REST completes reference/snapshot/PDF preflight before sendInvoice posts or creates a payment link. Provider delivery remains after committed lifecycle, as documented by MON-019; durable delivery is separate. |

Each monetary value is an unchanged integer in saved document currency minor
units (USD cents). subtotal/taxTotal/total/amountPaid/amountDue and line
unitPrice/taxAmount/amount retain safe Numbers with corresponding canonical
*Minor strings in MCP data. Missing paid/due values default to 0/total as before.
HTML/PDF contains exact currency text, rather than JSON aliases. Accepted range
is signed +/-9007199254740991, not full int64. Unsupported stored or derived
amounts return HTTP/MCP 422 LEGACY_NUMERIC_RANGE. Unknown/duplicate formats,
invalid UUID/dates/schema controls return 400; denied roles 403, absent/foreign/
deleted documents 404, expired portals 410. No exact-client negotiation or
magnitude-driven string fallback is added. Exact inputs from existing invoice
writers retain their stored units through rendering.

USD 1250 -> 12.50; IRR/JPY 1250 -> 1250; KWD 1250 -> 1.250. The formatter
uses bigint whole/fractional parts and Intl currency symbols without converting
the decimal amount to Number. Quantity is physical hundredths; optional
discountPercent is basis points, both validated integer controls independently
of currency. No quantity/percent Minor aliases are invented. Hidden line tax
and header amounts are guarded even if templates omit them. Payment page gross
line display is exact and public summary preflights its safe derived range.

## Reference, snapshots and side effects

Shared document service uses one repeatable-read, read-only transaction for
document/contact/organization/template selection and rendering. Live contacts
must belong to the document organization. Invoice party snapshots are read as
SQL text with numeric-token round-trip preflight, then known text fields are
projected; unknown historical fields remain opaque, without inferred units.
Saved null text clears the live field; missing keys use current scoped values.
Saved history is never rewritten. Snapshot null names have harmless display
fallbacks. Attachment filenames replace unsafe document-number characters.

Email send/resend preflights before provider invocation/log insertion. Failed
rendering is propagated, without silently dropping a requested attachment.
Provider failure retains the existing failed-log policy; no durable outbox,
provider idempotency, concurrent-deletion/delivery atomicity, or real delivery
qualification is inferred. Authentication API-key lastUsedAt updates remain.

Portal statements reuse MON-112's exact dated invoices/credits/payments/bills/
debits, historical totals and credit/debit carrier exclusions, with a scoped
contact capability. Mixed currencies require an explicit filter. The portal's
legacy invoice-only JSON statement remains MON-030; its selection/order is
intentionally distinct from this dated downloadable statement.

## Consumer inventory coordinated with MON-008

| Consumer group | Ownership/result |
|---|---|
| lib/documents/pdf-generator.ts, pdf-renderer.tsx | MON-127 exact safe-range formatting and complete data preflight; shared render service and both existing HTML generators remain. |
| Public pay and portal invoice/payment/quote/statement pages | MON-127 removes fixed /100 and USD statement display; uses response currency, exact safe formatter and bigint gross-line sum. Existing UI/fetch/navigation retained. MON-008 retains broad client/full-int64/error-state cutover. |
| app/sign/:token/page.tsx | Existing MON-126 static SSR uses guarded signature service totalFormatted. MON-127 regression executes this suite; no duplicate signing contract. |
| Remaining app TSX server pages/layouts | Source scan found no additional direct DB monetary rendering or direct money-formatter calls outside already scoped services; client dashboard/editor arithmetic remains MON-008. |
| Contact/supplier print/email | MON-112 guarded shared exact statement renderer; exercised as regression. Portal downloadable statement now reuses its calculation. |
| Financial/report PDFs, XLSX, scheduled attachments | Existing report/schedule child contracts and MON-029/031 integration own these; shared statement formatter/export reused unchanged. |
| Payroll files, self-service, payslips, tax-form PDF-named route | MON-085/025 own safe fixed-unit data, Minor aliases, exact dashboard/CSV projections. Existing tax-forms/:id/pdf returns JSON data/note, not binary PDF. Actual payroll-output suite regression passed; this task introduces no payroll PDF generator or statutory qualification. |
| Domain send flows and recurring/reminder/background emails | Their domain child contracts retain lifecycle/commit/provider units and display-text props; shared PDF primitive now guards and formats exact amounts. Invoice REST PDF attachment preflight is additionally covered here. Broader MON-008 background/full-int64 consumer cutover remains open. |

## Evidence and limits

tests/document-render-wire.test.ts covers signed/scale/max-safe text, hidden
amount/quantity/currency guards, exact sum cancellation and strict controls.
tests/integration/document-rendering-worker.ts executes actual API-key handlers,
full MCP SDK registration, legacy REST/exact MCP invoice writers, five document
kinds HTML/PDF, templates, public capabilities, dated statements and mocked SMTP
send/resend. It asserts Minor/numeric parity, actual PDF signature/base64,
escaped line content, raw snapshot corruption, safe-limit currencies, schema/
tenant/role failures and unchanged domain/log/delivery state for rejection.
Payroll/contact/signing/public-portal/receivable suites run on disposable UTF-8
loopback PostgreSQL. No screenshot, visual print-fit, browser/session/OAuth,
Persian/font/layout, full-int64, production/accounting/IRR release or real
SMTP/provider qualification is claimed. MON-034 still owns independent combined
parent acceptance; MON-008 and later qualification tasks remain open.
