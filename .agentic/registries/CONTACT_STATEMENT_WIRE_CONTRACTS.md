# MON-112 contact statements and delivery

Implemented 2026-10-08. Shared services: `lib/api/contact-statements.ts`,
`contact-activity.ts`, `contact-statement-wire.ts`, `contact-statement-delivery.ts`.
No schema changes, historical rescaling, FX or production currency flag changes.

| REST boundary | MCP operation | Enclosing output |
|---|---|---|
| GET contacts/[id]/statement | get_contact_statement | Statement object |
| GET contacts/[id]/supplier-statement | get_purchasing_supplier_statement | REST statement; existing MCP {statement} |
| GET contacts/[id]/activity | get_contact_activity | {activity,nextCursor,hasMore} |
| GET contacts/[id]/statement/pdf | export_contact_statement | Existing printable HTML; MCP {html,mimeType} |
| POST contacts/[id]/statement/email | email_contact_statement | {success:true} |

All reads require `view:data`; delivery also requires `manage:contacts`. Services
resolve an owned undeleted contact, and use organization-scoped repeatable-read,
read-only snapshots. API keys retain their bound org even if an x-organization-id
header or print orgId query names another org. Print retains its orgId session
selection parameter. Supplier tools retain the original tool name and envelope;
registration moved from purchasing.ts into contact-statements.ts and index.ts.
Public token/portal statements retain their existing public owner and behavior;
this task does not change their independent calculations or token authorization.

## Inputs and ranges

No monetary inputs. Statement query/email body and MCP accept optional startDate,
endDate, currencyCode. Dates are real inclusive Gregorian YYYY-MM-DD, years
0001-9999; defaults are one UTC year ago through today, with leap day clamped to
February 28. Reversed dates reject. Supported uppercase ISO currencyCode filters
all opening and period documents/payments. Unfiltered mixed currencies reject;
there is no implicit base conversion. Empty statements use contact currency,
then org currency/ USD fallback. Explicit filters define empty-result currency.

Activity accepts optional startDate/endDate, integer limit 1-100 (default 30),
an exclusive ISO createdAt cursor with Z/offset, and comma-separated type values
invoice,quote,credit_note,payment,bill. Includes draft documents and note carrier
payments as activity; these are excluded from financial statement cash movements.
It has no aggregate and retains per-item currency. REST rejects unknown/duplicate
parameters, malformed dates/cursors/types/limits; email rejects unknown body fields
and malformed JSON. Contact UUIDs validate before DB queries.

## Outputs and financial behavior

Existing numeric fields are integer currency minor units, USD cents. They gain
canonical decimal integer strings at the same boundary without opt-in:

- Statement root openingBalance/closingBalance, new totalDebit/totalCredit and
  supplier totalBilled/totalPaidOrCredited each have corresponding *Minor strings.
- Each transaction debit, credit, balance has debitMinor, creditMinor, balanceMinor.
  Existing date/type/documentNumber/description remain. Root/items add currencyCode.
  The contact projection remains {id,name,email,type} with no foreign projections.
- Activity amount gains amountMinor; counts, limits, cursors and dates are unchanged.

Stored and every emitted amount must fit +/-9007199254740991. Intermediate sums
use bigint; unsupported stored money and any unsafe emitted opening/running/total/
closing amount return 422 LEGACY_NUMERIC_RANGE. Full int64 consumers remain later
qualification. Negative saved money retains its signed value with no rescaling.

General contact statements use customer-positive and supplier-negative balance.
Supplier-only statements retain the AP convention: positive means we owe them;
bills increase credit/balance, payments/debit notes reduce it. Source documents
exclude draft, void, deleted and after-end rows; payments exclude deleted/future
rows and any credit/debit note application carrier. Both sides use original totals
less dated cash movements for opening balances. This fixes the general route's
prior use of today's amountDue plus another deduction of historical payments;
it does not rewrite ledger history. Same-day sorting uses type priority then UUID.
Contact merging/history constraints and full accounting qualification remain
outside this bounded read/delivery task.

Print and email use the same guarded DTO. Existing printable HTML/Print-Save-PDF
behavior and email layout remain; no binary PDF API is invented. Money formatting
uses exact integers and currency minor-unit scale: 1250 displays 12.50 USD, 1250
IRR/JPY and 1.250 KWD. Organization/contact/reference/description text is HTML escaped.
Generated and period dates use UTC. Missing email/config returns 400. Dates,
money, currency, permissions and the full HTML are validated before SMTP delivery.
Repeats resend; an SMTP failure can leave delivery outcome uncertain. No new
idempotency or audit promise is made for this existing email operation.

Activity preserves the legacy exclusive timestamp pagination contract: items with
identical createdAt across a page boundary can be skipped. A new compound cursor
and high-volume performance qualification are outside this monetary slice.

## Errors and evidence

Bad API key 401; permission denial 403; missing/foreign/deleted contact 404;
non-supplier for supplier statement 400. REST invalid input 400; MCP schema error
or wrapped 400. Unsupported saved dates/currencies/money, mixed currency and unsafe
results produce 422 LEGACY_NUMERIC_RANGE, before email. No partial JSON/bigint
serialization fallback. Financial/audit tables remain unchanged on reads/errors.

`tests/contact-statement-wire.test.ts` covers strict inputs and signed endpoints.
`tests/integration/contact-statement.test.ts` runs migrated disposable PostgreSQL
with actual API-key REST handlers and registered MCP SDK clients. Legacy/exact
invoice writers feed the statement, notes and carrier selection, AP signs, opening
double-count correction, activity and pagination, isolated tenants/custom roles,
HTML escaping, USD/IRR/JPY/KWD scale, signed edges/intermediate cancellation/result
overflow/stored int64 errors and unchanged snapshots are asserted. Nodemailer is
recorded in-memory in that fixture; no real email/provider is contacted. Parent
MON-102 retains integration acceptance; public portal, full-range, performance,
independent accounting and production IRR qualification remain their own tasks.
