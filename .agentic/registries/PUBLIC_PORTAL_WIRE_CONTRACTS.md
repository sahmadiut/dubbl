# Public payment-link and portal JSON contracts

MON-030, 2026-10-02, Asia/Tehran. Implementation: `lib/api/public-portal.ts`,
`public-money-wire.ts`, eight REST handlers and seven tools registered by
`registerPublicPortalTools`. Fixtures: `tests/integration/public-portal-wire*`.

## Representation, units and ranges

Additive contracts, without a header/query switch or exact-only mode. Existing
numeric fields, envelopes, signed stored values and selection/order remain.
Each documented money field gains a canonical ASCII `<field>Minor` integer
string with the same value. USD 1250 remains 1250 cents; stored IRR/JPY/KWD 1250
remains 1250, without guessing whether old input respected currency scale.
Header currencyCode defines line money units. Quantity remains hundredths,
discountPercent basis points, dates Gregorian and instants unchanged.

The transitional number ORM and numeric compatibility fields support exactly
[-9007199254740991, 9007199254740991]. Aliases do not extend this business range.
Unsafe rows or statement prefixes/totals return HTTP/MCP 422 with
LEGACY_NUMERIC_RANGE before activity/status writes. No rounded value is turned
into an apparently exact string. Statements add amountDue with bigint and bridge
each prefix/final sum after range checks. Existing descending invoice-date order
and all nondeleted invoice inclusion (including draft/void) remain: this is not
a new complete customer ledger statement.

A nonempty statement uses its invoices' actual currency; every invoice must
agree or it returns 422. An empty statement uses contact currency, then organization
defaultCurrency if the nullable contact currency is absent. Top-level/line
currencyCode is explicit. No conversion or saved FX rewrite.

## Operation inventory

GET inputs are path tokens. Quote acceptance accepts a UUID path ID and no body
or an empty JSON object. Unknown fields, including monetary/FX aliases, malformed
JSON and invalid UUIDs return 400 before mutation. MCP uses strict SDK schemas:
only token and, for acceptance, quoteId are allowed.

| REST operation | MCP operation | Response and money aliases |
|---|---|---|
| GET `/api/pay/[token]` | get_payment_link | Paid envelope remains `{status:"paid",invoice:{invoiceNumber}}`; pending envelope keeps invoice/organization/contact. Invoice totalMinor, amountDueMinor; lines unitPriceMinor, amountMinor, taxAmountMinor |
| GET `/api/portal/[token]` | get_portal_identity | contact {id,name,email} and organization {name}; no money |
| GET `/api/portal/[token]/invoices` | list_portal_invoices | `{data}` summaries; totalMinor, amountDueMinor; existing paymentLinkToken retained |
| GET `/api/v1/portal/[token]/payments` | list_portal_payments | `{data}` summaries; amountPaidMinor, totalMinor |
| GET `/api/v1/portal/[token]/quotes` | list_portal_quotes | `{data}` full quotes/lines; subtotalMinor, taxTotalMinor, totalMinor, billedTotalMinor; line unitPriceMinor, amountMinor, taxAmountMinor |
| GET `/api/v1/portal/[token]/statements` | get_portal_statement | contact/organization/lines/totalOutstanding; line amountMinor, paidMinor, balanceMinor, runningBalanceMinor; top totalOutstandingMinor and currencyCode |
| POST `/api/v1/portal/[token]/quotes/[id]/accept` | accept_portal_quote | Full updated quote; subtotalMinor, taxTotalMinor, totalMinor, billedTotalMinor; no lines |
| POST `/api/portal/[token]/invoices/[id]/approve` | accept_portal_quote | Historical path actually approves a quote; preserve `{quote:{id,status}}`. Shared service preflights full money row |

## Authorization and mutation ordering

Public routes use the bearer token as the existing grant, independently of
API-key/session/arbitrary organization headers. Portal tokens must be active,
unexpired and have an undeleted contact owned by their organization. Document
queries include organizationId, contactId and deletedAt predicates. Payment links
require an undeleted invoice and matching undeleted contact ownership. Existing
paid/draft/void behavior stays; other pending states retain their behavior.

MCP additionally constrains token lookup to AuthContext.organizationId. Reads
require view:data and acceptance manage:invoices, including custom permissions.
No HTTP self-calls or client-supplied organization override. Strict schemas reject
unsupported aliases in the real SDK before invoking handlers.

Original identity/invoice/approve paths retain 404 for invalid grants and 410 for
expired tokens; other portal routes retain 401. Nonpayable invoice is 400; invalid
payment link 404. Compatibility errors use shared handleError/wrapTool.

Invoice listing serializes the DTO before view activity insertion. Quote acceptance
checks sent status, expiry/deletion/token scope, locks the quote and preflights money
before update. Scoped update, returned DTO serialization and portal activity insert
share a transaction. Replay returns 404 without another write. Both acceptance
paths now enforce sent/expiry/deletion checks: historical approve formerly could
accept draft/deleted/expired quotes. A synthetic activity-trigger failure proves
status rollback. No ledger posting occurs; money and period locks are unchanged.
PortalActivityLog remains the public audit.

## Remaining scope

MON-016 retains integration after MON-030..034. MON-031 owns checkout/Stripe/
webhooks; MON-032 snapshot/restore; MON-033 generic import/export; MON-034 signing,
embedded JSON and remaining SSR/PDF bridges. MON-019 owns authenticated document
writers/snapshots; MON-029 reports; MON-022 organization configuration. Nonmonetary
portal token administration (`/api/v1/portal/access*`, invite) is unchanged; its
MCP parity/security audit remains PAR-007. MON-008/LOC-003/L10N-009..011 retain
public frontend/PDF arithmetic and localization. Full int64 business cutover,
OAuth HTTP/browser/production qualification, IRR enablement and client sunset
are not established by this slice.
